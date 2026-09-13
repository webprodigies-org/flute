import { Surface } from "@flute/scene"
import { useContext, type ReactNode, type CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { SpatialSidebar } from "@/scene/sidebar-layer"
import data from "@/app/dashboard/data.json"

// SOURCE OF TRUTH: this dashboard composes the official shadcn dashboard-01 block.
// Both normal and cinematic views render this same component and the same data.
export function Dashboard() {
  const spatial = useContext(SpatialSidebar)
  return <SidebarProvider className={spatial ? "dashboard-layout" : undefined} style={{
    "--sidebar-width": "17rem", "--header-height": "3.5rem",
  } as CSSProperties}>
    <AppSidebar className={spatial ? "p-2" : undefined} variant="inset" collapsible={spatial ? "none" : "offcanvas"} />
    <DashboardBody spatial={spatial}><SidebarInset>
      <SiteHeader />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <SectionCards />
            <div className="px-4 lg:px-6"><ChartAreaInteractive /></div>
            <DataTable data={data} />
          </div>
        </div>
      </div>
    </SidebarInset></DashboardBody>
  </SidebarProvider>
}

function DashboardBody({ spatial, children }: { spatial: boolean; children: ReactNode }) {
  return spatial ? <Surface id="dashboard-content" style={{flex: 1, minWidth: 0}}>{children}</Surface> : children
}
