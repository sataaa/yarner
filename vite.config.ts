import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5173,
		strictPort: true,
		proxy: {
			// Proxy AI API requests to LM Studio to avoid CORS issues
			'/ai-api': {
				target: 'http://localhost:55511',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/ai-api/, '')
			}
		}
	}
});
