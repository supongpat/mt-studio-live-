const express = require("express");
const pool = require("../db");
const { processComment } = require("../services/commentProcessor");
const router = express.Router();

// ใช้ทดสอบระบบจับ CF โดยไม่ต้องรอ Facebook App Review ผ่านก่อน
// body: { customerName: "ทดสอบ", message: "CF A01 2 ตัว" }
router.post("/", async (req, res) => {
  const pageRes = await pool.query("SELECT facebook_page_id FROM pages ORDER BY id LIMIT 1");
  if (pageRes.rowCount === 0) {
    return res.status(400).json({ error: "ยังไม่ได้ตั้งค่าเพจ กรุณาไปที่หน้าตั้งค่าก่อน" });
  }

  const { customerName, message } = req.body;
  if (!message) return res.status(400).json({ error: "ต้องมีข้อความคอมเมนต์" });

  const result = await processComment({
    pageFbId: pageRes.rows[0].facebook_page_id,
    fbCommentId: "sim-" + Date.now() + "-" + Math.random().toString(36).slice(2),
    fbPostId: "sim-post",
    fbUserId: "sim-user-" + Math.random().toString(36).slice(2),
    customerName: customerName || "ลูกค้าทดสอบ",
    message,
  });

  res.json(result);
});

module.exports = router;
