// backend/src/server.js
require('dotenv').config();
const http = require('http');
const app = require('./app');
const pool = require('./config/db');
const { WebSocketServer, WebSocket } = require('ws');
const jwt =require('jsonwebtoken');

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Хранит активные подключения: { userId: WebSocket-соединение }
const clients = new Map();

wss.on('connection', (ws) => {
  console.log('Новый WebSocket клиент подключен');

  ws.on('message', async (message) => {
    let data;
    try { 
        data = JSON.parse(message); 
    } catch (e) { 
        console.error("Получено не-JSON сообщение:", message.toString()); 
        return; 
    }
      
    if (data.type === 'auth') {
        try {
            // Проверяем именно ACCESS токен, так как WebSocket - это активное соединение
            const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
            ws.userId = decoded.id;
            clients.set(ws.userId, ws);

            const onlineUserIds = Array.from(clients.keys());
            console.log(`Клиент аутентифицирован как пользователь ${ws.userId}. Сейчас онлайн: ${clients.size}`);
            
            // Рассылаем всем обновленный список онлайн-пользователей
            clients.forEach(client => {
                if(client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'online_users_list', userIds: onlineUserIds }));
                }
            });
        } catch(e) { 
            console.error("Ошибка аутентификации WebSocket:", e.message);
            // Если токен невалиден (например, истек), отправляем ошибку клиенту и закрываем соединение
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'auth_failed', message: e.message }));
            }
            ws.close();
        }
        return;
    }

    // Все последующие сообщения обрабатываются только если клиент аутентифицирован
    if (!ws.userId) {
        console.log("Сообщение от неаутентифицированного клиента, игнорируется.");
        return;
    }

    if (data.type === 'message') {
        const { receiver_id, content, messageType = 'text', reply_to_message_id = null } = data;
        const sender_id = ws.userId;
        
        try {
            const newMessageResult = await pool.query(
                'INSERT INTO messages (sender_id, receiver_id, content, type, reply_to_message_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [sender_id, receiver_id, content, messageType, reply_to_message_id]
            );
            let newMessage = newMessageResult.rows[0];

            if (newMessage.reply_to_message_id) {
                const repliedMsgRes = await pool.query(`SELECT m.content, u.username FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = $1`, [newMessage.reply_to_message_id]);
                if (repliedMsgRes.rows.length > 0) {
                    newMessage.reply_to_content = repliedMsgRes.rows[0].content;
                    newMessage.reply_to_username = repliedMsgRes.rows[0].username;
                }
            }
            
            const messagePayload = { type: 'new_message', data: newMessage };
            
            // Отправляем получателю, если он онлайн
            const receiverWs = clients.get(receiver_id);
            if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
                receiverWs.send(JSON.stringify(messagePayload));
            }
            
            // Отправляем сообщение обратно отправителю для отображения (включая чат с самим собой)
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(messagePayload));
            }
        } catch (dbError) {
            console.error("Ошибка при сохранении сообщения в БД:", dbError);
        }
        return;
    }
      
    if (data.type === 'delete_message') {
        const { messageId, receiver_id } = data;
        const result = await pool.query('UPDATE messages SET is_deleted = TRUE, content = \'Сообщение удалено\', type = \'text\' WHERE id = $1 AND sender_id = $2 RETURNING id', [messageId, ws.userId]);
        
        if (result.rowCount > 0) {
            const deletePayload = { type: 'message_deleted', data: { messageId: messageId } };
            const receiverWs = clients.get(receiver_id);
            if (receiverWs && receiverWs.readyState === WebSocket.OPEN) receiverWs.send(JSON.stringify(deletePayload));
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(deletePayload));
        }
        return;
    }
      
    if (data.type === 'edit_message') {
        const { messageId, newContent, receiver_id } = data;
        const result = await pool.query(
            "UPDATE messages SET content = $1, is_edited = TRUE WHERE id = $2 AND sender_id = $3 RETURNING *",
            [newContent, messageId, ws.userId]
        );
        if (result.rowCount > 0) {
            const payload = { type: 'message_edited', data: result.rows[0] };
            const receiverWs = clients.get(receiver_id);
            if (receiverWs && receiverWs.readyState === WebSocket.OPEN) receiverWs.send(JSON.stringify(payload));
            if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        }
        return;
    }

    if (data.type === 'typing' || data.type === 'stop_typing') {
         const receiverWs = clients.get(data.receiver_id);
         if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
           receiverWs.send(JSON.stringify({ type: data.type, sender_id: ws.userId }));
         }
         return;
    }
      
    if (data.type === 'messages_read') {
        const { chatId } = data;
        const readerId = ws.userId;
        await pool.query("UPDATE messages SET is_read = TRUE WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE", [readerId, chatId]);
        const senderWs = clients.get(chatId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
            senderWs.send(JSON.stringify({ type: 'messages_updated', data: { chatId: readerId } }));
        }
        return;
    }

    // Обработка WebRTC сигналов для звонков
    const signalingTypes = ['call-offer', 'call-answer', 'ice-candidate', 'hang-up'];
    if (signalingTypes.includes(data.type)) {
        const targetWs = clients.get(data.receiver_id);
        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
            const payload = { ...data, sender_id: ws.userId };
            targetWs.send(JSON.stringify(payload));
        }
        return;
    }
  });

  ws.on('close', async () => {
    if (ws.userId) {
      clients.delete(ws.userId);
      console.log(`Клиент ${ws.userId} отключился. Сейчас онлайн: ${clients.size}`);
      try {
        // Обновляем время последнего онлайна пользователя
        await pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [ws.userId]);
      } catch (dbError) {
        console.error("Ошибка обновления last_seen:", dbError);
      }
      // Уведомляем всех остальных клиентов, что пользователь вышел из сети
      const offlinePayload = { type: 'user_offline', userId: ws.userId, last_seen: new Date() };
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(offlinePayload));
        }
      });
    } else {
      console.log('Неаутентифицированный клиент отключился');
    }
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`Сервер (HTTP + WebSocket) запущен на порту ${PORT}`);
});