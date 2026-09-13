import { Dashboard } from "@/components/dashboard"
import { SidebarScene } from "@/scene/sidebar-scene"

export default function App() {
  return new URLSearchParams(window.location.search).get("scene") === "sidebar"
    ? <SidebarScene /> : <><Dashboard /><a className="fixed bottom-4 right-4 z-50 rounded-full bg-foreground px-5 py-3 text-sm text-background shadow-lg" href="/?scene=sidebar">Watch sidebar scene ↗</a></>
}
