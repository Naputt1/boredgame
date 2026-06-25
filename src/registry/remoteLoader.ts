import type { GameDefinition } from '@boredgame/core'

export const loadGameFromUrl = async <TState, TAction>(
  url: string
): Promise<GameDefinition<TState, TAction>> => {
  const mod: unknown = await import(/* @vite-ignore */ url)
  const gameModule = mod as Record<
    string,
    GameDefinition<TState, TAction> | undefined
  >
  const game = gameModule.default ?? Object.values(gameModule).find(Boolean)
  if (!game) throw new Error(`No game definition found in ${url}`)
  return game
}
