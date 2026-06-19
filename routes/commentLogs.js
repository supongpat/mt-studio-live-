const express = require("express");
const pool = require("../db");
const router = express.Router();

// ดึงคอมเมนต์ล่าสุดพร้อมผลออเดอร์ (รองรับหลายรายการต่อคอมเมนต์) เพื่อโชว์ในฟีดหน้าเว็บ
router.get("/", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
  const logsRes = await pool.query(
    `SELECT cl.id, cl.raw_message AS message, cl.matched_code, cl.is_order_created,
            cl.received_at AS time,
            COALESCE(c.display_name, 'ลูกค้า') AS customer_name,
            o.id AS order_id, o.total_amount AS total
     FROM comment_logs cl
     LEFT JOIN orders o ON o.comment_log_id = cl.id
     LEFT JOIN customers c ON c.facebook_user_id = cl.facebook_user_id AND c.page_id = cl.page_id
     ORDER BY cl.received_at DESC
     LIMIT $1`,
    [limit]
  );

  const orderIds = logsRes.rows.filter((r) => r.order_id).map((r) => r.order_id);
  let itemsByOrder = {};
  if (orderIds.length) {
    const itemsRes = await pool.query(
      `SELECT order_id, code, product_name, quantity, unit_price
       FROM order_items WHERE order_id = ANY($1) ORDER BY id`,
      [orderIds]
    );
    for (const it of itemsRes.rows) {
      (itemsByOrder[it.order_id] = itemsByOrder[it.order_id] || []).push(it);
    }
  }

  res.json(logsRes.rows.map((r) => ({
    id: r.id,
    message: r.message,
    customer_name: r.customer_name,
    is_order_created: r.is_order_created,
    time: r.time,
    total: r.total,
    items: r.order_id ? itemsByOrder[r.order_id] || [] : [],
  })));
});

module.exports = router;
