const express = require("express");
const pool = require("../db");
const router = express.Router();

async function getPageId() {
  const r = await pool.query("SELECT id FROM pages ORDER BY id LIMIT 1");
  return r.rows[0]?.id || null;
}

// รายการสินค้าทั้งหมดของเพจ
router.get("/", async (req, res) => {
  const pageId = await getPageId();
  if (!pageId) return res.json([]);
  const result = await pool.query(
    "SELECT code, name, price, stock_qty AS stock FROM products WHERE page_id = $1 AND is_active = TRUE ORDER BY code",
    [pageId]
  );
  res.json(result.rows);
});

// เพิ่มสินค้าใหม่
router.post("/", async (req, res) => {
  const pageId = await getPageId();
  if (!pageId) return res.status(400).json({ error: "ยังไม่ได้ตั้งค่าเพจ Facebook กรุณาตั้งค่าก่อน" });

  const { code, name, price, stock } = req.body;
  if (!code || !name || price == null) {
    return res.status(400).json({ error: "กรอกรหัส ชื่อ และราคาให้ครบ" });
  }
  if (!/^[A-Za-z]{1,3}\d{1,4}$/.test(code)) {
    return res.status(400).json({ error: "รหัสต้องเป็นรูปแบบ A01, B12 เท่านั้น" });
  }

  try {
    await pool.query(
      "INSERT INTO products (page_id, code, name, price, stock_qty) VALUES ($1, $2, $3, $4, $5)",
      [pageId, code.toUpperCase(), name, price, stock || 0]
    );
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: `รหัส ${code} มีอยู่แล้ว` });
    }
    throw err;
  }
});

// แก้จำนวนสต็อก
router.patch("/:code/stock", async (req, res) => {
  const pageId = await getPageId();
  const { stock } = req.body;
  await pool.query(
    "UPDATE products SET stock_qty = $1 WHERE page_id = $2 AND code = $3",
    [Math.max(0, parseInt(stock, 10) || 0), pageId, req.params.code.toUpperCase()]
  );
  res.json({ ok: true });
});

// ลบสินค้า (soft delete)
router.delete("/:code", async (req, res) => {
  const pageId = await getPageId();
  await pool.query(
    "UPDATE products SET is_active = FALSE WHERE page_id = $1 AND code = $2",
    [pageId, req.params.code.toUpperCase()]
  );
  res.json({ ok: true });
});

module.exports = router;
