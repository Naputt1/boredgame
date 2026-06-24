import type { GameEngineMiddleware } from "@boredgame/core";

type ReduxDevToolsExtension = {
  connect: (options?: unknown) => ReduxDevToolsConnection;
};

type ReduxDevToolsConnection = {
  send: (action: unknown, state: unknown) => void;
  init: (state: unknown) => void;
  subscribe: (listener: (message: { type: string; payload?: unknown; state?: string }) => void) => () => void;
  unsubscribe: () => void;
};

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevToolsExtension;
  }
}

export const devtoolsBridgeMiddleware = (
  name = "boredgame"
): GameEngineMiddleware => {
  let connection: ReduxDevToolsConnection | null = null;

  const connect = () => {
    const ext = window.__REDUX_DEVTOOLS_EXTENSION__;
    if (!ext) return;
    connection = ext.connect({ name });
    connection.init({});
  };

  if (typeof window !== "undefined") {
    connect();
  }

  return {
    beforeSend(action, state) {
      connection?.send({ type: `send:${(action as Record<string, unknown>).type}`, ...action as object }, state);
    },

    afterApply(action, state) {
      connection?.send({ type: (action as Record<string, unknown>).type, ...action as object }, state);
    },

    onStateReplace(state) {
      connection?.init(state);
    }
  };
};
