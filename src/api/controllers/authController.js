// backend/src/api/controllers/authController.js

const pool = require('../../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Утилитарная функция для генерации пары токенов
const generateTokens = (userId) => {
  // Access токен живёт недолго (15 минут), используется для частых запросов к API
  const accessToken = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  // Refresh токен живёт долго (7 дней), используется только для получения нового access токена
  const refreshToken = jwt.sign({ id: userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

// @desc    Регистрация нового пользователя
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  // Простая валидация
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Пожалуйста, заполните все поля' });
  }

  try {
    // Проверяем, не занят ли email или username
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'Пользователь с таким email или username уже существует' });
    }

    // Хешируем пароль
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Сохраняем пользователя в базу данных
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at',
      [username, email, password_hash]
    );

    // Отправляем успешный ответ с данными нового пользователя (без пароля)
    res.status(201).json(newUser.rows[0]);

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};


// @desc    Аутентификация пользователя (вход)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Пожалуйста, введите email и пароль' });
  }

  try {
    // Ищем пользователя по email
    const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }

    const user = userResult.rows[0];

    // Сравниваем введенный пароль с хешем в базе данных
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (isMatch) {
      // Пароли совпали, создаем оба токена
      const { accessToken, refreshToken } = generateTokens(user.id);

      // Сохраняем refresh token в БД для безопасности.
      // Это позволяет нам "отозвать" сессию пользователя, просто удалив токен из БД.
      await pool.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);
      
      // Отправляем оба токена на клиент
      res.json({
        message: 'Вход выполнен успешно!',
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        }
      });
    } else {
      // Пароли не совпали
      return res.status(401).json({ message: 'Неверные учетные данные' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// @desc    Обновление access токена с помощью refresh токена
// @route   POST /api/auth/refresh
// @access  Public
const refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(401).json({ message: 'Refresh токен не предоставлен' });
  }

  try {
    // Ищем пользователя с таким refresh токеном в базе
    const userResult = await pool.query('SELECT * FROM users WHERE refresh_token = $1', [token]);
    if (userResult.rows.length === 0) {
      // Если токена нет в базе, он недействителен (возможно, пользователь вышел)
      return res.status(403).json({ message: 'Недействительный refresh токен' });
    }
    
    const user = userResult.rows[0];
    
    // Проверяем валидность refresh токена
    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, (err, decoded) => {
      if (err || user.id !== decoded.id) {
        return res.status(403).json({ message: 'Ошибка верификации токена' });
      }
      
      // Если все в порядке, генерируем и отправляем новый access токен
      const { accessToken } = generateTokens(user.id);
      res.json({ accessToken });
    });
  } catch (dbError) {
    console.error("Ошибка при обновлении токена:", dbError.message);
    res.status(500).send('Ошибка сервера');
  }
};

// @desc    Выход из системы
// @route   POST /api/auth/logout
// @access  Public
const logoutUser = async (req, res) => {
    const { token } = req.body; // Ожидаем refresh token
    if (!token) {
        return res.sendStatus(204); // No Content
    }
    try {
        // Удаляем refresh token из базы данных, делая его недействительным
        await pool.query('UPDATE users SET refresh_token = NULL WHERE refresh_token = $1', [token]);
        res.status(204).send('Выход выполнен успешно');
    } catch (dbError) {
        console.error("Ошибка при выходе:", dbError.message);
        res.status(500).send('Ошибка сервера');
    }
};


module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
};