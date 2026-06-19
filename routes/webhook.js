const express = require("express");
const { processComment } = require("../services/commentProcessor");
const router = express.Router();

// ขั้นตอน verify ตอนสมัคร Webhook ใน Meta for Developers (Facebook จะยิง GET มาครั้งแรก)
router.get("/facebook", (req, res) => {
  const VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Facebook ส่ง event คอมเมนต์จริงมาที่นี่
router.post("/facebook", async (req, res) => {
  res.sendStatus(200); // ตอบ 200 ให้เร็วก่อน ไม่งั้น Facebook retry รัวๆ

  try {
    const entries = req.body.entry || [];
    for (const entry of entries) {
      const pageFbId = entry.id;
      for (const change of entry.changes || []) {
        if (change.field !== "feed") continue;
        const value = change.value;
        if (value.item !== "comment" || value.verb === "remove") continue;

        await processComment({
          pageFbId,
          fbCommentId: value.comment_id,
          fbPostId: value.post_id,
          fbUserId: value.from?.id,
          customerName: value.from?.name,
          message: value.message,
        });
      }
    }
  } catch (err) {
    console.error("Facebook webhook error:", err);
  }
});

module.exports = router;
