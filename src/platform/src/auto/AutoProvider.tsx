/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { DiscordSDK } from '@discord/embedded-app-sdk'
import { GameProvider } from '@boredgame/react'
import { createTransport } from 'boredgame:transport'
import type {
  DiscordParticipant,
  PlatformContext,
  PlatformProviderProps,
} from '../types'

const PlatformCtx = createContext<PlatformContext | null>(null)

export const usePlatform = (): PlatformContext => {
  const value = useContext(PlatformCtx)
  if (!value) {
    throw new Error('usePlatform must be used inside PlatformProvider')
  }
  return value
}

const localId = (prefix: string): string => {
  const key = `boredgame:${prefix}`
  const stored = window.localStorage.getItem(key)
  if (stored) return stored
  const gen =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    window.crypto?.randomUUID?.() ??
    `${prefix}-${Math.random().toString(36).slice(2)}`
  window.localStorage.setItem(key, gen)
  return gen
}

export const PlatformProvider = ({
  children,
  gameDefinition,
  middleware,
}: PlatformProviderProps) => {
  const [ctx, setCtx] = useState<PlatformContext | null>(null)

  useEffect(() => {
    let cancelled = false
    const CLIENT_ID = (
      import.meta as unknown as { env: Record<string, string | undefined> }
    ).env.VITE_DISCORD_CLIENT_ID

    const detectAndInit = async () => {
      const search = new URLSearchParams(window.location.search)
      const hasDiscordParams = Boolean(
        search.get('frame_id') || search.get('instance_id')
      )

      if (CLIENT_ID && hasDiscordParams) {
        try {
          const sdk = new DiscordSDK(CLIENT_ID)
          await sdk.ready()
          const { user } = await sdk.commands.authenticate({})

          let participants: DiscordParticipant[] = []
          try {
            const result =
              await sdk.commands.getActivityInstanceConnectedParticipants()
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            participants = (result.participants ?? []).map((p) => ({
              id: p.id,
              username: p.username,
              globalName: p.global_name ?? undefined,
              avatar: p.avatar ?? undefined,
            }))
          } catch {
            /* not in Discord environment */
          }

          if (!cancelled) {
            setCtx({
              instanceId: sdk.instanceId,
              userId: user.id,
              username: user.global_name ?? user.username,
              participants,
              isDiscord: true,
            })
          }
          return
        } catch {
          // fall through to fallback
        }
      }

      if (!cancelled) {
        const uid = localId('local-user')
        setCtx({
          instanceId: localId('local-room'),
          userId: uid,
          username: `Player ${uid.slice(0, 4)}`,
          participants: [],
          isDiscord: false,
        })
      }
    }

    void detectAndInit()
    return () => {
      cancelled = true
    }
  }, [])

  const transport = useMemo(
    () =>
      ctx
        ? createTransport({
            playerId: ctx.userId,
            gameId: gameDefinition.id,
            instanceId: ctx.instanceId,
          })
        : null,
    [ctx, gameDefinition.id]
  )

  if (!ctx || !transport) {
    return null
  }

  return (
    <PlatformCtx.Provider value={ctx}>
      <GameProvider
        definition={gameDefinition}
        playerId={ctx.userId}
        roomId={ctx.instanceId}
        transport={transport}
        participants={ctx.participants}
        middleware={middleware}
      >
        {children}
      </GameProvider>
    </PlatformCtx.Provider>
  )
}
