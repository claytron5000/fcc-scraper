import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
	plugins: [react()],
	outDir: "docs",
	base: "https://claytron5000.github.io/fcc-scraper/",
});
