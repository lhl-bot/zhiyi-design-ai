import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import fs from "node:fs"
import { fileURLToPath } from "node:url"

const projectRoot = fs.realpathSync(path.dirname(fileURLToPath(import.meta.url)))

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      allow: [projectRoot]
    },
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
        timeout: 300000,
        proxyTimeout: 300000
      }
    }
  }
})
