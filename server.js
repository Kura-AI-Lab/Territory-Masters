const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// クライアントを配信
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  console.log("✅ ユーザー接続:", socket.id);

  // ルームに参加
  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
    console.log(`👥 ${socket.id} -> ルーム ${roomId}`);
  });

  // ゲーム状態をブロードキャスト
  socket.on("state", ({ roomId, state }) => {
    socket.to(roomId).emit("state", { state });
  });

  socket.on("disconnect", () => {
    console.log("❌ ユーザー切断:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT}`);
});
