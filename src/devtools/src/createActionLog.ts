export type ActionLogEntry<TAction> = {
  index: number
  action: TAction
  timestamp: number
}

export type ActionLog<TAction> = {
  addAction(action: TAction): void
  getAll(): ActionLogEntry<TAction>[]
  getUpTo(index: number): TAction[]
  size(): number
  clear(): void
  exportJSON(): string
  importJSON(data: string): TAction[]
  subscribe(callback: () => void): () => void
}

export type ActionLogExport<TAction> = {
  gameId: string
  exportedAt: string
  actions: TAction[]
}

export const createActionLog = <TAction>(
  gameId = 'unknown'
): ActionLog<TAction> => {
  const entries: ActionLogEntry<TAction>[] = []
  const listeners = new Set<() => void>()

  const notify = () => {
    listeners.forEach((cb) => {
      cb()
    })
  }

  return {
    addAction(action) {
      entries.push({
        index: entries.length,
        action,
        timestamp: Date.now(),
      })
      notify()
    },

    getAll() {
      return entries
    },

    getUpTo(index) {
      return entries.slice(0, index + 1).map((e) => e.action)
    },

    size() {
      return entries.length
    },

    clear() {
      entries.length = 0
      notify()
    },

    exportJSON() {
      const payload: ActionLogExport<TAction> = {
        gameId,
        exportedAt: new Date().toISOString(),
        actions: entries.map((e) => e.action),
      }
      return JSON.stringify(payload, null, 2)
    },

    importJSON(data) {
      const parsed = JSON.parse(data) as ActionLogExport<TAction>
      const actions = parsed.actions
      entries.length = 0
      actions.forEach((action) => {
        entries.push({
          index: entries.length,
          action,
          timestamp: Date.now(),
        })
      })
      notify()
      return actions
    },

    subscribe(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
}
