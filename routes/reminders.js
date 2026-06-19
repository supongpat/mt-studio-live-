const express = require("express");
const pool = require("../db");
const router = express.Router();

async function getPage() {
  const r = await pool.query("SELECT id, reminder_message FROM pages ORDER BY id LIMIT 1");
  return r.rows[0] || null;
}

// รายชื่อออเดอร์ที่ยังไม่โอน (ค้างชำระ) พร้อมเวลาที่ค้างและจำนวนครั้งที่ทวงไปแล้ว
router.get("/unpaid", async (req, res) => {
  const ordersRes = await pool.query(`
    SELECT o.id, o.total_amount AS total, o.created_at AS time,
           o.reminder_count, o.last_reminded_at,
           EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutes_waiting,
           COALESCE(c.display_name, 'ลูกค้า') AS customer_name
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 'pending'
    ORDER BY o.created_at ASC
  `);

  if (ordersRes.rowCount === 0) return res.json([]);

  const ids = ordersRes.rows.map((o) => o.id);
  const itemsRes = await pool.query(
    "SELECT order_id, code, product_name, quantity FROM order_items WHERE order_id = ANY($1) ORDER BY id",
    [ids]
  );
  const itemsByOrder = {};
  for (const it of itemsRes.rows) {
    (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(it);
  }

  res.json(ordersRes.rows.map((o) => ({
    ...o,
    minutes_waiting: Math.round(o.minutes_waiting),
    items: itemsByOrder[o.id] || [],
  })));
});

/**
 * ส่งทวงยอด 1 ออเดอร์
 * บันทึกว่าทวงแล้ว + คืนข้อความที่จะส่งให้ลูกค้า
 * (เมื่อ Facebook App ผ่าน review แล้ว ตรงนี้จะยิงข้อความเข้า Messenger จริง)
 */
router.post("/:id/remind", async (req, res) => {
  const page = await getPage();
  const orderRes = await pool.query(
    `SELECT o.id, o.total_amount, COALESCE(c.display_name,'ลูกค้า') AS customer_name
     FROM orders o JOIN customers c ON c.id = o.customer_id
     WHERE o.id = $1 AND o.status = 'pending'`,
    [req.params.id]
  );
  if (orderRes.rowCount === 0) {
    return res.status(404).json({ error: "ไม่พบออเดอร์ค้างชำระนี้ (อาจโอนแล้ว)" });
  }
  const order = orderRes.rows[0];

  await pool.query(
    "UPDATE orders SET reminder_count = reminder_count + 1, last_reminded_at = NOW() WHERE id = $1",
    [order.id]
  );

  const message = `${page?.reminder_message || "กรุณาโอนยอดด้วยนะคะ"} (ยอดค้าง ฿${Number(order.total_amount).toLocaleString()})`;

  // TODO: เมื่อมีสิทธิ์ pages_messaging แล้ว เรียก Facebook Send API ที่นี่
  res.json({ ok: true, customer_name: order.customer_name, message });
});

// ทวงทุกออเดอร์ที่ค้างรวดเดียว
router.post("/remind-all", async (req, res) => {
  const page = await getPage();
  const unpaid = await pool.query("SELECT id FROM orders WHERE status = 'pending'");
  await pool.query(
    "UPDATE orders SET reminder_count = reminder_count + 1, last_reminded_at = NOW() WHERE status = 'pending'"
  );
  res.json({ ok: true, count: unpaid.rowCount, message: page?.reminder_message || "กรุณาโอนยอดด้วยนะคะ" });
});

// แก้ข้อความทวงเริ่มต้น
router.put("/message", async (req, res) => {
  const page = await getPage();
  if (!page) return res.status(400).json({ error: "ยังไม่ได้ตั้งค่าเพจ" });
  await pool.query("UPDATE pages SET reminder_message = $1 WHERE id = $2", [req.body.message, page.id]);
  res.json({ ok: true });
});

module.exports = router;
