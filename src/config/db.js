// src/config/db.js

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Новый, более надежный способ проверки соединения
const checkDbConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Успешное подключение к базе данных PostgreSQL!');
    client.release(); // Возвращаем клиента обратно в пул
  } catch (err) {
    console.error('ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ:');
    console.error(err.message);
  }
};

// Запускаем проверку
checkDbConnection();

module.exports = pool;