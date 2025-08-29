// backend/src/api/controllers/messageController.js
const pool = require('../../config/db');

// Функция для проверки и добавления столбца, если он не существует
const addColumnIfNotExists = async (tableName, columnName, columnType) => {
    const check = await pool.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
        [tableName, columnName]
    );
    if (check.rowCount === 0) {
        // Оборачиваем ALTER TABLE в try-catch на случай, если столбец добавляется параллельно
        try {
            await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
            console.log(`Столбец ${columnName} добавлен в таблицу ${tableName}.`);
        } catch (alterError) {
            console.log(`Столбец ${columnName} уже существует или произошла ошибка.`);
        }
    }
};

// Проверяем и добавляем все нужные столбцы при запуске
(async () => {
    try {
        await addColumnIfNotExists('messages', 'is_read', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('messages', 'is_edited', 'BOOLEAN DEFAULT FALSE');
        await addColumnIfNotExists('messages', 'reply_to_message_id', 'INTEGER REFERENCES messages(id)');
    } catch (err) {
        console.error("Ошибка при проверке/добавлении столбцов:", err);
    }
})();

// Отправка сообщения (эта функция не используется WebSocket'ом, но полезна для API)
exports.sendMessage = async (req, res) => {
  const { receiver_id, content } = req.body;
  const sender_id = req.user.id;

  if (!receiver_id || !content) {
    return res.status(400).json({ message: 'Необходимо указать получателя и текст сообщения' });
  }

  try {
    const newMessage = await pool.query(
      'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING *',
      [sender_id, receiver_id, content]
    );
    res.status(201).json(newMessage.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// Получение истории переписки
exports.getMessages = async (req, res) => {
  const otherUserId = req.params.userId;
  const currentUserId = req.user.id;
  try {
    const conversation = await pool.query(
      `SELECT 
         m.id, m.sender_id, m.receiver_id, m.content, m.type, m.created_at, m.is_deleted, m.is_edited, m.is_read,
         replied_msg.content AS reply_to_content,
         reply_author.username AS reply_to_username
       FROM messages m
       LEFT JOIN messages replied_msg ON m.reply_to_message_id = replied_msg.id
       LEFT JOIN users reply_author ON replied_msg.sender_id = reply_author.id
       WHERE ( (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1) )
       ORDER BY m.created_at ASC`,
      [currentUserId, otherUserId]
    );
    res.json(conversation.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// Удаление сообщения через REST API
exports.deleteMessage = async (req, res) => {
  const messageId = req.params.id;
  const currentUserId = req.user.id;
  try {
    const result = await pool.query(
      'UPDATE messages SET is_deleted = TRUE, content = \'Сообщение удалено\', type = \'text\' WHERE id = $1 AND sender_id = $2 RETURNING *',
      [messageId, currentUserId]
    );
    if (result.rowCount === 0) {
      return res.status(403).json({ message: "Вы не можете удалить это сообщение" });
    }
    res.json({ message: "Сообщение удалено", messageId: messageId });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};