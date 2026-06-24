import React from "react";
import ReactDOM from "react-dom/client";
import { PlatformProvider } from "@boredgame/platform";
import { demoGameDefinition } from "@boredgame/demo-game";
import { GameScreen } from "./view";
import "./styles.css";

const App = () => {
  return (
    <PlatformProvider gameDefinition={demoGameDefinition}>
      <GameScreen />
    </PlatformProvider>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
