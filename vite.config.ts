import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  server: {
    port: 5173,
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
