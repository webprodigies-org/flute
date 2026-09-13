import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dashboardApi } from './demo/api';
export default defineConfig({ plugins: [react(),dashboardApi()], server: { host:'127.0.0.1',port: Number(process.env.APP_PORT ?? process.env.PORT ?? 5173), strictPort: true },preview:{host:'127.0.0.1',port:Number(process.env.APP_PORT ?? process.env.PORT ?? 5173),strictPort:true} });
