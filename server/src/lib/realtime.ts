import { WebSocket, WebSocketServer } from "ws";
import { authenticateToken } from "./auth.js";

const connections = new Map<string, Set<WebSocket>>();

export function registerRealtime(app) {
  const wss = new WebSocketServer({ noServer: true });

  app.server.on("upgrade", (request, socket, head) => {
    const host = request.headers.host || "localhost";
    const url = request.url ? new URL(request.url, `http://${host}`) : null;

    if (!url || url.pathname !== "/ws") {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket, request) => {
    let userId: string | null = null;
    console.log("[ws] connection", { url: request.url });

    const host = request.headers.host || "localhost";
    const url = request.url ? new URL(request.url, `http://${host}`) : null;
    const tokenFromQuery = url?.searchParams.get("token") || null;

    const subscribe = async (token: string) => {
      try {
        if (userId) return;
        const user = await authenticateToken(token);
        userId = String(user.id);
        if (!connections.has(userId)) {
          connections.set(userId, new Set());
        }
        connections.get(userId)?.add(socket);
        console.log("[ws] subscribed", { userId, count: connections.get(userId)?.size || 0 });
      } catch (error) {
        console.log("[ws] subscribe failed", { error });
        socket.close(1008, "unauthorized");
      }
    };

    if (tokenFromQuery) {
      void subscribe(tokenFromQuery);
    }

    socket.on("message", (raw) => {
      if (userId) return;
      try {
        const text = typeof raw === "string" ? raw : raw.toString();
        const data = JSON.parse(text);
        if (data?.type !== "auth" || !data.token) return;
        void subscribe(data.token);
      } catch (error) {
        console.log("[ws] subscribe failed", { error });
      }
    });

    socket.on("close", () => {
      console.log("[ws] socket closed");
      if (!userId) return;
      const set = connections.get(userId);
      if (set) {
        set.delete(socket);
        if (set.size === 0) connections.delete(userId);
      }
    });

    socket.on("error", (error) => {
      console.log("[ws] socket error", { error });
    });
  });

  app.addHook("onClose", async () => {
    wss.close();
  });
}

export function notifyUser(userId, message) {
  const key = String(userId);
  const set = connections.get(key);
  if (!set) {
    console.log("[ws] no subscribers", { userId: key, message, known: Array.from(connections.keys()) });
    return;
  }
  const payload = JSON.stringify(message);
  console.log("[ws] notify", { userId: key, message, count: set.size });
  for (const socket of set) {
    if (socket.readyState !== WebSocket.OPEN) continue;
    try {
      socket.send(payload);
    } catch {
      // ignore
    }
  }
}
