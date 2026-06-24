import type { GameDefinition } from "@boredgame/core";

export const loadGameFromUrl = async <TState, TAction>(
  url: string
): Promise<GameDefinition<TState, TAction>> => {
  const mod = await import(/* @vite-ignore */ url);
  return mod.default ?? (Object.values(mod)[0] as GameDefinition<TState, TAction>);
};
