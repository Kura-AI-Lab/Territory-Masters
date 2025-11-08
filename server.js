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

  // ルーム参加
  socket.on("join", ({ roomId }) => {
    if (!roomId) return;
    socket.join(roomId);
    console.log(`👥 ${socket.id} がルーム "${roomId}" に参加`);
    // 参加直後に最新人数を全員へ通知
    broadcastRoomSize(roomId);
  });

  // クライアントからの人数照会（{ roomId }）
  socket.on("roomSize", ({ roomId } = {}) => {
    if (!roomId) return;
    socket.emit("roomSize", { roomId, count: getRoomSize(roomId) });
  });

  // 盤面 state を同じ部屋の「自分以外」へブロードキャスト
  socket.on("state", ({ roomId, state }) => {
    if (!roomId) return;
    socket.to(roomId).emit("state", { state });
  });

  // 終局結果を中継
  socket.on("end", ({ roomId, result }) => {
    if (!roomId) return;
    socket.to(roomId).emit("end", { result });
  });

  // 切断前に所属していた全ルームの人数を更新通知
  socket.on("disconnecting", () => {
    // socket.rooms は Set。最初の要素は socket.id 自身なので除外する
    for (const roomId of socket.rooms) {
      if (roomId === socket.id) continue;
      // disconnecting 時点ではまだルーム在籍扱いなので、
      // 次のtickで再計算してから通知
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
