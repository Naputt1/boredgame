import { useCallback, useEffect, useMemo } from 'react'
import type { GameRendererProps } from '@boredgame/core'
import type { TicTacToeState } from './state'
import type { TicTacToeAction } from './actions'

const cellStyle = (
  value: string | null,
  isWinning: boolean
): React.CSSProperties => ({
  width: 80,
  height: 80,
  fontSize: 32,
  fontWeight: 700,
  border: '1px solid #6b7280',
  background: isWinning ? '#166534' : value ? '#1e293b' : '#0f172a',
  color: value === 'X' ? '#60a5fa' : '#f87171',
  cursor: value ? 'default' : 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s',
  outline: 'none',
})

export const TicTacToeView = ({
  state,
  playerId,
  sendAction,
  participants,
  connected,
}: GameRendererProps<TicTacToeState, TicTacToeAction>) => {
  const myPlayer = state.players[playerId]
  /* eslint-disable @typescript-eslint/no-unnecessary-condition */
  const isMyTurn =
    myPlayer && state.currentPlayer === myPlayer.mark && !state.winner
  /* eslint-enable @typescript-eslint/no-unnecessary-condition */

  const displayName = useCallback(
    (pid: string): string => {
      const match = participants.find((p) => p.id === pid)
      return match?.globalName ?? match?.username ?? pid
    },
    [participants]
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!connected || myPlayer || !playerId) {
      return
    }
    const joinTimeout = setTimeout(() => {
      sendAction({
        type: 'join.game',
        version: 1,
        payload: { playerId, name: displayName(playerId) },
        meta: {
          playerId,
          timestamp: Date.now(),
          actionId: `join:${playerId}:${String(Date.now())}`,
        },
      })
    }, 500)
    return () => {
      clearTimeout(joinTimeout)
    }
  }, [playerId, myPlayer, sendAction, displayName, connected])

  const placePiece = useCallback(
    (row: number, col: number) => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!myPlayer || !isMyTurn) return
      sendAction({
        type: 'place.piece',
        version: 1,
        payload: { row, col, mark: myPlayer.mark },
        meta: {
          playerId,
          timestamp: Date.now(),
          actionId: `place:${playerId}:${String(row)}:${String(col)}:${String(Date.now())}`,
        },
      })
    },
    [myPlayer, isMyTurn, playerId, sendAction]
  )

  const resetGame = useCallback(() => {
    sendAction({
      type: 'reset.game',
      version: 1,
      payload: {},
      meta: {
        playerId,
        timestamp: Date.now(),
        actionId: `reset:${playerId}:${String(Date.now())}`,
      },
    })
  }, [playerId, sendAction])

  const statusText = useMemo(() => {
    if (state.winner === 'tie') return "It's a tie!"
    if (state.winner) {
      const winnerPlayer = Object.values(state.players).find(
        (p) => p.mark === state.winner
      )
      return winnerPlayer
        ? `${displayName(winnerPlayer.id)} wins!`
        : `${state.winner} wins!`
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!myPlayer) return 'Joining game...'
    if (isMyTurn) return 'Your turn'
    return `${state.currentPlayer}'s turn`
  }, [
    state.winner,
    state.players,
    state.currentPlayer,
    myPlayer,
    isMyTurn,
    displayName,
  ])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        paddingTop: 24,
      }}
    >
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Tic-Tac-Toe</h2>
        <span
          style={{
            fontSize: 14,
            color: state.winner ? '#fbbf24' : isMyTurn ? '#34d399' : '#9ca3af',
            fontWeight: 600,
          }}
        >
          {statusText}
        </span>
      </div>

      <div
        style={{
          display: 'inline-grid',
          gridTemplateColumns: 'repeat(3, 80px)',
          gap: 0,
          border: '2px solid #374151',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {state.board.map((row, r) =>
          row.map((cell, c) => (
            <button
              key={`${String(r)}-${String(c)}`}
              type="button"
              style={cellStyle(cell, false)}
              onClick={() => {
                placePiece(r, c)
              }}
              disabled={!isMyTurn || !!cell || !!state.winner}
              aria-label={`Cell ${String(r)},${String(c)}${cell ? ` (${cell})` : ''}`}
            >
              {cell ?? ''}
            </button>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {Object.values(state.players).length > 0 && (
          <button
            type="button"
            onClick={resetGame}
            style={{
              padding: '8px 20px',
              fontSize: 14,
              fontWeight: 600,
              background: '#374151',
              border: '1px solid #6b7280',
              borderRadius: 6,
              color: '#f9fafb',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        )}
      </div>

      <div style={{ marginTop: 8, fontSize: 14, color: '#9ca3af' }}>
        <strong>Players:</strong>
        <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
          {Object.values(state.players).length === 0 && (
            <li>Waiting for players...</li>
          )}
          {Object.values(state.players).map((p) => (
            <li key={p.id}>
              {displayName(p.id)} — {p.mark}
            </li>
          ))}
        </ul>
      </div>

      {!connected && (
        <span style={{ color: '#f87171', fontSize: 12 }}>Disconnected</span>
      )}
    </div>
  )
}
