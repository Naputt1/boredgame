import { useCallback, useEffect, useState } from "react";
import { useGameEngine } from "@boredgame/react";
import type { ActionLog } from "./createActionLog";
import { ActionLogPanel } from "./ActionLogPanel";
import { TimeTravelControls } from "./TimeTravelControls";
import { ImportExport } from "./ImportExport";
import "./styles.css";

type DevtoolsPanelProps<TAction> = {
  actionLog: ActionLog<TAction>;
  reducer: (state: unknown, action: TAction) => unknown;
  createInitialState: () => unknown;
};

export const DevtoolsPanel = <TAction,>({
  actionLog,
  reducer,
  createInitialState
}: DevtoolsPanelProps<TAction>) => {
  const engine = useGameEngine();
  const [isOpen, setIsOpen] = useState(false);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (statusMessage) {
      const timer = setTimeout(() => setStatusMessage(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [statusMessage]);

  const handleSelectAction = useCallback(
    (index: number) => {
      if (!engine || !isReplayMode) return;

      const actions = actionLog.getUpTo(index);
      const replayed = actions.reduce(
        (state, action) => reducer(state, action),
        createInitialState()
      );
      engine.replaceState(replayed);
      setActiveIndex(index);
    },
    [engine, actionLog, reducer, createInitialState, isReplayMode]
  );

  const handleReplayModeChange = useCallback(
    (mode: boolean) => {
      setIsReplayMode(mode);
      if (!mode && engine) {
        engine.replaceState(createInitialState());
        const allActions = actionLog.getAll().map((e) => e.action);
        const fullState = allActions.reduce(
          (state, action) => reducer(state, action),
          createInitialState()
        );
        engine.replaceState(fullState);
        setActiveIndex(-1);
      } else {
        setActiveIndex(-1);
        if (engine) {
          engine.replaceState(createInitialState());
        }
      }
    },
    [engine, actionLog, reducer, createInitialState]
  );

  const handleImport = useCallback(
    (_actions: unknown[]) => {
      const all = actionLog.getAll().map((e) => e.action);
      const fullState = all.reduce(
        (state, action) => reducer(state, action),
        createInitialState()
      );
      if (engine) {
        engine.replaceState(fullState);
      }
      setIsReplayMode(false);
      setActiveIndex(-1);
      setStatusMessage("Imported successfully");
    },
    [actionLog, reducer, createInitialState, engine]
  );

  return (
    <div className="boredgame-devtools">
      <button
        className="boredgame-devtools-toggle"
        onClick={() => setIsOpen(!isOpen)}
        title={isOpen ? "Close devtools" : "Open devtools"}
      >
        {isOpen ? "✕" : "⚙"}
      </button>

      {isOpen && (
        <div className="boredgame-devtools-panel">
          <div className="boredgame-devtools-header">
            <span>DevTools {statusMessage ? `— ${statusMessage}` : ""}</span>
            <div className="boredgame-devtools-header-actions">
              <button
                className="boredgame-devtools-header-btn"
                onClick={() => {
                  actionLog.clear();
                  if (engine) {
                    engine.replaceState(createInitialState());
                  }
                  setIsReplayMode(false);
                  setActiveIndex(-1);
                }}
              >
                Clear
              </button>
            </div>
          </div>

          <ActionLogPanel
            actionLog={actionLog}
            activeIndex={activeIndex}
            onSelectAction={handleSelectAction}
          />

          <TimeTravelControls
            actionLog={actionLog}
            reducer={reducer}
            createInitialState={createInitialState}
            isReplayMode={isReplayMode}
            onReplayModeChange={handleReplayModeChange}
          />

          <ImportExport actionLog={actionLog} onImport={handleImport} />
        </div>
      )}
    </div>
  );
};
