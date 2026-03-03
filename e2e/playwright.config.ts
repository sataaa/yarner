import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import path from 'path';

const e2eDir = path.dirname(new URL(import.meta.url).pathname);

const testDir = defineBddConfig({
	features: path.join(e2eDir, 'features/**/*.feature'),
	steps: path.join(e2eDir, 'steps/**/*.steps.ts'),
	outputDir: path.join(e2eDir, '.features-gen')
});

export default defineConfig({
	testDir,
	timeout: 30_000,
	expect: {
		timeout: 5_000
	},
	use: {
		baseURL: 'http://localhost:4173',
		screenshot: 'only-on-failure',
		trace: 'retain-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: {
				browserName: 'chromium'
			}
		}
	],
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
