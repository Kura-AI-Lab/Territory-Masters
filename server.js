// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO（Render 環境でも安定する程度に）
const io = new Server(server, {
  pingTimeout: 30000,
  pingInterval: 25000,
});

// 逆プロキシ配下（Render）向け
app.set("trust proxy", 1);

// ---- 静的配信（/public 以下と /socket.io/socket.io.js を配る）----
app.use(express.static(path.join(__dirname, "public")));

// ヘルスチェック（任意）
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// ---- SPA フォールバック（重要：/socket.io/* は除外する）----
// Express v5 では "*" の扱いが厳しくなったので、正規表現で安全に。
app.get(/^\/(?!socket\.io\/).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ---- Socket.IO ----
io.on("connection", (socket) => {
  console.log("✅ ユーザー接続:", socket.id);

  // ルーム参加
  socket.on("join", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log(`👥 ${socket.id} がルーム "${roomId}" に参加`);
  });

  // 盤面 state を同じ部屋の「自分以外」へブロードキャスト
  socket.on("state", ({ roomId, state }) => {
    if (!roomId) return;
    socket.to(roomId).emit("state", { state });
  });

  // 終局結果を中継（モーダルの「閉じる」は各自クライアント側で処理）
  socket.on("end", ({ roomId, result }) => {
    if (!roomId) return;
    socket.to(roomId).emit("end", { result });
  });

  socket.on("disconnect", () => {
    console.log("❌ ユーザー切断:", socket.id);
  });
});

// Render では PORT が環境変数で来る
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
