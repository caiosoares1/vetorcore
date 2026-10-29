import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 timeout:45000,
 expect:{timeout:12000},
 retries:1,
 use:{baseURL:'http://127.0.0.1:4173',serviceWorkers:'block',trace:'retain-on-failure'},
 projects:[
  {name:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
  {name:'mobile',use:{...devices['Pixel 7'],browserName:'chromium'}}
 ],
 webServer:{
  command:'npm run dev -- --host 127.0.0.1 --port 4173',
  url:'http://127.0.0.1:4173',
  timeout:60000,
  reuseExistingServer:!process.env.CI,
  env:{VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'},
 }
});