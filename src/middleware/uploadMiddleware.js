// backend/src/middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');

// Настройка хранилища
const storage = multer.diskStorage({
  // Указываем папку для сохранения файлов
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  // Формируем имя файла
  filename: function (req, file, cb) {
    // Создаем уникальное имя: user-<id>-<timestamp>.<extension>
    const uniqueSuffix = req.user.id + '-' + Date.now() + path.extname(file.originalname);
    cb(null, 'user-' + uniqueSuffix);
  }
});

// Фильтр для проверки типа файла (принимаем только изображения)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Неверный тип файла, разрешены только изображения!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5 // Лимит размера файла: 5 МБ
  }
});

module.exports = upload;