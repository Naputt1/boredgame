import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Container, Graphics, Stage, Text } from '@pixi/react'
import * as PIXI from 'pixi.js'
import { Graphics as PixiGraphics, TextStyle } from 'pixi.js'
import type { GameRendererProps } from '@boredgame/core'
import type { UnoState, UnoColor, PlayerId } from './state'
import type { UnoAction } from './actions'
import { COLORS, UnoCard } from './state'
import { DeckRenderable, Hand } from '@boredgame/pixi-renderer'

const CARD_W = 60
const CARD_H = 90

const COLOR_VALUES: Record<UnoColor, number> = {
  red: 0xef4444,
  yellow: 0xeab308,
  green: 0x22c55e,
  blue: 0x3b82f6,
}

const COLOR_CSS: Record<UnoColor, string> = {
  red: '#ef4444',
  yellow: '#eab308',
  green: '#22c55e',
  blue: '#3b82f6',
}

const smallTextStyle = new TextStyle({
  fontFamily: 'Inter, system-ui, sans-serif',
  fill: '#9ca3af',
  fontSize: 11,
})

const COLOR_PICKER_SIZE = 40

const drawCardGraphics = (
  card: UnoCard,
  faceUp: boolean,
  selected: boolean
) => {
  return (g: PixiGraphics) => {
    g.clear()
    const w = CARD_W
    const h = CARD_H
    const r = 8

    if (faceUp) {
      if (card.unoValue === 'wild' || card.unoValue === 'wild-draw-four') {
        const segH = h / 4
        for (let i = 0; i < 4; i++) {
          g.beginFill(COLOR_VALUES[COLORS[i]])
          g.drawRoundedRect(0, i * segH, w, segH + (i === 3 ? 0 : 1), i === 0 ? r : 0)
          g.endFill()
        }
        g.beginFill(0xffffff, 0.9)
        g.drawRoundedRect(w * 0.2, h * 0.3, w * 0.6, h * 0.4, 4)
        g.endFill()
      } else if (card.unoColor) {
        g.beginFill(COLOR_VALUES[card.unoColor])
        g.drawRoundedRect(0, 0, w, h, r)
        g.endFill()
      }
      g.lineStyle(2, 0xffffff, 0.9)
      g.drawRoundedRect(0, 0, w, h, r)
      if (selected) {
        g.lineStyle(3, 0xfbbf24, 1)
        g.drawRoundedRect(-2, -2, w + 4, h + 4, r + 2)
      }
    } else {
      g.beginFill(0x1e3a5f)
      g.drawRoundedRect(0, 0, w, h, r)
      g.endFill()
      g.lineStyle(2, 0xffffff, 0.5)
      g.drawRoundedRect(0, 0, w, h, r)
      g.beginFill(0x3b82f6, 0.3)
      g.drawRoundedRect(6, 6, w - 12, h - 12, 6)
      g.endFill()
    }
  }
}

const ColorPicker = ({
  onPick,
  onCancel,
}: {
  onPick: (color: UnoColor) => void
  onCancel: () => void
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#1f2937',
        border: '2px solid #4b5563',
        borderRadius: 12,
        padding: 20,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <p style={{ color: '#d1d5db', fontSize: 13, fontWeight: 600 }}>
        Choose a color
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { onPick(c) }}
            style={{
              width: COLOR_PICKER_SIZE,
              height: COLOR_PICKER_SIZE,
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.3)',
              background: COLOR_CSS[c],
              cursor: 'pointer',
            }}
            aria-label={c}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onCancel}
        style={{
          background: '#374151',
          border: '1px solid #6b7280',
          borderRadius: 6,
          padding: '4px 16px',
          color: '#d1d5db',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Cancel
      </button>
    </div>
  )
}

