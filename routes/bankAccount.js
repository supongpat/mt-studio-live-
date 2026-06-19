const express = require("express");
const pool = require("../db");
const router = express.Router();

async function getPageId() {
  const r = await pool.query("SELECT id FROM pages ORDER BY id LIMIT 1");
  return r.rows[0]?.id || null;
}

// ดูบัญชีรับเงินที่ตั้งไว้
router.get("/", async (req, res) => {
  const pageId = await getPageId();
  if (!pageId) return res.json(null);
  const result = await pool.query(
    "SELECT bank_name, account_number, account_name, promptpay_id FROM bank_accounts WHERE page_id = $1",
    [pageId]
  );
  res.json(result.rows[0] || null);
});

// ตั้งค่า/แก้ไขบัญชีรับเงิน (1 เพจมีได้ 1 บัญชี)
router.post("/", async (req, res) => {
  const pageId = await getPageId();
  if (!pageId) return res.status(400).json({ error: "ยังไม่ได้ตั้งค่าเพจ Facebook กรุณาตั้งค่าก่อน" });

  const { bank_name, account_number, account_name, promptpay_id } = req.body;
  if (!bank_name || !account_number || !account_name) {
    return res.status(400).json({ error: "กรอกชื่อธนาคาร เลขบัญชี และชื่อบัญชีให้ครบ" });
  }

  await pool.query(
    `INSERT INTO bank_accounts (page_id, bank_name, account_number, account_name, promptpay_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (page_id) DO UPDATE SET
       bank_name = EXCLUDED.bank_name,
       account_number = EXCLUDED.account_number,
       account_name = EXCLUDED.account_name,
       promptpay_id = EXCLUDED.promptpay_id,
       updated_at = NOW()`,
    [pageId, bank_name, account_number, account_name, promptpay_id || null]
  );
  res.json({ ok: true });
});

module.exports = router;
