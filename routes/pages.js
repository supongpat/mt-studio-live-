const express = require("express");
const pool = require("../db");
const router = express.Router();

// ระบบนี้ออกแบบไว้สำหรับ "1 ร้าน = 1 เพจ" ถ้าจะรองรับหลายเพจ ต้องเพิ่ม auth/user แยกทีหลัง

// ดูข้อมูลเพจที่ตั้งค่าไว้
router.get("/", async (req, res) => {
  const result = await pool.query("SELECT id, facebook_page_id, page_name, is_active FROM pages ORDER BY id LIMIT 1");
  res.json(result.rows[0] || null);
});

// ตั้งค่า/แก้ไขเพจ (เก็บ Page ID + Access Token ที่ได้จาก Meta for Developers)
router.post("/", async (req, res) => {
  const { facebook_page_id, page_name, access_token } = req.body;
  if (!facebook_page_id || !access_token) {
    return res.status(400).json({ error: "ต้องระบุ facebook_page_id และ access_token" });
  }

  const existing = await pool.query("SELECT id FROM pages WHERE facebook_page_id = $1", [facebook_page_id]);
  if (existing.rowCount > 0) {
    await pool.query(
      "UPDATE pages SET page_name = $1, access_token = $2, is_active = TRUE WHERE facebook_page_id = $3",
      [page_name, access_token, facebook_page_id]
    );
  } else {
    await pool.query(
      "INSERT INTO pages (facebook_page_id, page_name, access_token) VALUES ($1, $2, $3)",
      [facebook_page_id, page_name, access_token]
    );
  }
  res.json({ ok: true });
});

module.exports = router;
