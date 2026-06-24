import { useEffect, useState } from "react";
import type { ActionLog, ActionLogEntry } from "./createActionLog";

type ActionLogPanelProps<TAction> = {
  actionLog: ActionLog<TAction>;
  activeIndex: number;
  onSelectAction: (index: number) => void;
};

export const ActionLogPanel = <TAction,>({
  actionLog,
  activeIndex,
  onSelectAction
}: ActionLogPanelProps<TAction>) => {
  const [entries, setEntries] = useState<ActionLogEntry<TAction>[]>(actionLog.getAll());
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  useEffect(() => {
    const unsub = actionLog.subscribe(() => {
      setEntries([...actionLog.getAll()]);
    });
    return unsub;
  }, [actionLog]);

  if (entries.length === 0) {
    return <div className="boredgame-devtools-empty">No actions recorded yet</div>;
  }

  const timeStr = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
  };

  return (
    <div className="boredgame-devtools-body">
      {entries.map((entry) => {
        const actionType = String((entry.action as Record<string, unknown>).type ?? "unknown");
        const isActive = entry.index === activeIndex;
        const isExpanded = expandedIndex === entry.index;

        return (
          <div key={entry.index}>
            <div
              className={`boredgame-devtools-action-entry ${isActive ? "active" : ""} ${entry.index > activeIndex ? "live" : ""}`}
              onClick={() => {
                onSelectAction(entry.index);
                setExpandedIndex(isExpanded ? null : entry.index);
              }}
            >
              <span className="boredgame-devtools-action-index">#{entry.index}</span>
              <span className="boredgame-devtools-action-type">{actionType}</span>
              <span className="boredgame-devtools-action-time">{timeStr(entry.timestamp)}</span>
            </div>
            <div className={`boredgame-devtools-action-preview ${isExpanded ? "open" : ""}`}>
              {JSON.stringify(entry.action, null, 2)}
            </div>
          </div>
        );
      })}
    </div>
  );
};
