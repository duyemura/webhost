import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const backendConfigPath = path.resolve(__dirname, "../src/config.ts");
const configStubPath = path.resolve(__dirname, "src/lib/config-browser-stub.ts");

export default defineConfig({
  plugins: [
    react(),
    {
      // When backend renderers run in the Vite bundle, replace src/config.ts with a
      // browser-safe stub. The load hook receives the fully-resolved absolute path,
      // which is more reliable than matching on the raw import string.
      name: "browser-stubs",
      load(id: string) {
        if (id === backendConfigPath) {
          return `export const config = { googleMapsApiKey: "" };`;
        }
        return null;
      },
    },
  ],
  resolve: {
    // Allow .js imports to resolve .ts source files (TypeScript convention)
    extensionAlias: { ".js": [".ts", ".js"] },
  },
  server: {
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
