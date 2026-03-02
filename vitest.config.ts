import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			// Mirror the $lib alias that SvelteKit sets up
			$lib: path.resolve(__dirname, 'src/lib')
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		setupFiles: ['src/lib/i18n/test-setup.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json-summary'],
			include: [
				'src/lib/api/claude.ts',
				'src/lib/stores/aiPersistence.ts',
				'src/lib/stores/gameState.ts',
				'src/lib/zmachine/glk/types.ts',
				'src/lib/zmachine/glk/WebGlk.ts'
			],
			thresholds: {
				lines: 95,
				functions: 95,
				branches: 95,
				statements: 95
			}
		}
	}
});
