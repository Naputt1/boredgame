import { WebSocketServer, WebSocket } from "ws";
import type { GameDefinition } from "@boredgame/core";
import {
  type ClientMessage,
  type Envelope,
  WSPROTO_VERSION,
  WSPROTO_MIN_VERSION,
  WSPROTO_MAX_VERSION
} from "@boredgame/transport";
import { GameRegistry } from "@boredgame/registry";
import { demoGameDefinition } from "@boredgame/demo-game";
import { ticTacToeDefinition } from "@boredgame/tic-tac-toe";
import { saboteurDefinition } from "saboteur-project/definition";
import { Room } from "./Room";

const gameRegistry = new GameRegistry();
gameRegistry.registerAll([demoGameDefinition, ticTacToeDefinition, saboteurDefinition]);

const PORT = Number(process.env.PORT ?? 3001);

const rooms = new Map<string, Room>();

const wss = new WebSocketServer({ port: PORT });

console.log(`ws server listening on :${PORT}`);

wss.on("connection", (socket: WebSocket, req) => {
  const url = new URL(req.url ?? "", "http://localhost");
  const roomId = url.searchParams.get("roomId") ?? "default";
  const playerId = url.searchParams.get("playerId");

  let negotiatedVersion = WSPROTO_VERSION;

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

    const clientVer = envelope.ver;
    const msg = envelope.msg;

    if (msg.type === "join-room" && msg.payload.version) {
      const clientMin = msg.payload.version.min;
      const clientMax = msg.payload.version.max;

      if (clientMax < WSPROTO_MIN_VERSION || clientMin > WSPROTO_MAX_VERSION) {
        sendError(socket, "INCOMPATIBLE_VERSION",
          `Server supports [${WSPROTO_MIN_VERSION}, ${WSPROTO_MAX_VERSION}], client sent [${clientMin}, ${clientMax}]`
        );
        socket.close();
        return;
      }

      negotiatedVersion = Math.min(clientMax, WSPROTO_MAX_VERSION);

      const gameDef = gameRegistry.get(msg.payload.gameId);
      if (!gameDef) {
        sendError(socket, "UNKNOWN_GAME", `Unknown game "${msg.payload.gameId}"`);
        socket.close();
        return;
      }

      const room = getOrCreateRoom(roomId, gameDef);
      room.join(socket, msg.payload.playerId, msg.payload.syncMode, msg.payload.knownActionIds, negotiatedVersion);

      sendEnvelope(socket, negotiatedVersion, 0, {
        type: "join-room-ack",
        payload: { chosenVersion: negotiatedVersion, playerId: msg.payload.playerId }
      });
      return;
    }

    if (clientVer !== negotiatedVersion) {
      sendError(socket, "BAD_VERSION", `Expected version ${negotiatedVersion}, got ${clientVer}`);
      return;
    }

    switch (msg.type) {
      case "join-room": {
        const gameDef = gameRegistry.get(msg.payload.gameId);
        if (!gameDef) {
          sendError(socket, "UNKNOWN_GAME", `Unknown game "${msg.payload.gameId}"`);
          return;
        }
        const room = getOrCreateRoom(roomId, gameDef);
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

function getOrCreateRoom(roomId: string, definition?: GameDefinition<unknown, unknown>): Room {
  let room = rooms.get(roomId);

  if (!room) {
    if (!definition) {
      throw new Error(`Room "${roomId}" does not exist. Provide a game definition to create it.`);
    }
    room = new Room(roomId, definition);
    rooms.set(roomId, room);
  }

  return room;
}

function sendError(
  socket: WebSocket,
  code: string,
  message: string
): void {
  sendEnvelope(socket, WSPROTO_VERSION, 0, {
    type: "error",
    payload: { code, message }
  });
}

function sendEnvelope(
  socket: WebSocket,
  ver: number,
  seq: number,
  msg: { type: string; payload: unknown }
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify({ ver, seq, msg }));
}
