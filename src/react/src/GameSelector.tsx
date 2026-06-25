import { useCallback, useMemo, useState } from 'react'
import type { GameMetadata } from '@boredgame/core'
import { GameRegistry } from '@boredgame/registry'

export type GameOption = { id: string; loaded: boolean } & GameMetadata

export type GameSelectorProps = {
  registry: GameRegistry
  onSelect: (def: unknown) => void
  onSelectLazy?: (id: string) => Promise<void>
}

const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '48px 24px',
  gap: 32,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 20,
  width: '100%',
  maxWidth: 720,
}

const cardStyle = (selected: boolean): React.CSSProperties => ({
  background: selected ? '#1e293b' : '#0f172a',
  border: selected ? '2px solid #3b82f6' : '1px solid #374151',
  borderRadius: 12,
  padding: 24,
  cursor: 'pointer',
  transition: 'all 0.15s',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
})

const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 4,
  background: '#374151',
  color: '#9ca3af',
}

export const GameSelector = ({ registry, onSelect }: GameSelectorProps) => {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const games = useMemo(() => registry.listMeta(), [registry])

  const handleSelect = useCallback(
    async (id: string) => {
      setSelectedId(id)
      const def = registry.get(id)
      if (def) {
        onSelect(def)
        return
      }
      setLoadingId(id)
      try {
        const loaded = await registry.load(id)
        onSelect(loaded)
      } catch (err) {
        console.error(`Failed to load game "${id}":`, err)
      } finally {
        setLoadingId(null)
      }
    },
    [registry, onSelect]
  )

  return (
    <div style={containerStyle}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Boredgame</h1>
        <p style={{ margin: '8px 0 0', color: '#9ca3af', fontSize: 14 }}>
          Select a game to play
        </p>
      </div>

      <div style={gridStyle}>
        {games.map((game) => (
          <button
            key={game.id}
            type="button"
            style={cardStyle(selectedId === game.id)}
            onClick={() => {
              void handleSelect(game.id)
            }}
            disabled={loadingId === game.id}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <strong style={{ fontSize: 18 }}>
                {game.id === 'boredgame-demo'
                  ? 'Demo Board'
                  : game.id === 'boredgame-tictactoe'
                    ? 'Tic-Tac-Toe'
                    : game.id}
              </strong>
              <span style={badgeStyle}>
                {game.minPlayers}-{game.maxPlayers}p
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: '#d1d5db',
                lineHeight: 1.4,
              }}
            >
              {game.description}
            </p>
            {game.tags && game.tags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  flexWrap: 'wrap',
                  marginTop: 4,
                }}
              >
                {game.tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      ...badgeStyle,
                      background: '#1f2937',
                      fontSize: 10,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {loadingId === game.id && (
              <span style={{ fontSize: 12, color: '#60a5fa' }}>Loading...</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
