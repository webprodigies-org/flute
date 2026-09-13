import { createContext, useContext, type ComponentProps } from "react"
import { Surface } from "@flute/scene"
import { SidebarMenuItem } from "@/components/ui/sidebar"

// SOURCE OF TRUTH: sidebar slots bind existing rows to the scene recipe.
// WHAT: stable identities and entrance times. WHY: the recipe and live rows share
// one declaration. WHERE: sidebar-recipe.ts consumes these slots; UI supplies content.
export const sidebarSlots = {
  brand: { id: "brand", at: 500, y: -435 }, create: { id: "create", at: 1100, y: -385 },
  Dashboard: { id: "dashboard", at: 1600, y: -343 }, Lifecycle: { id: "lifecycle", at: 2100, y: -309 },
  Analytics: { id: "analytics", at: 2600, y: -275 }, Projects: { id: "projects", at: 3100, y: -241 },
  Team: { id: "team", at: 3600, y: -207 }, "Data Library": { id: "data-library", at: 4300, y: -125 },
  Reports: { id: "reports", at: 4800, y: -91 }, "Word Assistant": { id: "word-assistant", at: 5300, y: -57 },
  more: { id: "more", at: 5800, y: -23 }, Settings: { id: "settings", at: 7800, y: 299 },
  "Get Help": { id: "help", at: 8300, y: 333 }, Search: { id: "search", at: 8800, y: 367 },
  user: { id: "user", at: 9500, y: 425 },
} as const
export type SidebarSlot = keyof typeof sidebarSlots
export const SpatialSidebar = createContext(false)

export function SidebarLayer({ slot, children, className, ...props }:
  ComponentProps<typeof SidebarMenuItem> & { slot: SidebarSlot }) {
  const spatial = useContext(SpatialSidebar)
  return <SidebarMenuItem {...props} className={spatial ? undefined : className}>
    {spatial ? <Surface id={sidebarSlots[slot].id} className="sidebar-layer">
      <div className={className}>{children}</div>
    </Surface> : children}
  </SidebarMenuItem>
}
