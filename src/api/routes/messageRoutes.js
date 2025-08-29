// backend/src/api/routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../../middleware/authMiddleware');

router.use(protect);

router.post('/', messageController.sendMessage);
router.get('/:userId', messageController.getMessages);
router.delete('/:id', messageController.deleteMessage); // Маршрут для удаления

module.exports = router;