import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Application en un seul fichier HTML, sans aucune ressource tierce : React, ReactDOM, D3 et les
// polices sont intégrés à la page. Aucun CDN, aucun Google Fonts : le visiteur ne contacte que ce site.
export default defineConfig({
  base: "./",
  // removeViteModuleLoader reste désactivé : sans dépendance externe, l'application elle-même est une
  // fonction anonyme immédiate que l'option effacerait en entier.
  plugins: [viteSingleFile({ removeViteModuleLoader: false })],
  esbuild: { jsx: "transform", jsxFactory: "React.createElement", jsxFragment: "React.Fragment" },
  build: {
    target: "es2020",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: { format: "iife", inlineDynamicImports: true },
    },
  },
});
