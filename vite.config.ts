import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'iNest Tweet Cards', short_name: 'Tweet Cards', theme_color: '#050505', background_color: '#050505', display: 'standalone', start_url: '/', icons: [{ src: 'icons/icon-512.png?v=inest-icon-v2', sizes: '512x512', type: 'image/png', purpose: 'any' }] } })]
})
