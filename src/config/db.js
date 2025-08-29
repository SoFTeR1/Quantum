// src/config/db.js

const { Pool } = require('pg');
require('dotenv').config();

const connectionConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Это необходимо для подключения к базам данных на Render
  }
} : {
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
};

const pool = new Pool(connectionConfig);

const checkDbConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Успешное подключение к базе данных PostgreSQL!');
    client.release();
  } catch (err) {
    console.error('ОШИБКА ПОДКЛЮЧЕНИЯ К БАЗЕ ДАННЫХ:', err.message);
  }
};

checkDbConnection();

module.exports = pool;