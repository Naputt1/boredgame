import type { z } from 'zod'

export type SyncMode = 'action' | 'state'

export type GameEngineMiddleware = {
  beforeSend?(action: unknown, state: unknown): void
  beforeApply?(action: unknown, state: unknown): void
  afterApply?(action: unknown, state: unknown): void
  onStateReplace?(state: unknown): void
  onError?(error: unknown): void
}

export type Unsubscribe = () => void

export type GameRendererProps<TState, TAction> = {
  state: TState
  playerId: string
  sendAction: (action: TAction) => void
  participants: Array<{ id: string; username: string; globalName?: string }>
  connected: boolean
}

export type VersionCompat = {
  engine: string
  state: string
  actionSchema: string
}

export type GameMetadata = {
  description: string
  minPlayers: number
  maxPlayers: number
  thumbnail?: string
  tags?: string[]
}

export type GameAssets = {
  scripts?: string[]
  styles?: string[]
  images?: string[]
}

export type RoomLifecycleState =
  | 'lobby'
  | 'starting'
  | 'in_game'
  | 'paused'
  | 'ended'
  | 'archived'

export type PlayerSlot = {
  playerId: string
  joinedAt: number
  isSpectator: boolean
  isReady: boolean
}

export type RoomConfig = {
  maxPlayers: number
  maxSpectators: number
  allowSpectators: boolean
}

export type ServerValidationResult =
  | { valid: true }
  | { valid: false; code: string; message: string }

export type GameDefinition<TState, TAction> = {
  id: string
  name: string
  version: VersionCompat
  metadata: GameMetadata
  createInitialState: () => TState
  reducer: (state: TState, action: TAction) => TState
  actionSchema: z.ZodType<TAction>
  stateSchema?: z.ZodType<TState>
  middleware?: GameEngineMiddleware[]
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  renderer: (props: GameRendererProps<TState, TAction>) => JSX.Element | null
  assets?: GameAssets
  validateAction?(
    action: TAction,
    state: TState,
    playerId: string
  ): ServerValidationResult
}
