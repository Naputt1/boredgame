import { useCallback, useEffect, useRef, useState } from 'react'
import { useGameEngine } from '@boredgame/react'
import type { ActionLog } from './createActionLog'

type TimeTravelControlsProps<TAction> = {
  actionLog: ActionLog<TAction>
  reducer: (state: unknown, action: TAction) => unknown
  createInitialState: () => unknown
  isReplayMode: boolean
  onReplayModeChange: (mode: boolean) => void
}

export const TimeTravelControls = <TAction,>({
  actionLog,
  reducer,
  createInitialState,
  isReplayMode,
  onReplayModeChange,
}: TimeTravelControlsProps<TAction>) => {
  const engine = useGameEngine()
  const total = actionLog.size()
  const [currentStep, setCurrentStep] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const playInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isReplayMode) {
      setTimeout(() => {
        setCurrentStep(-1)
      }, 0)
      setTimeout(() => {
        setIsPlaying(false)
      }, 0)
      if (playInterval.current) {
        clearInterval(playInterval.current)
        playInterval.current = null
      }
    }
  }, [isReplayMode])

  useEffect(() => {
    return () => {
      if (playInterval.current) clearInterval(playInterval.current)
    }
  }, [])

  const replayAt = useCallback(
    (step: number) => {
      if (!engine) return
      const actions = actionLog.getUpTo(step)
      const replayed = actions.reduce(
        (state, action) => reducer(state, action),
        createInitialState()
      )
      engine.replaceState(replayed)
      setCurrentStep(step)
    },
    [engine, actionLog, reducer, createInitialState]
  )

  const goToStart = useCallback(() => {
    if (!engine) return
    engine.replaceState(createInitialState())
    setCurrentStep(-1)
  }, [engine, createInitialState])

  const goBack = useCallback(() => {
    const next = Math.max(-1, currentStep - 1)
    if (next === -1) {
      goToStart()
    } else {
      replayAt(next)
    }
  }, [currentStep, goToStart, replayAt])

  const goForward = useCallback(() => {
    const next = Math.min(total - 1, currentStep + 1)
    replayAt(next)
  }, [currentStep, total, replayAt])

  const goToEnd = useCallback(() => {
    if (total === 0) return
    replayAt(total - 1)
  }, [total, replayAt])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false)
      if (playInterval.current) clearInterval(playInterval.current)
    } else {
      setIsPlaying(true)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!isPlaying) return
    playInterval.current = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1
        if (next >= total) {
          setIsPlaying(false)
          return prev
        }
        replayAt(next)
        return next
      })
    }, 800)

    return () => {
      if (playInterval.current) clearInterval(playInterval.current)
    }
  }, [isPlaying, total, replayAt])

  const handleSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const step = Number(e.target.value)
      if (step === -1) {
        goToStart()
      } else {
        replayAt(step)
      }
    },
    [goToStart, replayAt]
  )

  if (total === 0) return null

  return (
    <div className="boredgame-devtools-timetravel">
      <button
        className={`boredgame-devtools-timetravel-btn${isReplayMode ? ' active' : ''}`}
        onClick={() => {
          onReplayModeChange(!isReplayMode)
        }}
        title="Toggle time-travel mode"
      >
        {isReplayMode ? 'LIVE' : 'RPL'}
      </button>

      <button
        className="boredgame-devtools-timetravel-btn"
        onClick={goToStart}
        disabled={!isReplayMode || currentStep <= -1}
        title="Go to start"
      >
        ⏮
      </button>

      <button
        className="boredgame-devtools-timetravel-btn"
        onClick={goBack}
        disabled={!isReplayMode || currentStep <= -1}
        title="Step back"
      >
        ⏪
      </button>

      <button
        className="boredgame-devtools-timetravel-btn"
        onClick={togglePlay}
        disabled={!isReplayMode}
        title={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <button
        className="boredgame-devtools-timetravel-btn"
        onClick={goForward}
        disabled={!isReplayMode || currentStep >= total - 1}
        title="Step forward"
      >
        ⏩
      </button>

      <button
        className="boredgame-devtools-timetravel-btn"
        onClick={goToEnd}
        disabled={!isReplayMode || currentStep >= total - 1}
        title="Go to end"
      >
        ⏭
      </button>

      <input
        type="range"
        className="boredgame-devtools-timetravel-slider"
        min={-1}
        max={total - 1}
        value={isReplayMode ? currentStep : total - 1}
        onChange={handleSlider}
        disabled={!isReplayMode}
      />

      <span className="boredgame-devtools-timetravel-label">
        {isReplayMode
          ? `${String(currentStep + 1)} / ${String(total)}`
          : String(total)}
      </span>
    </div>
  )
}
