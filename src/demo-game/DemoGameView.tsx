import { useCallback, useEffect, useMemo } from 'react'
import { Container, Graphics, Stage, Text } from '@pixi/react'
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js'
import type { GameRendererProps } from '@boredgame/core'
import type { DemoGameState, BoardPosition } from './state'
import type { DemoGameAction } from './actions'
import {
  createPlayerJoinedAction,
  createTokenMovedAction,
  createGameResetAction,
} from './actionFactory'

const cellSize = 56
const boardPadding = 16

const playerPalette = ['#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed']

const tokenLabelStyle = new TextStyle({
  fill: '#ffffff',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  fontWeight: '700',
})

const drawBoardCell = (isAlternate: boolean) => (graphics: PixiGraphics) => {
  graphics.clear()
  graphics.beginFill(isAlternate ? 0xe8edf7 : 0xf7fafc)
  graphics.lineStyle(1, 0x6b7280, 0.35)
  graphics.drawRoundedRect(0, 0, cellSize, cellSize, 6)
  graphics.endFill()
}

const drawToken = (color: string) => (graphics: PixiGraphics) => {
  graphics.clear()
  graphics.beginFill(Number.parseInt(color.replace('#', '0x'), 16))
  graphics.lineStyle(3, 0xffffff, 0.9)
  graphics.drawCircle(cellSize / 2, cellSize / 2, 18)
  graphics.endFill()
}

export const DemoGameView = ({
  state,
  playerId,
  sendAction,
  participants,
  connected,
}: GameRendererProps<DemoGameState, DemoGameAction>) => {
  const displayName = useCallback(
    (pid: string): string => {
      const match = participants.find((p) => p.id === pid)
      if (match) return match.globalName ?? match.username
      return `Player ${pid.slice(0, 4)}`
    },
    [participants]
  )

  const ownToken = useMemo(
    () => Object.values(state.tokens).find((t) => t.ownerId === playerId),
    [playerId, state.tokens]
  )

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!connected || state.players[playerId]) {
      return
    }

    const playerIndex = Object.keys(state.players).length % playerPalette.length
    sendAction(
      createPlayerJoinedAction(
        playerId,
        displayName(playerId),
        playerPalette[playerIndex],
        `token:${playerId}`,
        { x: playerIndex, y: playerIndex }
      )
    )
  }, [playerId, sendAction, state.players, displayName, connected])

  const moveToken = useCallback(
    (to: BoardPosition) => {
      if (!ownToken) {
        return
      }
      sendAction(createTokenMovedAction(playerId, ownToken.id, to))
    },
    [ownToken, playerId, sendAction]
  )

  const resetGame = useCallback(() => {
    sendAction(createGameResetAction(playerId))
  }, [playerId, sendAction])

  const width = state.board.width * cellSize + boardPadding * 2
  const height = state.board.height * cellSize + boardPadding * 2

  return (
    <div>
      <button type="button" onClick={resetGame}>
        Reset
      </button>
      <div className="play-surface" style={{ marginTop: 12 }}>
        <div className="board-frame" style={{ width, height }}>
          <Stage
            width={width}
            height={height}
            options={{ backgroundColor: 0x0f172a, antialias: true }}
          >
            <Container x={boardPadding} y={boardPadding}>
              {Array.from({ length: state.board.height }).flatMap((_, y) =>
                Array.from({ length: state.board.width }).map((__, x) => (
                  <Graphics
                    key={`${String(x)}:${String(y)}`}
                    x={x * cellSize}
                    y={y * cellSize}
                    draw={drawBoardCell((x + y) % 2 === 0)}
                  />
                ))
              )}

              {Object.values(state.tokens).map((token) => {
                const player = state.players[token.ownerId]
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                const label = player?.name.slice(0, 1).toUpperCase() ?? '?'

                return (
                  <Container
                    key={token.id}
                    x={token.position.x * cellSize}
                    y={token.position.y * cellSize}
                  >
                    {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
                    <Graphics draw={drawToken(player?.color ?? '#64748b')} />
                    <Text
                      text={label}
                      anchor={0.5}
                      x={cellSize / 2}
                      y={cellSize / 2 + 1}
                      style={tokenLabelStyle}
                    />
                  </Container>
                )
              })}
            </Container>
          </Stage>
          <div
            className="board-hit-grid"
            style={{
              left: boardPadding,
              top: boardPadding,
              gridTemplateColumns: `repeat(${String(state.board.width)}, ${String(cellSize)}px)`,
              gridTemplateRows: `repeat(${String(state.board.height)}, ${String(cellSize)}px)`,
            }}
          >
            {Array.from({ length: state.board.height }).flatMap((_, y) =>
              Array.from({ length: state.board.width }).map((__, x) => (
                <button
                  key={`${String(x)}:${String(y)}`}
                  type="button"
                  className="board-cell-button"
                  aria-label={`Move token to ${String(x)}, ${String(y)}`}
                  onClick={() => {
                    moveToken({ x, y })
                  }}
                />
              ))
            )}
          </div>
        </div>
        <aside className="status-panel">
          <h3>Players</h3>
          <ul>
            {Object.values(state.players).map((player) => (
              <li key={player.id}>
                <span
                  className="player-swatch"
                  style={{ backgroundColor: player.color }}
                />
                <span>{displayName(player.id)}</span>
              </li>
            ))}
          </ul>
          <h3>Tokens</h3>
          <ul>
            {Object.values(state.tokens).map((token) => (
              <li key={token.id}>
                <span>{displayName(token.ownerId)}</span>
                <span>
                  {token.position.x}, {token.position.y}
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
