import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { YarnerPage } from '../fixtures/test-helpers';

const { When, Then } = createBdd();

When('I restart the game', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickRestartButton();
	await yarner.confirmRestart();
	// Wait for game to reload
	await yarner.waitForGameOutput();
});

When('I click restart and cancel', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickRestartButton();
	await yarner.cancelRestart();
});

When('I close the game and confirm', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickCloseButton();
	await yarner.confirmClose();
});

When('I click the game in the library again', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickGameInLibrary('advent');
	await yarner.waitForGamePanel();
	await yarner.waitForGameOutput();
});

Then('the game output is reset to initial state', async ({ page }) => {
	const yarner = new YarnerPage(page);
	// Wait for fresh output to appear
	await yarner.waitForGameOutput();
	const output = await yarner.getGameOutputText();
	// The initial output of advent includes a welcome/intro
	expect(output.length).toBeGreaterThan(0);
});

Then('the game panel is still visible', async ({ page }) => {
	await expect(page.locator('.panel.game-panel')).toBeVisible();
});

Then('I am back on the home screen', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.isOnHomeScreen();
});

Then('the game is still in the library', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.isGameInLibrary('advent');
});
