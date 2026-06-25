import { WebSocketServer, WebSocket } from 'ws'
import {
  type ClientMessage,
  type Envelope,
  WSPROTO_VERSION,
  WSPROTO_MIN_VERSION,
  WSPROTO_MAX_VERSION,
} from '@boredgame/transport'
import { GameRegistry } from '@boredgame/registry'
import { demoGameDefinition } from '@boredgame/demo-game'
import { ticTacToeDefinition } from '@boredgame/tic-tac-toe'
import { saboteurDefinition } from 'saboteur-project/definition'
import { Room } from './Room'

const gameRegistry = new GameRegistry()
gameRegistry.registerAll([
  demoGameDefinition,
  ticTacToeDefinition,
  saboteurDefinition,
])

const PORT = Number(process.env.PORT ?? 3001)

const rooms = new Map<string, Room>()
const roomsByDiscordInstance = new Map<string, Room>()
const lastPong = new Map<WebSocket, number>()

const HEARTBEAT_INTERVAL_MS = 15_000
const HEARTBEAT_TIMEOUT_MS = 45_000
const CLEANUP_INTERVAL_MS = 30_000

const wss = new WebSocketServer({ port: PORT })

console.log(`ws server listening on :${String(PORT)}`)

function generateRoomId(): string {
  return crypto.randomUUID()
}

wss.on('connection', (socket: WebSocket, req) => {
  const url = new URL(req.url ?? '', 'http://localhost')
  const playerId = url.searchParams.get('playerId')
  const connectionDiscordInstanceId =
    url.searchParams.get('discordInstanceId') || undefined

  if (!playerId) {
    sendError(socket, 'MISSING_PLAYER_ID', 'playerId query param is required')
    socket.close()
    return
  }

  lastPong.set(socket, Date.now())

  socket.on('message', (raw) => {
    let envelope: Envelope<ClientMessage>

    try {
      let text: string
      if (typeof raw === 'string') {
        text = raw
      } else if (raw instanceof Buffer) {
        text = raw.toString()
      } else if (raw instanceof ArrayBuffer) {
        text = new TextDecoder().decode(raw)
      } else {
        text = Buffer.concat(raw as Buffer[]).toString()
      }
      envelope = JSON.parse(text) as Envelope<ClientMessage>
    } catch {
      sendError(socket, 'PARSE_ERROR', 'Invalid JSON')
      return
    }

    const clientVer = envelope.ver
    const msg = envelope.msg

    switch (msg.type) {
      case 'create-room': {
        if (clientVer !== WSPROTO_VERSION) {
          sendError(
            socket,
            'BAD_VERSION',
            `Expected version ${String(WSPROTO_VERSION)}, got ${String(clientVer)}`
          )
          return
        }

        const gameDef = gameRegistry.get(msg.payload.gameId)
        if (!gameDef) {
          sendError(
            socket,
            'UNKNOWN_GAME',
            `Unknown game "${msg.payload.gameId}"`
          )
          return
        }

        const roomId = generateRoomId()

        const room = new Room(
          roomId,
          gameDef,
          msg.payload.playerId,
          {
            isPrivate: msg.payload.isPrivate,
            discordInstanceId: msg.payload.discordInstanceId,
            maxPlayers: msg.payload.maxPlayers,
            allowSpectators: msg.payload.allowSpectators,
            maxSpectators: msg.payload.maxSpectators,
          },
          () => {
            rooms.delete(roomId)
            if (room.discordInstanceId) {
              roomsByDiscordInstance.delete(room.discordInstanceId)
            }
          }
        )

        rooms.set(roomId, room)

        if (msg.payload.discordInstanceId) {
          roomsByDiscordInstance.set(msg.payload.discordInstanceId, room)
        }

        const err = room.join(
          socket,
          msg.payload.playerId,
          msg.payload.syncMode,
          [],
          WSPROTO_VERSION,
          undefined,
          false
        )

        if (err) {
          sendError(socket, err, `Failed to join room: ${err}`)
          rooms.delete(roomId)
          return
        }

        sendEnvelope(socket, WSPROTO_VERSION, 0, {
          type: 'join-room-ack',
          payload: {
            chosenVersion: WSPROTO_VERSION,
            playerId: msg.payload.playerId,
          },
        })

        room.sendRoomState(socket)
        return
      }

      case 'join-room': {
        const clientMin = msg.payload.version?.min ?? WSPROTO_MIN_VERSION
        const clientMax = msg.payload.version?.max ?? WSPROTO_MAX_VERSION

        if (
          clientMax < WSPROTO_MIN_VERSION ||
          clientMin > WSPROTO_MAX_VERSION
        ) {
          sendError(
            socket,
            'INCOMPATIBLE_VERSION',
            `Server supports [${String(WSPROTO_MIN_VERSION)}, ${String(WSPROTO_MAX_VERSION)}], client sent [${String(clientMin)}, ${String(clientMax)}]`
          )
          socket.close()
          return
        }

        const negotiatedVersion = Math.min(clientMax, WSPROTO_MAX_VERSION)

        const gameDef = gameRegistry.get(msg.payload.gameId)
        if (!gameDef) {
          sendError(
            socket,
            'UNKNOWN_GAME',
            `Unknown game "${msg.payload.gameId}"`
          )
          socket.close()
          return
        }

        let roomId = url.searchParams.get('roomId') ?? ''
        let room: Room | undefined

        if (connectionDiscordInstanceId) {
          room = roomsByDiscordInstance.get(connectionDiscordInstanceId)
          if (room) roomId = room.roomId
        }

        if (!room) {
          room = rooms.get(roomId)
        }

        if (!room && msg.payload.roomCode) {
          for (const [, r] of rooms) {
            if (r.privateCode === msg.payload.roomCode) {
              room = r
              roomId = r.roomId
              break
            }
          }
        }

        if (!room) {
          room = new Room(
            roomId,
            gameDef,
            msg.payload.playerId,
            undefined,
            () => {
              rooms.delete(roomId)
              if (room?.discordInstanceId) {
                roomsByDiscordInstance.delete(room.discordInstanceId)
              }
            }
          )
          rooms.set(roomId, room)
        }

        const err = room.join(
          socket,
          msg.payload.playerId,
          msg.payload.syncMode,
          msg.payload.knownActionIds,
          negotiatedVersion,
          msg.payload.roomCode,
          undefined
        )

        if (err) {
          sendError(socket, err, `Failed to join room: ${err}`)
          if (room.isEmpty) {
            rooms.delete(roomId)
          }
          return
        }

        sendEnvelope(socket, negotiatedVersion, 0, {
          type: 'join-room-ack',
          payload: {
            chosenVersion: negotiatedVersion,
            playerId: msg.payload.playerId,
          },
        })

        room.sendRoomState(socket)
        return
      }

      case 'leave-room': {
        const room = findRoomForSocket(socket)
        if (room) {
          room.leave(msg.payload.playerId)
        }
        return
      }

      case 'start-game': {
        const room = findRoomForSocket(socket)
        if (!room) return

        const err = room.startGame()
        if (err) {
          sendError(socket, err, `Failed to start game: ${err}`)
        }
        return
      }

      case 'spectate': {
        const room = findRoomForSocket(socket)
        if (!room) return

        const err = room.setSpectate(
          msg.payload.playerId,
          msg.payload.spectating
        )
        if (err) {
          sendError(socket, err, `Failed to set spectate: ${err}`)
        }
        return
      }

      case 'set-ready': {
        const room = findRoomForSocket(socket)
        if (!room) return

        const err = room.setReady(msg.payload.playerId, msg.payload.ready)
        if (err) {
          sendError(socket, err, `Failed to set ready: ${err}`)
        }
        return
      }

      case 'ping': {
        lastPong.set(socket, Date.now())
        sendEnvelope(socket, clientVer, 0, {
          type: 'pong',
          payload: {},
        })
        return
      }

      case 'action': {
        const room = findRoomForSocket(socket)
        if (!room) return

        room.handleAction(msg.payload.action, playerId)
        return
      }

      case 'request-sync': {
        const room = findRoomForSocket(socket)
        if (room) {
          room.sendSnapshot(socket)
        }
        return
      }
    }
  })

  socket.on('close', () => {
    lastPong.delete(socket)
    const room = findRoomForSocket(socket)
    if (room) {
      room.removeSocket(socket)
    }
  })
})

