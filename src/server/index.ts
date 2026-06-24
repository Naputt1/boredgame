import { WebSocketServer, WebSocket } from "ws";
import {
  ClientMessage,
  Envelope,
  WSPROTO_VERSION
} from "@boredgame/transport";
import { demoGameDefinition } from "@boredgame/demo-game";
import { Room } from "./Room";

const PORT = Number(process.env.PORT ?? 3001);

const rooms = new Map<string, Room>();

const wss = new WebSocketServer({ port: PORT });

console.log(`ws server listening on :${PORT}`);

wss.on("connection", (socket: WebSocket, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const roomId = url.searchParams.get("roomId") ?? "default";
  const playerId = url.searchParams.get("playerId");

  if (!playerId) {
    sendError(socket, "MISSING_PLAYER_ID", "playerId query param is required");
    socket.close();
    return;
  }

  socket.on("message", (raw) => {
    let envelope: Envelope<ClientMessage>;

    try {
      envelope = JSON.parse(String(raw)) as Envelope<ClientMessage>;
    } catch {
      sendError(socket, "PARSE_ERROR", "Invalid JSON");
      return;
    }

    if (envelope.ver !== WSPROTO_VERSION) {
      sendError(socket, "BAD_VERSION", `Expected version ${WSPROTO_VERSION}`);
      return;
    }

    const msg = envelope.msg;

    switch (msg.type) {
      case "join-room": {
        const room = getOrCreateRoom(roomId);
        room.join(socket, msg.payload.playerId, msg.payload.syncMode, msg.payload.knownActionIds);
        break;
      }

      case "action": {
        const room = getOrCreateRoom(roomId);
        room.handleAction(msg.payload.action, playerId);
        break;
      }

      case "request-sync": {
        const room = rooms.get(roomId);
        if (room) {
          room.sendSnapshot(socket);
        }
        break;
      }
    }
  });

  socket.on("close", () => {
    const room = rooms.get(roomId);
    if (room) {
      room.removeSocket(socket);
      if (room.isEmpty) {
        rooms.delete(roomId);
      }
    }
  });
});

function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);

  if (!room) {
    room = new Room(roomId, demoGameDefinition);
    rooms.set(roomId, room);
  }

  return room;
}

function sendError(
  socket: WebSocket,
  code: string,
  message: string
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const envelope: Envelope<{ type: "error"; payload: { code: string; message: string } }> = {
    ver: WSPROTO_VERSION,
    seq: 0,
    msg: { type: "error", payload: { code, message } }
  };

  socket.send(JSON.stringify(envelope));
}
