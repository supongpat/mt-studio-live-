require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const webhookRoutes = require("./routes/webhook");
const simulateRoutes = require("./routes/simulate");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const pageRoutes = require("./routes/pages");
const commentLogRoutes = require("./routes/commentLogs");
const bankAccountRoutes = require("./routes/bankAccount");
const reminderRoutes = require("./routes/reminders");

const app = express();
app.use(cors());
app.use(express.json());

// หน้าเว็บแดชบอร์ด (HTML+JS ธรรมดา ไม่ต้อง build)
app.use(express.static(path.join(__dirname, "public")));

// Facebook ยิง webhook มาที่นี่ (ของจริง)
app.use("/webhook", webhookRoutes);

// API สำหรับหน้าเว็บแดชบอร์ด
app.use("/api/simulate-comment", simulateRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/pages", pageRoutes);
app.use("/api/comment-logs", commentLogRoutes);
app.use("/api/bank-account", bankAccountRoutes);
app.use("/api/reminders", reminderRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
