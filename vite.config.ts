import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	const clientPort = Number(env.VITE_DEV_SERVER_PORT ?? 3000);
	const proxyPort = env.TRANSCRIPTION_SERVER_PORT ?? env.PORT ?? "3001";
	const proxyTarget = env.VITE_TRANSCRIPTION_PROXY_TARGET ?? `http://localhost:${proxyPort}`;

	return {
		plugins: [react(), tailwindcss()],
		server: {
			port: Number.isFinite(clientPort) ? clientPort : 3000,
			proxy: {
				"/api": {
					target: proxyTarget,
					changeOrigin: true,
				},
			},
		},
		resolve: {
			alias: {
				"@": path.resolve(__dirname, "./src"),
			},
		},
	};
});
