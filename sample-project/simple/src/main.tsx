import React from "react";
import ReactDOM from "react-dom/client";
import { GameShell } from "./view";
import "./styles.css";

const App = () => {
  return <GameShell />;
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
