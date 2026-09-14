import { ProjectPreview as FluteProjectPreview } from "@flute/scene/preview";
import { TooltipProvider } from "@/components/ui/tooltip"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <FluteProjectPreview projectId="81d3e0d6-6a3e-47a9-994f-a9ef83d7f0e0" enabled={import.meta.env.DEV}>{<StrictMode>
    <ThemeProvider>
      <TooltipProvider><App /></TooltipProvider>
    </ThemeProvider>
  </StrictMode>}</FluteProjectPreview>
)
