import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { port: Number(process.env.APP_PORT ?? process.env.PORT ?? 5173), strictPort: true } });