export const UnoView = ({
  state,
  playerId,
  sendAction,
  participants,
  connected,
}: GameRendererProps<UnoState, UnoAction>) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [pendingCardId, setPendingCardId] = useState<string | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [stageDims, setStageDims] = useState({ width: 700, height: 400 })

  useEffect(() => {
    const measure = () => {
      setStageDims({ width: window.innerWidth, height: window.innerHeight })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('resize', measure) }
  }, [])

  const { width: sW, height: sH } = stageDims
  const centerX = sW / 2
  const deckX = centerX - CARD_W - 15
  const discardX = centerX + 15
  const handY = sH - CARD_H - 40
  const tableY = handY / 2 - CARD_H / 2

  const deckContainerRef = useRef<PIXI.Container>(null)
  const discardContainerRef = useRef<PIXI.Container>(null)
  const handContainerRef = useRef<PIXI.Container>(null)
  const handRef = useRef<Hand | null>(null)

  const myHand: UnoCard[] = useMemo(
    () => state.hands[playerId] ?? [],
    [state.hands, playerId]
  )

  const currentPlayerId = state.playerOrder[state.currentPlayerIndex]
  const isMyTurn = currentPlayerId === playerId && state.phase === 'playing'

  const displayName = useCallback(
    (pid: PlayerId): string => {
      const match = participants.find((p) => p.id === pid)
      return match?.globalName ?? match?.username ?? pid
    },
    [participants]
  )

  useEffect(() => {
    if (!connected || playerId in state.players || state.phase !== 'joining') return
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
    return () => { clearTimeout(t) }
  }, [playerId, state.players, sendAction, displayName, connected, state.phase])

  useEffect(() => {
    if (state.phase !== 'joining') return
    if (!(playerId in state.players)) return
    if (state.playerOrder.length < 1) return
    const t = setTimeout(() => {
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
    }, 500)
    return () => { clearTimeout(t) }
  }, [playerId, state.players, state.phase, state.playerOrder.length, sendAction])

  useEffect(() => {
    if (!deckContainerRef.current) return
    const c = deckContainerRef.current
    c.removeChildren()
    if (state.deck.items.length === 0) {
      const g = new PixiGraphics()
      g.lineStyle(2, 0x4b5563, 0.3)
      g.beginFill(0x1f2937, 0.5)
      g.drawRoundedRect(0, 0, CARD_W, CARD_H, 8)
      g.endFill()
      c.addChild(g)
      return
    }
    const deck = new DeckRenderable({
      items: state.deck.items,
      id: 'deck',
    })
    deck.cardWidth = CARD_W
    deck.cardHeight = CARD_H
    deck.render(c)
    c.eventMode = isMyTurn ? 'static' : 'auto'
    c.cursor = isMyTurn ? 'pointer' : 'default'
    c.on('pointerdown', () => {
      if (isMyTurn) {
        sendAction({
          type: 'draw.card',
          version: 1,
          payload: {},
          meta: {
            playerId,
            timestamp: Date.now(),
            actionId: `draw:${playerId}:${String(Date.now())}`,
          },
        })
        setSelectedCardId(null)
      }
    })
    return () => {
      c.removeAllListeners()
    }
  }, [state, isMyTurn, playerId, sendAction])

  useEffect(() => {
    if (!discardContainerRef.current) return
    const c = discardContainerRef.current
    c.removeChildren()
    const cards = state.discardPile
    const visible = Math.min(cards.length, 3)
    for (let i = 0; i < visible; i++) {
      const idx = cards.length - visible + i
      const card = cards[idx]
      if (i === visible - 1) {
        const g = new PixiGraphics()
        g.clear()
        const w = CARD_W
        const h = CARD_H
        const r = 8
        if (card.unoValue === 'wild' || card.unoValue === 'wild-draw-four') {
          if (state.currentColor) {
            g.beginFill(COLOR_VALUES[state.currentColor])
            g.drawRoundedRect(0, 0, w, h, r)
            g.endFill()
          } else {
            const segH = h / 4
            for (let j = 0; j < 4; j++) {
              g.beginFill(COLOR_VALUES[COLORS[j]])
              g.drawRoundedRect(0, j * segH, w, segH + (j === 3 ? 0 : 1), j === 0 ? r : 0)
              g.endFill()
            }
            g.beginFill(0xffffff, 0.9)
            g.drawRoundedRect(w * 0.2, h * 0.3, w * 0.6, h * 0.4, 4)
            g.endFill()
          }
        } else if (card.unoColor) {
          g.beginFill(COLOR_VALUES[card.unoColor])
          g.drawRoundedRect(0, 0, w, h, r)
          g.endFill()
        }
        g.lineStyle(2, 0xffffff, 0.9)
        g.drawRoundedRect(0, 0, w, h, r)
        c.addChild(g)
        const isWild = card.unoValue === 'wild' || card.unoValue === 'wild-draw-four'
        const hasChosenColor = isWild && state.currentColor != null
        const labelText = new PIXI.Text(
          card.label,
          new TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fill: hasChosenColor ? '#ffffff' : isWild ? '#1a1a2e' : '#ffffff',
            fontSize: 18,
            fontWeight: '800',
          })
        )
        labelText.anchor.set(0.5)
        labelText.x = w / 2
        labelText.y = h / 2
        c.addChild(labelText)
      } else {
        const g = new PixiGraphics()
        g.lineStyle(1, 0xffffff, 0.3)
        g.beginFill(0x1e3a5f)
        g.drawRoundedRect(i * 2, i * 2, CARD_W, CARD_H, 6)
        g.endFill()
        c.addChild(g)
      }
    }
    if (cards.length === 0) {
      const g = new PixiGraphics()
      g.lineStyle(2, 0x4b5563, 0.5)
      g.beginFill(0x1f2937, 0.3)
      g.drawRoundedRect(0, 0, CARD_W, CARD_H, 6)
      g.endFill()
      c.addChild(g)
    }
  }, [state])

  const handleCardClick = useCallback(
    (card: UnoCard) => {
      if (!isMyTurn) return
      if (card.unoValue === 'wild' || card.unoValue === 'wild-draw-four') {
        setPendingCardId(card.id)
        setShowColorPicker(true)
        return
      }
      sendAction({
        type: 'play.card',
        version: 1,
        payload: { cardId: card.id },
        meta: {
          playerId,
          timestamp: Date.now(),
          actionId: `play:${playerId}:${card.id}:${String(Date.now())}`,
        },
      })
    },
    [isMyTurn, playerId, sendAction]
  )

  const drawUnoCard: import('@boredgame/pixi-renderer').DrawCardFn = useCallback(
    (g, card, w, h, faceUp, highlight) => {
      g.clear()
      const r = 8
      if (faceUp) {
        const unoCard = card as UnoCard
        const isWild = unoCard.unoValue === 'wild' || unoCard.unoValue === 'wild-draw-four'
        if (isWild) {
          const segH = h / 4
          for (let j = 0; j < 4; j++) {
            g.beginFill(COLOR_VALUES[COLORS[j]])
            g.drawRoundedRect(0, j * segH, w, segH + (j === 3 ? 0 : 1), j === 0 ? r : 0)
            g.endFill()
          }
          g.beginFill(0xffffff, 0.9)
          g.drawRoundedRect(w * 0.2, h * 0.3, w * 0.6, h * 0.4, 4)
          g.endFill()
        } else if (unoCard.unoColor) {
          g.beginFill(COLOR_VALUES[unoCard.unoColor])
          g.drawRoundedRect(0, 0, w, h, r)
          g.endFill()
        }
        g.lineStyle(2, 0xffffff, 0.9)
        g.drawRoundedRect(0, 0, w, h, r)
        if (highlight) {
          g.lineStyle(3, 0xfbbf24, 1)
          g.drawRoundedRect(-2, -2, w + 4, h + 4, r + 2)
        }
        const labelText = new PIXI.Text(
          unoCard.label,
          new PIXI.TextStyle({
            fontFamily: 'Inter, system-ui, sans-serif',
            fill: isWild ? '#1a1a2e' : '#ffffff',
            fontSize: 18,
            fontWeight: '800',
          })
        )
        labelText.anchor.set(0.5)
        labelText.x = w / 2
        labelText.y = h / 2
        g.parent.addChild(labelText)
      } else {
        g.beginFill(0x1e3a5f)
        g.drawRoundedRect(0, 0, w, h, r)
        g.endFill()
        g.lineStyle(2, 0xffffff, 0.5)
        g.drawRoundedRect(0, 0, w, h, r)
        g.beginFill(0x3b82f6, 0.3)
        g.drawRoundedRect(6, 6, w - 12, h - 12, 6)
        g.endFill()
      }
    },
    []
  )

  useEffect(() => {
    if (!handContainerRef.current) return
    const c = handContainerRef.current
    c.removeChildren()
    c.eventMode = 'static'
    const hand = new Hand({ items: myHand, id: 'hand' })
    handRef.current = hand
    hand.renderCurved(c, {
      centerX,
      canvasHeight: sH,
      canvasWidth: sW,
      cardWidth: CARD_W,
      cardHeight: CARD_H,
      selectedCardId: null,
      hoveredCardId: null,
      drawCard: drawUnoCard,
      onCardClick: (cardId) => {
        if (!isMyTurn) return
        const card = myHand.find((c) => c.id === cardId)
        if (!card) return
        setSelectedCardId((prev) => {
          if (cardId !== prev) {
            handleCardClick(card)
          }
          return cardId === prev ? null : cardId
        })
      },
      onCardHover: (cardId) => { setHoveredCardId(cardId) },
    })
  }, [state, myHand.length, myHand, sW, sH, centerX, drawUnoCard, isMyTurn, handleCardClick])

  useEffect(() => {
    handRef.current?.applyHighlight(hoveredCardId, selectedCardId)
  }, [hoveredCardId, selectedCardId])

  const handleColorPick = useCallback(
    (color: UnoColor) => {
      if (!pendingCardId) return
      setShowColorPicker(false)
      sendAction({
        type: 'play.card',
        version: 1,
        payload: { cardId: pendingCardId, chosenColor: color },
        meta: {
          playerId,
          timestamp: Date.now(),
          actionId: `play:${playerId}:${pendingCardId}:${String(Date.now())}`,
        },
      })
      setSelectedCardId(null)
      setPendingCardId(null)
    },
    [pendingCardId, playerId, sendAction]
  )

  const handleStartGame = useCallback(() => {
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

  const statusText = useMemo(() => {
    if (state.phase === 'joining') return 'Waiting for players...'
    if (state.phase === 'round-end') return 'Round over!'
    if (state.phase === 'game-over') return 'Game over!'
    if (state.playerOrder.length < 2) return `Solo game — ${String(state.playerOrder.length)} player`
    if (isMyTurn) return 'Your turn'
    return `${displayName(currentPlayerId)}'s turn`
    return ''
  }, [state.phase, state.playerOrder.length, isMyTurn, currentPlayerId, displayName])

  let overlay: React.JSX.Element | null = null

  if (state.phase === 'joining') {
    overlay = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.95)' }}>
        <h2>UNO</h2>
        <p style={{ color: '#9ca3af', marginTop: 8 }}>
          Waiting for players... ({state.playerOrder.length}/2 minimum)
        </p>
        {state.playerOrder.length >= 2 && (
          <button type="button" onClick={handleStartGame} style={{ marginTop: 16, padding: '10px 24px', background: '#3b82f6', border: 0, borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Start Game</button>
        )}
        {state.playerOrder.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
            {state.playerOrder.map((pid) => (<li key={pid} style={{ color: '#e5e7eb', padding: 4 }}>{displayName(pid)}</li>))}
          </ul>
        )}
      </div>
    )
  } else if (state.phase === 'round-end' || state.phase === 'game-over') {
    const isGameOver = state.phase === 'game-over'
    overlay = (
      <div style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.95)' }}>
        <h2>{isGameOver ? 'Game Over!' : 'Round Complete'}</h2>
        <div style={{ fontSize: 13, color: '#9ca3af', margin: 8 }}>
          <div style={{ marginBottom: 4, fontWeight: 600 }}>Scores:</div>
          {state.playerOrder.map((pid) => (<div key={pid} style={{ margin: 2 }}>{displayName(pid)} — {state.scores[pid] ?? 0}</div>))}
        </div>
        {isGameOver ? (
          <button type="button" onClick={handleReset} style={{ marginTop: 12, padding: '8px 20px', background: '#3b82f6', border: 0, borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Play Again</button>
        ) : (
          <button type="button" onClick={handleStartGame} style={{ marginTop: 12, padding: '8px 20px', background: '#3b82f6', border: 0, borderRadius: 8, color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Next Round</button>
        )}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {showColorPicker && (
        <ColorPicker
          onPick={handleColorPick}
          onCancel={() => {
            setShowColorPicker(false)
            setPendingCardId(null)
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>
          UNO
        </h2>
        {state.currentColor && (
          <span
            style={{
              display: 'inline-block',
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: COLOR_CSS[state.currentColor],
              border: '2px solid rgba(255,255,255,0.3)',
            }}
          />
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isMyTurn ? '#34d399' : '#9ca3af',
          }}
        >
          {statusText}
        </span>
        {state.lastAction && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>
            {state.lastAction}
          </span>
        )}
      </div>

      <Stage
        width={stageDims.width}
        height={stageDims.height}
        options={{ backgroundColor: 0x0f172a, antialias: true }}
      >
        <Container x={deckX} y={tableY}>
          <Container ref={deckContainerRef} />
        </Container>
        <Container x={discardX} y={tableY}>
          <Container ref={discardContainerRef} />
        </Container>

        <Container ref={handContainerRef} />

        {Array.from({ length: Math.min(state.playerOrder.length, 4) }).map(
          (_, i) => {
            const pid = state.playerOrder[i]
            if (pid === playerId) return null
            const hand = state.hands[pid]
            const isCurrent = pid === currentPlayerId
            const x = 50 + i * 160
            return (
              <Container key={pid}>
                <Text
                  text={displayName(pid)}
                  anchor={0.5}
                  x={x + 30}
                  y={20}
                  style={
                    new TextStyle({
                      fontFamily: 'Inter, system-ui, sans-serif',
                      fill: isCurrent ? '#fbbf24' : '#9ca3af',
                      fontSize: 11,
                      fontWeight: isCurrent ? '700' : '400',
                    })
                  }
                />
                <Text
                  text={`${String(hand.length)} cards`}
                  anchor={0.5}
                  x={x + 30}
                  y={36}
                  style={smallTextStyle}
                />
                {/* Draw card backs */}
                {hand.length > 0 && (
                  <Container x={x} y={48}>
                    {hand.slice(0, Math.min(hand.length, 5)).map((_, j) => (
                      <Graphics
                        key={String(j)}
                        x={j * 3}
                        y={j * 2}
                        draw={drawCardGraphics(
                          new (UnoCard as unknown as new () => UnoCard)(),
                          false,
                          false
                        )}
                      />
                    ))}
                    {hand.length > 5 && (
                      <Text
                        text={`+${String(hand.length - 5)}`}
                        anchor={0.5}
                        x={30}
                        y={-5}
                        style={smallTextStyle}
                      />
                    )}
                  </Container>
                )}
              </Container>
            )
          }
        )}
      </Stage>
      {overlay}
    </div>
  )
}
