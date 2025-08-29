// backend/src/api/controllers/userController.js
const pool = require('../../config/db');
const bcrypt = require('bcryptjs');

// @desc    Получить полные данные текущего пользователя (включая настройки)
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await pool.query('SELECT id, username, email, profile_picture_url, bio, created_at, settings FROM users WHERE id = $1', [req.user.id]);
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// @desc    Получить всех пользователей c последним сообщением, аватаром и статусом
// @route   GET /api/users
// @access  Private
const getAllUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const users = await pool.query(
            `SELECT 
                u.id, 
                u.username,
                u.profile_picture_url,
                u.last_seen,
                (SELECT content FROM messages WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
                (SELECT created_at FROM messages WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message_time
            FROM users u
            WHERE u.id != $1
            ORDER BY last_message_time DESC NULLS LAST, u.username ASC`,
            [currentUserId]
        );
        res.json(users.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка сервера');
    }
};

// @desc    Обновить профиль пользователя (имя, bio)
// @route   PUT /api/users/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  const { username, bio } = req.body;
  
  try {
    const updatedUser = await pool.query(
      'UPDATE users SET username = $1, bio = $2 WHERE id = $3 RETURNING id, username, email, profile_picture_url, bio',
      [username, bio, req.user.id]
    );
    res.json(updatedUser.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// @desc    Обновить фото профиля
// @route   PUT /api/users/profile/picture
// @access  Private
const updateProfilePicture = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Файл не загружен' });
  }
  
  try {
    const filename = req.file.filename;
    const updatedUser = await pool.query(
      'UPDATE users SET profile_picture_url = $1 WHERE id = $2 RETURNING id, username, email, profile_picture_url, bio',
      [filename, req.user.id]
    );
    res.json(updatedUser.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// @desc    Получить публичный профиль пользователя по ID
// @route   GET /api/users/:id
// @access  Private
const getUserById = async (req, res) => {
  try {
    const user = await pool.query(
      'SELECT id, username, profile_picture_url, bio, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (user.rows.length === 0) {
      return res.status(404).json({ message: 'Пользователь не найден' });
    }
    res.json(user.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Ошибка сервера');
  }
};

// @desc    Обновить настройки пользователя (тема, звук и т.д.)
// @route   PUT /api/users/settings
// @access  Private
const updateUserSettings = async (req, res) => {
    const newSettings = req.body;
    try {
        const result = await pool.query('SELECT settings FROM users WHERE id = $1', [req.user.id]);
        const currentSettings = result.rows[0].settings || {};
        // Сливаем старые и новые настройки, новые перезаписывают старые
        const updatedSettings = { ...currentSettings, ...newSettings };

        await pool.query('UPDATE users SET settings = $1 WHERE id = $2', [updatedSettings, req.user.id]);
        res.json(updatedSettings);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка сервера');
    }
};

// @desc    Сменить пароль
// @route   PUT /api/users/password
// @access  Private
const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: 'Все поля обязательны' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Новый пароль должен быть не менее 6 символов' });
    }

    try {
        const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'Пользователь не найден' });
        }
        
        const isMatch = await bcrypt.compare(oldPassword, userResult.rows[0].password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Старый пароль неверен' });
        }

        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(newPassword, salt);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, req.user.id]);
        
        res.json({ message: 'Пароль успешно изменен' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Ошибка сервера');
    }
};


module.exports = {
  getMe,
  getAllUsers,
  updateUserProfile,
  updateProfilePicture,
  getUserById,
  updateUserSettings,
  changePassword,
};