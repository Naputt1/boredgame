import React from "react";
import ReactDOM from "react-dom/client";
import { PlatformProvider } from "@boredgame/platform";
import { demoGameDefinition } from "@boredgame/demo-game";
import type { DemoGameAction } from "@boredgame/demo-game";
import {
  createActionLog,
  createDevtoolsMiddleware
} from "@boredgame/devtools";
import { GameScreen } from "./view";
import "./styles.css";

const actionLog = createActionLog<DemoGameAction>("boredgame-demo");
const middleware = [createDevtoolsMiddleware(actionLog)];

const App = () => {
  return (
    <PlatformProvider gameDefinition={demoGameDefinition} middleware={middleware}>
      <GameScreen actionLog={actionLog} />
    </PlatformProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
