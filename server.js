const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Render のリバースプロキシ越しでも安定するように心持ち設定
  pingTimeout: 30000,
  pingInterval: 25000
});

// 静的ファイル配信（public/index.html など）
app.use(express.static(path.join(__dirname, "public")));

// Socket.IO
io.on("connection", (socket) => {
  console.log("✅ ユーザー接続:", socket.id);

  socket.on("join", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log(`👥 ${socket.id} -> ルーム ${roomId}`);
  });

  socket.on("state", ({ roomId, state }) => {
    if (!roomId) return;
    // 同じ部屋の“自分以外へ”配信
    socket.to(roomId).emit("state", { state });
  });

  socket.on("disconnect", () => {
    console.log("❌ ユーザー切断:", socket.id);
  });
});

// Render では PORT が環境変数で来る
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});
