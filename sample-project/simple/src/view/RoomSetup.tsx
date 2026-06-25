import { useCallback, useRef, useState } from 'react'
import type { GameDefinition } from '@boredgame/core'
import { createTransport } from 'boredgame:transport'
import type { GameTransport } from '@boredgame/transport'

const localId = (prefix: string): string => {
  const key = `boredgame:${prefix}`
  const stored = window.localStorage.getItem(key)
  if (stored) return stored
  const gen =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    crypto.randomUUID() ?? `${prefix}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, gen)
  return gen
}

type RoomSetupProps = {
  definition: GameDefinition<unknown, unknown>
  onRoomReady: (opts: {
    roomId: string
    transport: GameTransport
    userId: string
    username: string
  }) => void
  onBack: () => void
}

const s = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  } as React.CSSProperties,
  card: {
    background: '#0f172a',
    border: '1px solid #374151',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  } as React.CSSProperties,
  tabRow: {
    display: 'flex',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1px solid #374151',
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '10px 16px',
    border: 0,
    cursor: 'pointer',
    fontWeight: 700,
    fontSize: 14,
    background: active ? '#3b82f6' : '#1f2937',
    color: active ? '#fff' : '#9ca3af',
  }),
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid #374151',
    background: '#1f2937',
    color: '#e5e7eb',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'monospace',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#9ca3af',
    marginBottom: 6,
    display: 'block',
  } as React.CSSProperties,
  actionRow: {
    display: 'flex',
    gap: 10,
  } as React.CSSProperties,
  primaryBtn: (disabled?: boolean): React.CSSProperties => ({
    flex: 1,
    background: '#3b82f6',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }),
  secondaryBtn: {
    background: '#374151',
    color: '#d1d5db',
    border: 0,
    borderRadius: 8,
    padding: '10px 16px',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  } as React.CSSProperties,
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: '#d1d5db',
    fontSize: 14,
  } as React.CSSProperties,
}

export const RoomSetup = ({
  definition,
  onRoomReady,
  onBack,
}: RoomSetupProps) => {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [isPrivate, setIsPrivate] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const identityRef = useRef({
    userId: localId('local-user'),
    username: `Player ${localId('local-user').slice(0, 4)}`,
  })
  const identity = identityRef.current

  const createTransportOnce = useCallback(() => {
    return createTransport({
      playerId: identity.userId,
      gameId: definition.id,
    })
  }, [identity.userId, definition.id])

  const handleCreate = useCallback(() => {
    setLoading(true)
    setError(null)
    try {
      const roomId = crypto.randomUUID()
      const transport = createTransportOnce()
      void transport.connect(roomId)
      onRoomReady({
        roomId,
        transport,
        userId: identity.userId,
        username: identity.username,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setLoading(false)
    }
  }, [createTransportOnce, identity, onRoomReady])

  const handleJoin = useCallback(() => {
    const code = roomCode.trim().toUpperCase()
    if (code.length < 4) {
      setError('Enter a valid room code')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const transport = createTransportOnce()
      void transport.connect(code, code)
      onRoomReady({
        roomId: code,
        transport,
        userId: identity.userId,
        username: identity.username,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setLoading(false)
    }
  }, [roomCode, createTransportOnce, identity, onRoomReady])

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1
          style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#e5e7eb' }}
        >
          {definition.name}
        </h1>
        <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
          Start a new game or join an existing room
        </p>

        <div style={s.tabRow}>
          <button
            type="button"
            style={s.tab(tab === 'create')}
            onClick={() => {
              setTab('create')
              setError(null)
            }}
          >
            Create Room
          </button>
          <button
            type="button"
            style={s.tab(tab === 'join')}
            onClick={() => {
              setTab('join')
              setError(null)
            }}
          >
            Join Room
          </button>
        </div>

        {tab === 'create' && (
          <>
            <p
              style={{
                fontSize: 13,
                color: '#9ca3af',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              A new room will be created. Share the room ID with friends so they
              can join.
            </p>
            <div style={s.checkboxRow}>
              <input
                type="checkbox"
                id="private"
                checked={isPrivate}
                onChange={(e) => {
                  setIsPrivate(e.target.checked)
                }}
                style={{ accentColor: '#3b82f6' }}
              />
              <label htmlFor="private">
                Make room private (requires code to join)
              </label>
            </div>
            <div style={s.actionRow}>
              <button type="button" style={s.secondaryBtn} onClick={onBack}>
                Back
              </button>
              <button
                type="button"
                style={s.primaryBtn(loading)}
                disabled={loading}
                onClick={handleCreate}
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </>
        )}

        {tab === 'join' && (
          <>
            <div>
              <label style={s.label}>Room Code</label>
              <input
                type="text"
                placeholder="e.g. ABC123"
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase().slice(0, 6))
                }}
                style={s.input}
                maxLength={6}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoin()
                }}
              />
            </div>
            <div style={s.actionRow}>
              <button type="button" style={s.secondaryBtn} onClick={onBack}>
                Back
              </button>
              <button
                type="button"
                style={s.primaryBtn(loading || !roomCode.trim())}
                disabled={loading || !roomCode.trim()}
                onClick={handleJoin}
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </>
        )}

        {error && (
          <p
            style={{
              color: '#fca5a5',
              fontSize: 13,
              margin: 0,
              textAlign: 'center',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
