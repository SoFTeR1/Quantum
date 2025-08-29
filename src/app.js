// backend/src/app.js

const express = require('express');
const cors = require('cors');
const path = require('path'); // Импортируем встроенный модуль 'path'

const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://127.0.0.1:8080',
    'http://localhost:8080', // <--- ДОБАВЬТЕ ЭТУ ЗАПЯТУЮ
    'https://quantum-opal.vercel.app' 
  ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- ВАЖНО: Делаем папку 'uploads' статической (публичной) ---
// Это позволит фронтенду запрашивать картинки по URL
// Например: http://localhost:5001/uploads/user-1-1678886400000.jpg
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Базовый маршрут для проверки
app.get('/', (req, res) => {
  res.send('API мессенджера работает!');
});

// Подключение всех наших маршрутов
const authRoutes = require('./api/routes/authRoutes');
const userRoutes = require('./api/routes/userRoutes');
const messageRoutes = require('./api/routes/messageRoutes');
const photoRoutes = require('./api/routes/photoRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/photos', photoRoutes);


module.exports = app;