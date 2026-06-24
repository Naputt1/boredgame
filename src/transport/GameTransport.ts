export type Unsubscribe = () => void;

export interface GameTransport {
  connect(roomId: string): Promise<void>;
  sendAction(action: unknown): void;
  sendState?(state: unknown): void;
  onAction?(callback: (action: unknown) => void): Unsubscribe | void;
  onStateUpdate?(callback: (state: unknown) => void): Unsubscribe | void;
  disconnect?(): void | Promise<void>;
}
