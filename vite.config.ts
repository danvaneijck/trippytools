import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { nodePolyfills } from "@bangjelkoski/vite-plugin-node-polyfills";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), nodePolyfills({ protocolImports: true }), sentryVitePlugin({
    org: "trippy-m0",
    project: "trippy-tools"
  })],

  build: {
    sourcemap: false
  }
});