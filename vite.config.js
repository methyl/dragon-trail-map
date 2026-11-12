import {defineConfig} from 'vite';
export default defineConfig({base:'/dragon-trail-map/',build:{rollupOptions:{output:{manualChunks:{maplibre:['maplibre-gl']}}}}});
