import type { GameEngineMiddleware } from '@boredgame/core'
import type { ActionLog } from './createActionLog'

export const createDevtoolsMiddleware = <TAction>(
  actionLog: ActionLog<TAction>
): GameEngineMiddleware => ({
  afterApply(action) {
    actionLog.addAction(action as TAction)
  },
})
