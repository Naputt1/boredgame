import { useCallback, useRef } from "react";
import type { ActionLog } from "./createActionLog";

type ImportExportProps<TAction> = {
  actionLog: ActionLog<TAction>;
  onImport: (actions: TAction[]) => void;
};

export const ImportExport = <TAction,>({
  actionLog,
  onImport
}: ImportExportProps<TAction>) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(() => {
    const json = actionLog.exportJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `action-log-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [actionLog]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const actions = actionLog.importJSON(text);
          onImport(actions);
        } catch (err) {
          console.error("Failed to import action log:", err);
        }
      };
      reader.readAsText(file);

      e.target.value = "";
    },
    [actionLog, onImport]
  );

  return (
    <div className="boredgame-devtools-import-export">
      <button onClick={handleExport} title="Export action history as JSON">
        Export JSON
      </button>
      <button onClick={handleImportClick} title="Import action history from JSON">
        Import JSON
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
};
