import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss(), VitePWA({
  registerType: 'prompt',
  manifest: { name:'Vetor Hub — Vetor Embalagens', short_name:'Vetor Hub',
    description:'Gestão comercial e operacional', theme_color:'#363890',
    background_color:'#f5f6fb', display:'standalone', start_url:'/', scope:'/',
    icons:[{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'},
           {src:'icon-maskable.svg',sizes:'any',type:'image/svg+xml',purpose:'maskable'}]},
  workbox: {navigateFallback:'/index.html',globPatterns:['**/*.{js,css,html,svg,png,woff2}']}
})] });
