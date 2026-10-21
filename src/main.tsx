import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router";
import "./index.css";
import "./App.css";
import AuthGate from "./components/AuthGate";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthGate />
    </HashRouter>
  </StrictMode>
);