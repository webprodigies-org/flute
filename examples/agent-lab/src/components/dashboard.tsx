import { type CSSProperties } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { DataTable } from "@/components/data-table"
import { SectionCards } from "@/components/section-cards"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import data from "@/app/dashboard/data.json"

// SOURCE OF TRUTH: this dashboard composes the official shadcn dashboard-01 block.
// The host dashboard owns its components and data.
export function Dashboard() {
  return <SidebarProvider style={{
    "--sidebar-width": "17rem", "--header-height": "3.5rem",
  } as CSSProperties}>
    <AppSidebar variant="inset" />
    <SidebarInset>
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
    </SidebarInset>
  </SidebarProvider>
}
