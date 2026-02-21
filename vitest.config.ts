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
		coverage: {
			provider: 'v8',
			include: [
				'src/lib/api/claude.ts',
				'src/lib/stores/aiPersistence.ts',
				'src/lib/stores/gameState.ts'
			],
			thresholds: {
				lines: 100,
				functions: 100,
				branches: 100,
				statements: 100
			}
		}
	}
});
