import { createBdd } from 'playwright-bdd';
import { YarnerPage } from '../fixtures/test-helpers';

const { Given } = createBdd();

/** Navigate to home, clean state, reload to get fresh app */
async function freshStart(page: import('@playwright/test').Page): Promise<YarnerPage> {
	const yarner = new YarnerPage(page);
	await yarner.goto();
	await yarner.cleanAll();
	// Reload after clearing so the app starts fresh
	await page.reload({ waitUntil: 'networkidle' });
	return yarner;
}

Given('I am on the home screen', async ({ page }) => {
	const yarner = await freshStart(page);
	await yarner.isOnHomeScreen();
});

Given('I have uploaded a game', async ({ page }) => {
	const yarner = await freshStart(page);
	await yarner.uploadGame();
});

Given('a game is running', async ({ page }) => {
	const yarner = await freshStart(page);
	await yarner.uploadGame();
	// Wait for it to appear in library, then click to start
	await yarner.isGameInLibrary('etude');
	await yarner.clickGameInLibrary('etude');
	await yarner.waitForGamePanel();
	await yarner.waitForGameOutput();
});

Given('a game is running with AI mocked', async ({ page }) => {
	await YarnerPage.mockGeminiAPI(page);
	const yarner = await freshStart(page);
	await yarner.uploadGame();
	await yarner.isGameInLibrary('etude');
	await yarner.clickGameInLibrary('etude');
	await yarner.waitForGamePanel();
	await yarner.waitForGameOutput();
});
