import { initThemeMode } from "flowbite-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeInit } from "../.flowbite-react/init";
import App from "./App.tsx";
import { ThemeProvider } from "./theme/ThemeProvider";
import "./index.css";
import "./theme/theme.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemeInit />
      <App />
    </ThemeProvider>
  </StrictMode>,
);

initThemeMode();
