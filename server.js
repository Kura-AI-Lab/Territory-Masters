// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  // Renderなどプロキシ越しで使うなら適度に調整
  cors: { origin: "*" }
});

// 静的ファイル（/public 配下）
app.use(express.static(path.join(__dirname, "public")));

// 簡易ヘルスチェック
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ★ ルーティングのフォールバック（リロード時も index.html を返す）
app.get("*", (_req, res, next) => {
  // 既存ファイルがあれば express.static が返しているので、ここは SPA 用フォールバック
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => {
    if (err) next(err);
  });
});

// --- Socket.IO
io.on("connection", (socket) => {
  console.log("✅ ユーザー接続:", socket.id);

  // ルームに参加
  socket.on("join", ({ roomId }) => {
    socket.join(roomId);
    console.log(`👥 ${socket.id} -> ルーム ${roomId}`);
  });

  // state を部屋へ配信
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
