// backend/src/api/controllers/photoController.js
const pool = require('../../config/db');

// Загрузить новое фото в галерею
exports.uploadPhoto = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Файл не загружен' });
    }
    try {
        // ---------------------------------------------------------------------
        // ИЗМЕНЕНО: Получаем полный URL из req.file.path
        // ---------------------------------------------------------------------
        const imageUrl = req.file.path;

        await pool.query(
            'INSERT INTO user_photos (user_id, photo_url) VALUES ($1, $2)',
            [req.user.id, imageUrl] // Сохраняем в БД полный URL
        );
        // Возвращаем на фронтенд тоже полный URL
        res.status(201).json({ message: 'Фото успешно загружено', filename: imageUrl });
    } catch (err) { 
        console.error("Ошибка при загрузке фото:", err);
        res.status(500).send('Ошибка сервера'); 
    }
};

// Получить все фото пользователя
exports.getUserPhotos = async (req, res) => {
    try {
        const photos = await pool.query(
            'SELECT id, photo_url, created_at FROM user_photos WHERE user_id = $1 ORDER BY created_at DESC',
            [req.params.id]
        );
        res.json(photos.rows);
    } catch (err) { 
        console.error("Ошибка при получении фото:", err);
        res.status(500).send('Ошибка сервера'); 
    }
};