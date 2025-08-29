// backend/src/api/controllers/photoController.js
const pool = require('../../config/db');

// Загрузить новое фото в галерею
exports.uploadPhoto = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Файл не загружен' });
    try {
        await pool.query(
            'INSERT INTO user_photos (user_id, photo_url) VALUES ($1, $2)',
            [req.user.id, req.file.filename]
        );
        res.status(201).json({ message: 'Фото успешно загружено', filename: req.file.filename });
    } catch (err) { res.status(500).send('Ошибка сервера'); }
};

// Получить все фото пользователя
exports.getUserPhotos = async (req, res) => {
    try {
        const photos = await pool.query(
            'SELECT id, photo_url, created_at FROM user_photos WHERE user_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(photos.rows);
    } catch (err) { res.status(500).send('Ошибка сервера'); }
};