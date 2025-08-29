// src/api/routes/authRoutes.js

const express = require('express');
const router = express.Router();
// Обнови эту строку, чтобы импортировать обе функции
const { registerUser, loginUser } = require('../controllers/authController');

// http://localhost:5001/api/auth/register
router.post('/register', registerUser);

// http://localhost:5001/api/auth/login  <--- ДОБАВЬ ЭТУ СТРОКУ
router.post('/login', loginUser);

module.exports = router;