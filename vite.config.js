import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "search-shell", test: /src[\\/]experience-v2[\\/]shell[\\/]GlobalSearch\.jsx$/, priority: 45 },
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom)[\\/]/, priority: 40 },
            { name: "supabase-vendor", test: /node_modules[\\/]@supabase[\\/]/, priority: 30 },
            { name: "motion-vendor", test: /node_modules[\\/]motion[\\/]/, priority: 20 },
            { name: "icons-vendor", test: /node_modules[\\/]lucide-react[\\/]/, priority: 15 },
            { name: "vendor", test: /node_modules/, priority: 10, maxSize: 300 * 1024 },
          ],
        },
      },
    },
  },
});
