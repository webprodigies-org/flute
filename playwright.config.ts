import { defineConfig, devices } from '@playwright/test';
const baseURL=process.env.FLUTE_TEST_URL ?? 'http://127.0.0.1:'+String(process.env.APP_PORT ?? process.env.PORT ?? 5173);
export default defineConfig({testDir:'./tests/browser',fullyParallel:false,workers:1,retries:0,timeout:30000,expect:{timeout:7000},use:{baseURL,trace:'retain-on-failure',screenshot:'only-on-failure'},projects:[{name:'chromium',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000}}}],reporter:[['list'],['html',{open:'never'}]]});