function findRoomForSocket(socket: WebSocket): Room | undefined {
  for (const room of rooms.values()) {
    for (const pid of room.getSlots().map((s) => s.playerId)) {
      if (room.getSocketByPlayerId(pid) === socket) {
        return room
      }
    }
  }
  return undefined
}

function handleRoomCleanup(): void {
  const now = Date.now()

  for (const [roomId, room] of rooms) {
    if (room.isStale()) {
      console.log(`Cleaning up stale room ${roomId} (status=${room.status})`)
      room.abandon('Room cleaned up due to inactivity')
      continue
    }

    for (const slot of room.getSlots()) {
      const socket = room.getSocketByPlayerId(slot.playerId)
      if (!socket) continue

      const last = lastPong.get(socket)
      if (last && now - last > HEARTBEAT_TIMEOUT_MS) {
        console.log(
          `Stale connection detected for ${slot.playerId} in room ${roomId}`
        )
        socket.terminate()
        room.leave(slot.playerId)
      }
    }
  }
}

setInterval(handleRoomCleanup, CLEANUP_INTERVAL_MS)

const heartbeatTimer = setInterval(() => {
  for (const room of rooms.values()) {
    for (const slot of room.getSlots()) {
      const socket = room.getSocketByPlayerId(slot.playerId)
      if (socket && socket.readyState === WebSocket.OPEN) {
        sendEnvelope(socket, WSPROTO_VERSION, 0, { type: 'pong', payload: {} })
      }
    }
  }
}, HEARTBEAT_INTERVAL_MS)

wss.on('close', () => {
  clearInterval(heartbeatTimer)
})

function sendError(socket: WebSocket, code: string, message: string): void {
  sendEnvelope(socket, WSPROTO_VERSION, 0, {
    type: 'error',
    payload: { code, message },
  })
}

function sendEnvelope(
  socket: WebSocket,
  ver: number,
  seq: number,
  msg: { type: string; payload: unknown }
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return
  }

  socket.send(JSON.stringify({ ver, seq, msg }))
}
