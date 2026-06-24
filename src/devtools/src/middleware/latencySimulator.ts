import type { GameEngineMiddleware } from "@boredgame/core";

export type LatencySimulatorOptions = {
  min?: number;
  max?: number;
  enabled?: boolean;
};

export const latencySimulatorMiddleware = ({
  min = 200,
  max = 800,
  enabled = true
}: LatencySimulatorOptions = {}): GameEngineMiddleware => {
  const delay = () => Math.floor(Math.random() * (max - min + 1)) + min;

  return {
    beforeApply(action, state) {
      if (!enabled) return;
      return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), delay());
      }) as unknown as void;
    }
  };
};
