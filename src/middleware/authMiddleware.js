// src/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const protect = async (req, res, next) => {
  let token;

  // Проверяем, есть ли заголовок Authorization и начинается ли он с "Bearer"
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Получаем токен из заголовка (убираем "Bearer ")
      token = req.headers.authorization.split(' ')[1];

      // 2. Верифицируем (проверяем) токен
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Находим пользователя в БД по ID из токена и добавляем его в объект запроса (req)
      // Мы исключаем пароль из результата для безопасности
      const userResult = await pool.query('SELECT id, username, email FROM users WHERE id = $1', [decoded.id]);
      
      if(userResult.rows.length === 0) {
        return res.status(401).json({ message: 'Пользователь не найден' });
      }

      req.user = userResult.rows[0];

      // 4. Передаем управление следующему middleware или контроллеру
      next();

    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Нет авторизации, токен недействителен' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Нет авторизации, нет токена' });
  }
};

module.exports = { protect };