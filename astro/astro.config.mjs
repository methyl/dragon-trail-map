import { defineConfig } from 'astro/config';
export default defineConfig({output:'static',site:'https://dragontrail.pl',trailingSlash:'always',vite:{worker:{format:'es'},build:{rollupOptions:{output:{manualChunks:{maplibre:['maplibre-gl']}}}}}});
