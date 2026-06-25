import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameRendererProps } from '@boredgame/core'
import type {
  SaboteurState,
  Card,
  ActionCard,
  PlayerId,
  ActionType,
  Role,
} from './state'
import type { SaboteurAction } from './actions'
import {
  BOARD_COLS,
  BOARD_ROWS,
  START_COL,
  START_ROW,
  getOpenAdjacents,
} from './state'

// ── Constants ───────────────────────────────────────

const CELL = 70
const GAP = 2

const ROLE_COLORS: Record<string, string> = {
  miner: '#2563eb',
  saboteur: '#dc2626',
}

const SHAPE_CHAR: Record<string, string> = {
  start: '\u2605',
  'goal-gold': '\u25C6',
  'goal-stone': '\u25C7',
}

const ACTION_LABELS: Record<string, string> = {
  'break-pickaxe': 'Break Pick',
  'break-lantern': 'Break Lantern',
  'break-wagon': 'Break Wagon',
  'repair-pickaxe': 'Fix Pick',
  'repair-lantern': 'Fix Lantern',
  'repair-wagon': 'Fix Wagon',
  'repair-dual': 'Fix Tool',
  rockfall: 'Rockfall',
  map: 'Map',
}

// ── Helpers ──────────────────────────────────────────

// ── Styles ────────────────────────────────────────────

const btn = (): React.CSSProperties => ({
  padding: '6px 14px',
  fontSize: 13,
  fontWeight: 600,
  background: '#374151',
  border: '1px solid #6b7280',
  borderRadius: 6,
  color: '#f9fafb',
  cursor: 'pointer',
  transition: 'background 0.12s',
})

const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  fontSize: 11,
  fontWeight: 700,
  background: '#1f2937',
  border: '1px solid #6b7280',
  borderRadius: 3,
  color: '#e5e7eb',
  margin: '0 2px',
}

// ── Main Component ──────────────────────────────────

