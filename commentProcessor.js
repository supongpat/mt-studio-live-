const pool = require("../db");
const { matchAllCF } = require("./cfMatcher");

/**
 * ประมวลผลคอมเมนต์ 1 รายการ
 * รองรับหลายรหัสในคอมเมนต์เดียว เช่น "CF A01 C01 Z02"
 * - ออกออเดอร์เฉพาะรายการที่มีของ
 * - รายการที่หมด จะถูกแยกไว้ในผลลัพธ์เพื่อแจ้งลูกค้า
 * ใช้ transaction + FOR UPDATE กันสต็อกชน
 */
async function processComment(input) {
  const { pageFbId, fbCommentId, fbPostId, fbUserId, customerName, message } = input;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pageRes = await client.query("SELECT id FROM pages WHERE facebook_page_id = $1", [pageFbId]);
    if (pageRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { status: "skip", items: [], soldOut: [], total: 0 };
    }
    const pageId = pageRes.rows[0].id;

    const logRes = await client.query(
      `INSERT INTO comment_logs (page_id, fb_comment_id, fb_post_id, facebook_user_id, raw_message)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (fb_comment_id) DO NOTHING
       RETURNING id`,
      [pageId, fbCommentId, fbPostId, fbUserId, message]
    );
    if (logRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return { status: "duplicate", items: [], soldOut: [], total: 0 };
    }
    const commentLogId = logRes.rows[0].id;

    const matches = matchAllCF(message);
    if (matches.length === 0) {
      await client.query("COMMIT");
      return { status: "skip", items: [], soldOut: [], total: 0 };
    }

    const items = [];
    const soldOut = [];

    // เรียงรหัสก่อนล็อก ลดโอกาส deadlock เวลาหลายคอมเมนต์เข้าพร้อมกัน
    const sortedCodes = matches.slice().sort((a, b) => a.code.localeCompare(b.code));
    for (const { code, quantity } of sortedCodes) {
      const productRes = await client.query(
        `SELECT id, name, price, stock_qty FROM products
         WHERE page_id = $1 AND code = $2 AND is_active = TRUE
         FOR UPDATE`,
        [pageId, code]
      );

      if (productRes.rowCount === 0 || productRes.rows[0].stock_qty < quantity) {
        soldOut.push({ code, productName: productRes.rows[0]?.name || code });
        continue;
      }

      const product = productRes.rows[0];
      await client.query("UPDATE products SET stock_qty = stock_qty - $1 WHERE id = $2", [quantity, product.id]);
      items.push({
        productId: product.id,
        code,
        productName: product.name,
        quantity,
        price: Number(product.price),
        lineTotal: Number(product.price) * quantity,
      });
    }

    const matchedCodesStr = matches.map((m) => m.code).join(",");

    if (items.length === 0) {
      await client.query("UPDATE comment_logs SET matched_code = $1 WHERE id = $2", [matchedCodesStr, commentLogId]);
      await client.query("COMMIT");
      return { status: "none", items: [], soldOut, total: 0 };
    }

    const customerRes = await client.query(
      `INSERT INTO customers (facebook_user_id, page_id, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (page_id, facebook_user_id) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [fbUserId, pageId, customerName || null]
    );
    const customerId = customerRes.rows[0].id;

    const total = items.reduce((s, it) => s + it.lineTotal, 0);

    const orderRes = await client.query(
      `INSERT INTO orders (page_id, customer_id, comment_log_id, total_amount)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [pageId, customerId, commentLogId, total]
    );
    const orderId = orderRes.rows[0].id;

    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, code, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, it.productId, it.code, it.productName, it.quantity, it.price]
      );
    }

    await client.query(
      "UPDATE comment_logs SET matched_code = $1, is_order_created = TRUE WHERE id = $2",
      [matchedCodesStr, commentLogId]
    );

    await client.query("COMMIT");
    return { status: "order", items, soldOut, total };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { processComment };
