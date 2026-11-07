import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The site imports ../manifest.json, ../*.js, ../styles.css and fixtures/ at build time, so every number is read, never typed.
export default defineConfig({
  base: '/WordMe/',
  plugins: [react()],
  server: { fs: { allow: ['..'] } },
});
