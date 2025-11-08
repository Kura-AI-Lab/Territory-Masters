// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Socket.IO（Render等のPaaSでも安定する程度に）
const io = new Server(server, {
  pingTimeout: 30000,
  pingInterval: 25000,
  // 同一オリジン配信（/socket.io と /public を同じExpressから配る）前提なのでCORS設定は不要
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

// ====== Socket.IO ロジック ======

// 指定ルームの参加人数を取得
function getRoomSize(roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  return room ? room.size : 0;
}

// 指定ルームの人数をブロードキャスト
function broadcastRoomSize(roomId) {
  const count = getRoomSize(roomId);
  io.to(roomId).emit("roomSize", { roomId, count });
}

io.on("connection", (socket) => {
  console.log("✅ ユーザー接続:", socket.id);

  socket.on("join", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log(`👥 ${socket.id} がルーム "${roomId}" に参加`);
    broadcastRoomSize(roomId);
  });

  // 人数照会
  socket.on("roomSize", ({ roomId } = {}) => {
    if (!roomId) return;
    socket.emit("roomSize", { roomId, count: getRoomSize(roomId) });
  });

  // 盤面 state の中継
  socket.on("state", ({ roomId, state }) => {
    if (!roomId) return;
    socket.to(roomId).emit("state", { state });
  });

  // ★ 終局の中継：roomId 以外をそのまま送る（winner/survivors/elim を含む）
  socket.on("end", (data) => {
    const { roomId, ...rest } = data || {};
    if (!roomId) return;
    socket.to(roomId).emit("end", rest);
  });

  socket.on("disconnecting", () => {
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      setTimeout(() => broadcastRoomSize(roomId), 0);
    }
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

// 安全なヘルスチェック用のランダムURL（任意）
app.get("/healthz-kura014", (_req, res) => {
  res.status(200).send("ok");
});
