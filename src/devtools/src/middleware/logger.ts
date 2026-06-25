import type { GameEngineMiddleware } from '@boredgame/core'

export type LoggerMiddlewareOptions = {
  collapsed?: boolean
  colors?: Record<string, string>
}

const defaultColors: Record<string, string> = {
  default: '#64748b',
}

export const loggerMiddleware = ({
  collapsed = true,
  colors = defaultColors,
}: LoggerMiddlewareOptions = {}): GameEngineMiddleware => {
  const log = collapsed ? console.groupCollapsed : console.group

  return {
    beforeSend(action, state) {
      const type = (action as Record<string, unknown>).type as string
      const color = colors[type] ?? colors.default
      log(
        `%c send  %c ${type}`,
        `background:#3b82f6;color:white;padding:2px 4px;border-radius:3px;font-weight:bold`,
        `color:${color};font-weight:bold`
      )
      console.log('%c action:', 'font-weight:bold', action)
      console.log('%c state:', 'font-weight:bold', state)
      console.groupEnd()
    },

    beforeApply(action, state) {
      const type = (action as Record<string, unknown>).type as string
      const color = colors[type] ?? colors.default
      log(
        `%c apply %c ${type}`,
        `background:#8b5cf6;color:white;padding:2px 4px;border-radius:3px;font-weight:bold`,
        `color:${color};font-weight:bold`
      )
      console.log('%c action:', 'font-weight:bold', action)
      console.log('%c prev state:', 'font-weight:bold', state)
    },

    afterApply(_action, state) {
      console.log('%c next state:', 'font-weight:bold', state)
      console.groupEnd()
    },

    onError(error) {
      console.error('%c error:', 'font-weight:bold;color:#ef4444', error)
    },
  }
}
