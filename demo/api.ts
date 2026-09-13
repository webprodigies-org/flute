import type { Connect, Plugin } from "vite";
// Demonstration host API only. The spatial package never imports this module.
export const dashboardData = {
  revenue: 48294,
  growth: 18.6,
  customers: 2847,
  points: [18, 22, 19, 38, 34, 55, 46, 62, 57, 84, 77, 105, 99, 118],
  activity: [
    {
      name: "Alex Morgan",
      detail: "Upgraded to Pro · just now",
      amount: "+$49",
    },
    {
      name: "Jamie Chen",
      detail: "New subscription · 2 min ago",
      amount: "+$29",
    },
    {
      name: "Sam Rivera",
      detail: "Upgraded to Pro · 8 min ago",
      amount: "+$49",
    },
  ],
};
export function dashboardApi(): Plugin {
  const middleware: Connect.NextHandleFunction = (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(dashboardData));
  };
  return {
    name: "flute-demo-host-api",
    configureServer(server) {
      server.middlewares.use("/api/dashboard", middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/api/dashboard", middleware);
    },
  };
}
