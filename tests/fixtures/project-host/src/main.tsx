import { createRoot } from "react-dom/client";
import { DashboardProvider, App } from "./App";
// Existing provider composition must survive initialization.
createRoot(document.getElementById("root")!).render(
  <DashboardProvider><App /></DashboardProvider>
);
