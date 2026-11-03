import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Application en un seul fichier HTML : React, ReactDOM et D3 sont chargés
// depuis cdnjs (versions figées, intégrité SRI) et exposés en variables globales.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  esbuild: { jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" },
  build: {
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client", "d3"],
      output: {
        format: "iife",
        inlineDynamicImports: true,
        globals: { react: "React", "react-dom": "ReactDOM", "react-dom/client": "ReactDOM", d3: "d3" },
      },
    },
  },
});
