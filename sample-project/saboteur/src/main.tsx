import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GameShell } from "./view/GameShell";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameShell />
  </StrictMode>
);
