import { TooltipProvider } from "@/components/ui/tooltip"
import { ProjectPreview as FluteProjectPreview } from "@flute/scene/preview";
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <FluteProjectPreview projectId="67896f80-65f2-4577-8a2b-f3e55fc8f5f1" enabled={import.meta.env.DEV}>{<StrictMode>
    <ThemeProvider>
      <TooltipProvider><App /></TooltipProvider>
    </ThemeProvider>
  </StrictMode>}</FluteProjectPreview>
)
