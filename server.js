// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO（Render でも安定する程度にタイムアウト調整）
const io = new Server(server, {
  pingTimeout: 30000,   // クライアント無応答を待つ時間
  pingInterval: 25000,  // ping 間隔
});

// 逆プロキシ配下（Render）向けのヘッダ信頼
app.set("trust proxy", 1);

// 静的ファイル配信（public/index.html, /socket.io/socket.io.js も自動提供）
app.use(express.static(path.join(__dirname, "public")));

// 簡易ヘルスチェック（任意）
app.get("/healthz", (_req, res) => res.status(200).send("ok"));

// SPA のためのフォールバック（深いURLでも index.html を返す）
app.get("*", (_req, res, next) => {
  res.sendFile(path.join(__dirname, "public", "index.html"), (err) => {
    if (err) next(err);
  });
});

// --- Socket.IO ---
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

  // ★ 終局結果を同室の他クライアントへ中継（表示は各自で閉じる）
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
