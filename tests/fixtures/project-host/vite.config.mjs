import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react(), {
  name: "host-api",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url !== "/api/value") return next();
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ revenue: 12840 }));
    });
  },
}] });
