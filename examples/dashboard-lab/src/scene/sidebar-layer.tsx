import { createContext, useContext, type ReactNode, type ComponentProps } from "react"
import { Surface } from "@flute/scene"
import { SidebarMenuItem } from "@/components/ui/sidebar"

// SOURCE OF TRUTH: sidebar slots bind existing rows to the scene recipe.
// WHAT: stable identities and authored vertical anchors. WHY: the recipe and live rows share
// one declaration. WHERE: sidebar-recipe.ts consumes these slots; UI supplies content.
export const sidebarSlots = {
  brand: { id: "brand", y: -435 }, create: { id: "create", y: -385 },
  Dashboard: { id: "dashboard", y: -343 }, Lifecycle: { id: "lifecycle", y: -309 },
  Analytics: { id: "analytics", y: -275 }, Projects: { id: "projects", y: -241 },
  Team: { id: "team", y: -207 }, "Data Library": { id: "data-library", y: -125 },
  Reports: { id: "reports", y: -91 }, "Word Assistant": { id: "word-assistant", y: -57 },
  more: { id: "more", y: -23 }, Settings: { id: "settings", y: 299 },
  "Get Help": { id: "help", y: 333 }, Search: { id: "search", y: 367 },
  user: { id: "user", y: 425 },
} as const
export type SidebarSlot = keyof typeof sidebarSlots
export const SpatialSidebar = createContext(false)

export function SidebarLayer({ slot, children, className, ...props }:
  ComponentProps<typeof SidebarMenuItem> & { slot: SidebarSlot }) {
  // Carry the original sidebar backing paint with transparent rows as they lift.
  // Button classes, typography, border and radius remain untouched.
  const spatial = useContext(SpatialSidebar)
  return <SidebarMenuItem {...props} className={spatial ? undefined : className}>
    {spatial ? <Surface id={sidebarSlots[slot].id} className="sidebar-layer">
      <div className={className} style={{background: "var(--sidebar)"}}>{children}</div>
    </Surface> : children}
  </SidebarMenuItem>
}

// Stationary sidebar paint needs its own visual leaf beside animated rows.
export function SidebarLabel({children}: {children: ReactNode}) {
  const spatial = useContext(SpatialSidebar)
  return spatial ? <Surface id="documents-label">{children}</Surface> : children
}
