import {defineConfig} from 'vite';
export default defineConfig({base:'/dragon-trail-map/',worker:{format:'es'},build:{rollupOptions:{output:{manualChunks:{maplibre:['maplibre-gl']}}}}});