export const SaboteurView = ({
  state,
  playerId,
  sendAction,
  participants,
  connected,
}: GameRendererProps<SaboteurState, SaboteurAction>) => {
  const myPlayer = state.players[playerId]
  const myHand: Card[] = useMemo(
    () => state.hands[playerId] ?? [],
    [state.hands, playerId]
  )
  const currentPlayerId = state.playerOrder[state.currentPlayerIndex]
  const isMyTurn = currentPlayerId === playerId && state.phase === 'playing'

  // UI state (local — not in game state)
  const [selectedCard, setSelectedCard] = useState<string | null>(null)
  const [rotatedConns, setRotatedConns] = useState<0 | 90 | 180 | 270>(0)
  const [actionTarget, setActionTarget] = useState<{
    cardId: string
    actionType: ActionType
  } | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    col: number
    row: number
  } | null>(null)

  const displayName = useCallback(
    (pid: PlayerId): string => {
      const match = participants.find((p) => p.id === pid)
      return match?.globalName ?? match?.username ?? pid
    },
    [participants]
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!connected || myPlayer || !playerId || state.phase !== 'joining') return
    const t = setTimeout(() => {
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
    }, 300)
    return () => {
      clearTimeout(t)
    }
  }, [playerId, myPlayer, sendAction, displayName, connected, state.phase])

  const openCells = useMemo(() => {
    if (state.phase !== 'playing') return []
    return getOpenAdjacents(
      state.board,
      BOARD_COLS,
      BOARD_ROWS,
      state.startPos,
      state.goalCards
    )
  }, [state.board, state.phase, state.goalCards, state.startPos])

  const openSet = useMemo(
    () => new Set(openCells.map((p) => `${String(p.col)},${String(p.row)}`)),
    [openCells]
  )

  const canPlayPath =
    isMyTurn &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (!state.brokenTools[playerId] || state.brokenTools[playerId].length === 0)

  // ── Action Handlers ────────────────────────────────

  const handleRotate = useCallback(() => {
    setRotatedConns((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270)
  }, [])

  const handleCardSelect = useCallback(
    (cardId: string, suit: string) => {
      if (!isMyTurn) return
      if (suit === 'path') {
        setSelectedCard(cardId === selectedCard ? null : cardId)
        setRotatedConns(0)
        setActionTarget(null)
      } else if (suit === 'action') {
        const card = myHand.find((c) => c.id === cardId) as ActionCard
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!card) return

        if (
          card.actionType === 'break-pickaxe' ||
          card.actionType === 'break-lantern' ||
          card.actionType === 'break-wagon'
        ) {
          setActionTarget({ cardId, actionType: card.actionType })
          setSelectedCard(null)
        } else if (
          card.actionType === 'rockfall' ||
          card.actionType === 'map'
        ) {
          setActionTarget({ cardId, actionType: card.actionType })
          setSelectedCard(null)
        } else if (card.actionType.startsWith('repair')) {
          setActionTarget({ cardId, actionType: card.actionType })
          setSelectedCard(null)
        }
      }
    },
    [isMyTurn, myHand, selectedCard]
  )

  const handleCellDragOver = useCallback(
    (e: React.DragEvent, col: number, row: number) => {
      e.preventDefault()
      setDropTarget({ col, row })
    },
    []
  )

  const handleCellDrop = useCallback(
    (e: React.DragEvent, col: number, row: number) => {
      e.preventDefault()
      setDropTarget(null)
      const cardId = e.dataTransfer.getData('text/card-id')
      if (cardId && isMyTurn) {
        sendAction({
          type: 'play.path',
          version: 1,
          payload: { cardId, col, row, rotation: rotatedConns },
          meta: {
            playerId,
            timestamp: Date.now(),
            actionId: `play:${playerId}:${cardId}:${String(col)}:${String(row)}:${String(Date.now())}`,
          },
        })
        setSelectedCard(null)
        setRotatedConns(0)
      }
    },
    [isMyTurn, playerId, sendAction, rotatedConns]
  )

  const handleCellClick = useCallback(
    (col: number, row: number) => {
      if (!isMyTurn) return
      if (selectedCard) {
        sendAction({
          type: 'play.path',
          version: 1,
          payload: { cardId: selectedCard, col, row, rotation: rotatedConns },
          meta: {
            playerId,
            timestamp: Date.now(),
            actionId: `play:${playerId}:${selectedCard}:${String(col)}:${String(row)}:${String(Date.now())}`,
          },
        })
        setSelectedCard(null)
        setRotatedConns(0)
      }
      if (actionTarget?.actionType === 'rockfall') {
        sendAction({
          type: 'play.action',
          version: 1,
          payload: {
            cardId: actionTarget.cardId,
            targetCol: col,
            targetRow: row,
          },
          meta: {
            playerId,
            timestamp: Date.now(),
            actionId: `rockfall:${playerId}:${actionTarget.cardId}:${String(col)}:${String(row)}:${String(Date.now())}`,
          },
        })
        setActionTarget(null)
      }
      if (actionTarget?.actionType === 'map') {
        sendAction({
          type: 'play.action',
          version: 1,
          payload: {
            cardId: actionTarget.cardId,
            targetCol: col,
            targetRow: row,
          },
          meta: {
            playerId,
            timestamp: Date.now(),
            actionId: `map:${playerId}:${actionTarget.cardId}:${String(col)}:${String(row)}:${String(Date.now())}`,
          },
        })
        setActionTarget(null)
      }
    },
    [isMyTurn, selectedCard, rotatedConns, actionTarget, playerId, sendAction]
  )

  const handlePlayAction = useCallback(
    (targetPid: string, repairType?: string) => {
      if (!actionTarget || !isMyTurn) return
      sendAction({
        type: 'play.action',
        version: 1,
        payload: {
          cardId: actionTarget.cardId,
          targetPlayerId: targetPid,
          repairType: repairType as 'pickaxe' | 'lantern' | 'wagon',
        },
        meta: {
          playerId,
          timestamp: Date.now(),
          actionId: `act:${playerId}:${actionTarget.cardId}:${targetPid}:${String(Date.now())}`,
        },
      })
      setActionTarget(null)
    },
    [actionTarget, isMyTurn, playerId, sendAction]
  )

  const handleDiscard = useCallback(
    (cardId: string) => {
      if (!isMyTurn) return
      sendAction({
        type: 'discard.card',
        version: 1,
        payload: { cardId },
        meta: {
          playerId,
          timestamp: Date.now(),
          actionId: `discard:${playerId}:${cardId}:${String(Date.now())}`,
        },
      })
      setSelectedCard(null)
      setActionTarget(null)
    },
    [isMyTurn, playerId, sendAction]
  )

  const handleCollectGold = useCallback(() => {
    sendAction({
      type: 'collect.gold',
      version: 1,
      payload: {},
      meta: {
        playerId,
        timestamp: Date.now(),
        actionId: `gold:${playerId}:${String(Date.now())}`,
      },
    })
  }, [playerId, sendAction])

  const handleStartNextRound = useCallback(() => {
    sendAction({
      type: 'start.game',
      version: 1,
      payload: {},
      meta: {
        playerId,
        timestamp: Date.now(),
        actionId: `start:${playerId}:${String(Date.now())}`,
      },
    })
  }, [playerId, sendAction])

  const handleReset = useCallback(() => {
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

  // ── Status text ────────────────────────────────────

  const statusText = useMemo(() => {
    if (state.phase === 'joining') return 'Waiting for players...'
    if (state.phase === 'setup') return 'Round ended. Start next round?'
    if (state.phase === 'round-end') return 'Round over! Distribute gold.'
    if (state.phase === 'game-over') return 'Game over!'
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (state.phase === 'playing') {
      if (state.playerOrder.length < 3)
        return `Waiting for players (${String(state.playerOrder.length)}/3)`
      if (isMyTurn) return 'Your turn'
      return `${displayName(currentPlayerId)}'s turn`
    }
    return ''
  }, [
    state.phase,
    state.playerOrder.length,
    isMyTurn,
    currentPlayerId,
    displayName,
  ])

  const myRole: Role | undefined = state.roles[playerId]
  const brokenTools = state.brokenTools[playerId]
  const hasBrokenTools = brokenTools.length > 0

  const possibleTargets = useMemo(() => {
    if (!actionTarget) return []
    const at = actionTarget.actionType
    if (at.startsWith('break') || at.startsWith('repair')) {
      return state.playerOrder.filter(
        (p) => p !== playerId || at.startsWith('repair')
      )
    }
    return []
  }, [actionTarget, state.playerOrder, playerId])

  // ── Joining Screen ─────────────────────────────────

  if (state.phase === 'joining') {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>
          Saboteur{' '}
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            Round {state.round}/3
          </span>
        </h2>
        <p style={{ color: '#9ca3af', marginTop: 8 }}>
          Waiting for players... ({state.playerOrder.length}/3 minimum)
        </p>
        {state.playerOrder.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {state.playerOrder.map((pid) => (
              <li key={pid} style={{ color: '#e5e7eb', padding: 4 }}>
                {displayName(pid)}
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (state.phase === 'round-end' && state.goldDist) {
    const gd = state.goldDist
    const curChooser = gd.chooserChain[gd.currentChooserIdx]
    const isMyCollectTurn = curChooser === playerId
    const isMinerWin = gd.mode === 'miners-win'
    const isSaboteurWin = gd.mode === 'saboteurs-win'

    if (isMinerWin && gd.chooserChain.length > 0) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h2>Gold Found!</h2>
          <p style={{ color: '#fbbf24', fontSize: 16, margin: '12px 0' }}>
            {state.lastPathPlayerId
              ? `${displayName(state.lastPathPlayerId)} reached the treasure!`
              : ''}
          </p>
          <p style={{ color: '#9ca3af' }}>
            Miners collect their shares... ({gd.nuggetPool.length} cards left)
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
              margin: '12px 0',
            }}
          >
            {gd.chooserChain.map((pid) => (
              <div
                key={pid}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${curChooser === pid ? '#fbbf24' : '#374151'}`,
                  background:
                    pid === playerId ? 'rgba(251,191,36,0.1)' : 'transparent',
                  color: '#d1d5db',
                  fontSize: 13,
                }}
              >
                {displayName(pid)}{' '}
                {state.goldNuggets[pid]
                  ? `(${String(state.goldNuggets[pid])})`
                  : ''}
                {curChooser === pid && ' ← Picking'}
              </div>
            ))}
          </div>
          {isMyCollectTurn && (
            <div>
              <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>
                Pool: {gd.nuggetPool.join(', ')}
              </p>
              <button style={btn()} onClick={handleCollectGold}>
                Pick a nugget
              </button>
            </div>
          )}
          <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
            Gold: {state.goldNuggets[playerId] ?? 0}
          </div>
        </div>
      )
    }

    if (isSaboteurWin && gd.chooserChain.length > 0) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <h2>Saboteurs Win!</h2>
          <p style={{ color: '#f87171', fontSize: 16, margin: '12px 0' }}>
            The gold wasn't found! Saboteurs collect {gd.saboteurPayout} nuggets
            each.
          </p>
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
              margin: '12px 0',
            }}
          >
            {gd.chooserChain.map((pid) => (
              <div
                key={pid}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: `1px solid ${curChooser === pid ? '#fbbf24' : '#374151'}`,
                  color: '#d1d5db',
                  fontSize: 13,
                }}
              >
                {displayName(pid)}{' '}
                {state.goldNuggets[pid]
                  ? `(${String(state.goldNuggets[pid])})`
                  : ''}
                {curChooser === pid && ' ← Collecting'}
              </div>
            ))}
          </div>
          {isMyCollectTurn && (
            <button style={btn()} onClick={handleCollectGold}>
              Collect {gd.saboteurPayout} Nuggets
            </button>
          )}
        </div>
      )
    }
  }

  if (
    state.phase === 'setup' ||
    state.phase === 'game-over' ||
    (state.phase === 'round-end' &&
      state.goldDist &&
      state.goldDist.chooserChain.length === 0)
  ) {
    const isGameOver =
      state.phase === 'game-over' ||
      (state.round >= 3 && state.goldDist === null)
    const winnerText = 'Round complete!'

    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <h2>
          {isGameOver ? 'Game Over!' : `Round ${String(state.round)} Complete`}
        </h2>
        <p style={{ color: '#fbbf24', fontSize: 16, margin: 8 }}>
          {winnerText}
        </p>
        <div style={{ fontSize: 13, color: '#9ca3af', margin: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Results:</div>
          {state.playerOrder.map((pid) => (
            <div key={pid} style={{ margin: 2 }}>
              {displayName(pid)} —{' '}
              {state.roles[pid] === 'miner' ? 'Gold Miner' : 'Saboteur'} —{' '}
              {state.goldNuggets[pid] ?? 0}G
            </div>
          ))}
        </div>
        {isGameOver ? (
          <div>
            <p
              style={{
                color: '#34d399',
                fontSize: 18,
                fontWeight: 700,
                margin: 12,
              }}
            >
              Game Over!
            </p>
            <button style={btn()} onClick={handleReset}>
              Play Again
            </button>
          </div>
        ) : state.round < 3 ? (
          <button style={btn()} onClick={handleStartNextRound}>
            Start Round {state.round + 1}
          </button>
        ) : null}
      </div>
    )
  }

  // ── Main Game Board ────────────────────────────────

  return (
    <div
      style={{
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'center',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>
          Saboteur{' '}
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            R{state.round}/3
          </span>
        </h2>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isMyTurn ? '#34d399' : '#9ca3af',
          }}
        >
          {statusText}
        </span>
        {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          myRole && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 4,
                background: ROLE_COLORS[myRole] ?? '#374151',
                color: '#fff',
              }}
            >
              {myRole === 'miner' ? 'Gold Miner' : 'Saboteur'}
            </span>
          )
        }
        {hasBrokenTools && (
          <span style={{ fontSize: 11, color: '#f87171' }}>
            Broken tools:{' '}
            {brokenTools.map((b) => ACTION_LABELS[b.actionType]).join(', ')}
          </span>
        )}
      </div>

      {/* Drag-drop instruction */}
      {actionTarget && (
        <div style={{ fontSize: 12, color: '#60a5fa', textAlign: 'center' }}>
          {actionTarget.actionType === 'rockfall' &&
            'Click a path card on the board to remove it'}
          {actionTarget.actionType === 'map' &&
            'Click a goal card to peek at it'}
          {(actionTarget.actionType.startsWith('break') ||
            actionTarget.actionType.startsWith('repair')) &&
            'Select a target player below'}
          <button
            style={{
              ...btn(),
              fontSize: 10,
              padding: '2px 8px',
              marginLeft: 8,
            }}
            onClick={() => {
              setActionTarget(null)
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {(selectedCard || rotatedConns !== 0) && selectedCard && (
        <div style={{ fontSize: 12, color: '#60a5fa', textAlign: 'center' }}>
          Click an open tile to place, or press <kbd style={kbdStyle}>R</kbd> to
          rotate
          <button
            style={{
              ...btn(),
              fontSize: 10,
              padding: '2px 8px',
              marginLeft: 8,
            }}
            onClick={handleRotate}
          >
            Rotate {rotatedConns}°
          </button>
        </div>
      )}

      {/* Player Target Selection */}
      {actionTarget && possibleTargets.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {possibleTargets.map((tpid) => (
            <button
              key={tpid}
              style={btn()}
              onClick={() => {
                handlePlayAction(tpid)
              }}
            >
              {displayName(tpid)}
              {actionTarget.actionType.startsWith('repair') &&
                state.brokenTools[tpid].length > 0 && (
                  <span
                    style={{ marginLeft: 4, fontSize: 10, color: '#f87171' }}
                  >
                    [
                    {state.brokenTools[tpid]
                      .map((b) => ACTION_LABELS[b.actionType])
                      .join(', ')}
                    ]
                  </span>
                )}
            </button>
          ))}
          {actionTarget.actionType.startsWith('repair') && (
            <div>
              {actionTarget.actionType === 'repair-dual' &&
                possibleTargets.map((tpid) =>
                  state.brokenTools[tpid].map((bt) => (
                    <button
                      key={`${tpid}-${bt.actionType}`}
                      style={btn()}
                      onClick={() => {
                        const repairType = bt.actionType.replace('break-', '')
                        handlePlayAction(tpid, repairType)
                      }}
                    >
                      Fix {ACTION_LABELS[bt.actionType]} on {displayName(tpid)}
                    </button>
                  ))
                )}
            </div>
          )}
        </div>
      )}

      {/* Board */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: GAP,
          alignItems: 'center',
        }}
      >
        {/* Goal row labels */}
        <div style={{ display: 'flex', gap: GAP }}>
          {Array.from({ length: BOARD_COLS }).map((_, col) => {
            const goal = state.goalCards.find(
              (g) => g.col === col && g.row === 0
            )
            const isAdjacentToPath =
              !goal?.revealed && openSet.has(`${String(col)},0`)
            const bgColor = goal?.revealed
              ? goal.isTreasure
                ? '#854d0e'
                : '#4a4a4a'
              : isAdjacentToPath
                ? 'rgba(59,130,246,0.15)'
                : '#0f172a'
            const cursor =
              actionTarget?.actionType === 'map' && goal && !goal.revealed
                ? 'pointer'
                : 'default'
            return (
              <div
                key={col}
                style={{
                  width: CELL,
                  height: 50,
                  borderRadius: 4,
                  border: `1px solid ${goal && !goal.revealed ? (goal.isTreasure ? '#854d0e' : '#4a4a4a') : '#374151'}`,
                  background: bgColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  color: '#9ca3af',
                  cursor,
                  position: 'relative',
                  flexDirection: 'column',
                }}
                onClick={() => {
                  if (
                    goal &&
                    !goal.revealed &&
                    actionTarget?.actionType === 'map'
                  ) {
                    handleCellClick(goal.col, goal.row)
                  }
                }}
              >
                {goal?.revealed ? (goal.isTreasure ? 'GOLD' : 'STONE') : '?'}
                {goal?.revealed && (
                  <span
                    style={{
                      fontSize: 9,
                      color: goal.isTreasure ? '#fbbf24' : '#9ca3af',
                      marginTop: 2,
                    }}
                  >
                    {goal.isTreasure ? 'Treasure!' : 'No luck'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Board grid */}
        {Array.from({ length: BOARD_ROWS }).map((_, row) => (
          <div key={row} style={{ display: 'flex', gap: GAP }}>
            {Array.from({ length: BOARD_COLS }).map((_, col) => {
              const cell = state.board[row][col]
              const isOpen = openSet.has(`${String(col)},${String(row)}`)
              const isDropHover =
                dropTarget?.col === col && dropTarget.row === row

              if (cell) {
                return (
                  <BoardCell
                    key={`${String(col)}-${String(row)}`}
                    cell={cell}
                  />
                )
              }

              if (isOpen && canPlayPath) {
                return (
                  <div
                    key={`${String(col)}-${String(row)}`}
                    onDragOver={(e) => {
                      handleCellDragOver(e, col, row)
                    }}
                    onDrop={(e) => {
                      handleCellDrop(e, col, row)
                    }}
                    onClick={() => {
                      if (selectedCard) handleCellClick(col, row)
                    }}
                    style={{
                      width: CELL,
                      height: CELL,
                      borderRadius: 4,
                      border: `2px dashed ${isDropHover ? '#60a5fa' : '#4b5563'}`,
                      background: isDropHover
                        ? 'rgba(59,130,246,0.25)'
                        : 'rgba(59,130,246,0.08)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      color: '#60a5fa',
                      transition: 'all 0.12s',
                    }}
                    aria-label={`Place card at ${String(col)}, ${String(row)}`}
                  >
                    +
                  </div>
                )
              }

              return (
                <div
                  key={`${String(col)}-${String(row)}`}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 4,
                    border: '1px solid #1f2937',
                    background:
                      row === START_ROW && col === START_COL
                        ? '#166534'
                        : '#0f172a',
                  }}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Deck info */}
      <div style={{ fontSize: 11, color: '#6b7280' }}>
        Deck: {state.deck.length} cards
      </div>

      {/* Hand */}
      <div style={{ width: '100%', maxWidth: 600 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 12, color: '#d1d5db' }}>
            Your Hand ({myHand.length}){' '}
            {isMyTurn ? '(click to select, then place)' : ''}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {myHand.map((card) => {
            const isSelected = selectedCard === card.id
            const isActionTarget = actionTarget?.cardId === card.id
            const isPath = card.suit === 'path'
            const isAction = card.suit === 'action'
            const pathCard = isPath ? card : null
            const actionCard = isAction ? card : null

            return (
              <div
                key={card.id}
                draggable={isPath && isMyTurn && canPlayPath}
                onDragStart={(e) => {
                  if (isPath && isMyTurn && canPlayPath) {
                    e.dataTransfer.setData('text/card-id', card.id)
                    setSelectedCard(card.id)
                    setRotatedConns(0)
                  }
                }}
                onClick={() => {
                  handleCardSelect(card.id, card.suit)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'r' && isSelected) handleRotate()
                }}
                tabIndex={0}
                style={{
                  width: 85,
                  minHeight: 48,
                  borderRadius: 6,
                  border: `2px solid ${isSelected || isActionTarget ? '#60a5fa' : '#374151'}`,
                  padding: 6,
                  background: isPath ? '#1e3a5f' : '#3b1f3b',
                  cursor: isMyTurn ? 'pointer' : 'default',
                  fontSize: 11,
                  color: '#e5e7eb',
                  transition: 'border-color 0.12s, transform 0.12s',
                  transform: isSelected ? 'translateY(-4px)' : 'none',
                  opacity: !isMyTurn || (isPath && hasBrokenTools) ? 0.5 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                {isPath && pathCard && (
                  <>
                    <TunnelSvg
                      connections={
                        isSelected
                          ? rotateConns(pathCard.connections, rotatedConns)
                          : pathCard.connections
                      }
                      size={48}
                      color={isSelected ? '#60a5fa' : '#fbbf24'}
                    />
                    <div
                      style={{
                        fontSize: 8,
                        color: '#9ca3af',
                        marginTop: 1,
                        textAlign: 'center',
                      }}
                    >
                      {isSelected
                        ? `${pathCard.shape} ${String(rotatedConns)}°`
                        : pathCard.shape}
                    </div>
                  </>
                )}
                {isAction && actionCard && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 10 }}>
                      {ACTION_LABELS[actionCard.actionType] ??
                        actionCard.actionType}
                    </div>
                  </div>
                )}
                {isMyTurn && (
                  <button
                    style={{
                      fontSize: 9,
                      padding: '1px 6px',
                      marginTop: 4,
                      background: '#4b5563',
                      border: '1px solid #6b7280',
                      borderRadius: 3,
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDiscard(card.id)
                    }}
                  >
                    Discard
                  </button>
                )}
              </div>
            )
          })}
          {myHand.length === 0 && (
            <span style={{ color: '#6b7280', fontSize: 12 }}>
              No cards in hand
            </span>
          )}
        </div>
      </div>

      {/* Players */}
      <div style={{ width: '100%', maxWidth: 600 }}>
        <span
          style={{
            fontSize: 12,
            color: '#d1d5db',
            marginBottom: 4,
            display: 'block',
          }}
        >
          Players
        </span>
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}
        >
          {state.playerOrder.map((pid) => {
            const p = state.players[pid]
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            if (!p) return null
            const isCurrent = pid === currentPlayerId
            const bt = state.brokenTools[pid] ?? []
            return (
              <div
                key={pid}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  border: `1px solid ${isCurrent ? '#fbbf24' : '#374151'}`,
                  background:
                    pid === playerId ? 'rgba(59,130,246,0.1)' : 'transparent',
                  color: '#d1d5db',
                }}
              >
                <div>{displayName(pid)}</div>
                {bt.length > 0 && (
                  <div style={{ fontSize: 9, color: '#f87171' }}>
                    {bt.map((b) => ACTION_LABELS[b.actionType]).join(', ')}
                  </div>
                )}
                {isCurrent && (
                  <div style={{ fontSize: 9, color: '#fbbf24' }}>← Turn</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Tunnel visualization ───────────────────────────

const rotateConns = (
  conns: [boolean, boolean, boolean, boolean],
  rot: 0 | 90 | 180 | 270
): [boolean, boolean, boolean, boolean] => {
  if (rot === 0) return conns
  const shifts = rot / 90
  const r: [boolean, boolean, boolean, boolean] = [false, false, false, false]
  for (let i = 0; i < 4; i++) r[(i + shifts) % 4] = conns[i]
  return r
}

const TunnelSvg = ({
  connections,
  size = 60,
  color = '#fbbf24',
}: {
  connections: [boolean, boolean, boolean, boolean]
  size?: number
  color?: string
}) => {
  const [n, e, s, w] = connections
  const h = size / 2
  const tw = Math.max(6, size / 6)
  const hw = tw / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
    >
      {n && (
        <rect x={h - hw} y={0} width={tw} height={h} fill={color} rx={hw} />
      )}
      {s && (
        <rect x={h - hw} y={h} width={tw} height={h} fill={color} rx={hw} />
      )}
      {e && (
        <rect x={h} y={h - hw} width={h} height={tw} fill={color} rx={hw} />
      )}
      {w && (
        <rect x={0} y={h - hw} width={h} height={tw} fill={color} rx={hw} />
      )}
      {(n || s || e || w) && <circle cx={h} cy={h} r={hw + 1} fill={color} />}
    </svg>
  )
}

// ── BoardCell subcomponent ──────────────────────────

const BoardCell = ({
  cell,
}: {
  cell: NonNullable<SaboteurState['board'][number][number]>
}) => {
  const card = cell.card
  const shape = card.shape
  const isStart = shape === 'start'
  const isGoal = shape === 'goal-gold' || shape === 'goal-stone'
  const color = isStart
    ? '#166534'
    : isGoal
      ? card.shape === 'goal-gold'
        ? '#854d0e'
        : '#4a4a4a'
      : '#1e293b'
  const char = SHAPE_CHAR[shape] ?? ''
  const [n, e, s, w] = card.connections

  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 4,
        border: '1px solid #374151',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isGoal ? 10 : 13,
        fontWeight: 700,
        color: '#f9fafb',
        position: 'relative',
      }}
    >
      {!isStart && !isGoal && (
        <TunnelSvg connections={[n, e, s, w]} size={CELL - 8} color="#fbbf24" />
      )}
      {isStart && <span>{char}</span>}
      {isGoal && (
        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{ fontSize: 16 }}>{char}</div>
          <div style={{ fontSize: 8, opacity: 0.8 }}>
            {shape === 'goal-gold' ? 'GOLD' : 'STONE'}
          </div>
        </div>
      )}
    </div>
  )
}
