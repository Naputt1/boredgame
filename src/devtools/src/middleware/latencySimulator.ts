import type { GameEngineMiddleware } from '@boredgame/core'

export type LatencySimulatorOptions = {
  min?: number
  max?: number
  enabled?: boolean
}

export const latencySimulatorMiddleware = ({
  min = 200,
  max = 800,
  enabled = true,
}: LatencySimulatorOptions = {}): GameEngineMiddleware => {
  const delay = () => Math.floor(Math.random() * (max - min + 1)) + min

  return {
    beforeApply() {
      if (!enabled) return
      void new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve()
        }, delay())
      })
    },
  }
}
