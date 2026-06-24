import type { z } from "zod";

export type SyncMode = "action" | "state";

export type GameEngineMiddleware = {
  beforeSend?(action: unknown, state: unknown): void;
  beforeApply?(action: unknown, state: unknown): void;
  afterApply?(action: unknown, state: unknown): void;
  onStateReplace?(state: unknown): void;
  onError?(error: unknown): void;
};

export type Unsubscribe = () => void;

export type GameRendererProps<TState, TAction> = {
  state: TState;
  playerId: string;
  sendAction: (action: TAction) => void;
  participants: Array<{ id: string; username: string; globalName?: string }>;
  connected: boolean;
};

export type GameDefinition<TState, TAction> = {
  id: string;
  name: string;
  createInitialState: () => TState;
  reducer: (state: TState, action: TAction) => TState;
  actionSchema: z.ZodType<TAction>;
  stateSchema?: z.ZodType<TState>;
  middleware?: GameEngineMiddleware[];
  renderer: (props: GameRendererProps<TState, TAction>) => JSX.Element | null;
};
