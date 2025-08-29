// backend/src/api/routes/photoRoutes.js
const express = require('express');
const router = express.Router();
const photoController = require('../controllers/photoController');
const { protect } = require('../../middleware/authMiddleware');
const upload = require('../../middleware/uploadMiddleware');

router.use(protect);

router.route('/')
    .post(upload.single('photo'), photoController.uploadPhoto);

// Этот маршрут должен быть в userRoutes, чтобы не было конфликта
// router.get('/user/:id', photoController.getUserPhotos);

module.exports = router;