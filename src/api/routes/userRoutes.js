// backend/src/api/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const photoController = require('../controllers/photoController'); // Импортируем
const { protect } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');

router.use(protect);

router.get('/', userController.getAllUsers);
router.get('/me', userController.getMe);
router.put('/profile', userController.updateUserProfile);
router.put('/profile/picture', upload.single('avatar'), userController.updateProfilePicture);
router.put('/settings', userController.updateUserSettings); // Новый маршрут
router.put('/password', userController.changePassword); // Новый маршрут

router.get('/:id', userController.getUserById);
router.get('/:id/photos', photoController.getUserPhotos); // Новый маршрут

module.exports = router;