// backend/src/middleware/uploadMiddleware.js
const multer = require('multer');
const { storage } = require('../config/cloudinary'); // Импортируем наше хранилище из Cloudinary

// -----------------------------------------------------------------------------
// ИЗМЕНЕНИЯ:
// Вместо локального хранилища (multer.diskStorage) теперь используется
// настроенное хранилище Cloudinary. Multer автоматически передаст
// файл в облако и вернет нам URL в req.file.path.
// -----------------------------------------------------------------------------

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 10 // Лимит размера файла увеличен до 10 МБ
  }
});

module.exports = upload;