const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");

const parwaRoutes = require("./routes/parwaRoute");
const authRoutes = require("./routes/authRoute");
const userRoutes = require("./routes/userRoute");
const userAdminRoutes = require("./routes/userAdminRoute");
const chatRoutes = require("./routes/chatRoute");

require("dotenv").config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use((req, res, next) => {
  console.log(`\n📥 [REQUEST MASUK] ${req.method} ${req.url}`);
  console.log("📦 Body:", JSON.stringify(req.body, null, 2));
  next();
});

app.get("/", (req, res) =>
  res.json({ status: "ok", service: "asta-dasa-backend" })
);

app.use("/api/parwa", parwaRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin/users", userAdminRoutes);
app.use("/api/chat", chatRoutes);

const port = process.env.PORT || 5000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
  console.log(`📡 Listening on all interfaces (0.0.0.0)`);
});