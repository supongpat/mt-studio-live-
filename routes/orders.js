const express = require("express");
const pool = require("../db");
const router = express.Router();

// รายการออเดอร์ล่าสุด พร้อมรายการสินค้าในแต่ละออเดอร์
router.get("/", async (req, res) => {
  const ordersRes = await pool.query(`
    SELECT o.id, o.total_amount AS total, o.status, o.created_at AS time,
           COALESCE(c.display_name, 'ลูกค้า') AS customer_name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    ORDER BY o.created_at DESC
    LIMIT 200
  `);

  if (ordersRes.rowCount === 0) return res.json([]);

  const ids = ordersRes.rows.map((o) => o.id);
  const itemsRes = await pool.query(
    `SELECT order_id, code, product_name, quantity, unit_price
     FROM order_items WHERE order_id = ANY($1) ORDER BY id`,
    [ids]
  );

  const itemsByOrder = {};
  for (const it of itemsRes.rows) {
    (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(it);
  }

  res.json(ordersRes.rows.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })));
});

// อัปเดตสถานะออเดอร์ (เช่น ยืนยันชำระเงิน)
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  await pool.query(
    "UPDATE orders SET status = $1, paid_at = CASE WHEN $1 = 'paid' THEN NOW() ELSE paid_at END WHERE id = $2",
    [status, req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
