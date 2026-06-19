const { Pool } = require("pg");

// DATABASE_URL จะถูกเซตให้อัตโนมัติโดย hosting (เช่น Railway) ตอนเราเพิ่ม Postgres
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway") ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
