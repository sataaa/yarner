import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { YarnerPage } from '../fixtures/test-helpers';

const { When, Then } = createBdd();

When('I save the game as {string}', async ({ page }, slotName: string) => {
	const yarner = new YarnerPage(page);
	await yarner.saveAs(slotName);
});

When('I close the save panel', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.closeSavePanel();
});

When('I overwrite the last save slot', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.overwriteLastSlot();
});

When('I load the slot {string}', async ({ page }, slotName: string) => {
	const yarner = new YarnerPage(page);
	await yarner.loadSlot(slotName);
});

When('I close the game', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickCloseButton();
	await yarner.confirmClose();
	await yarner.isOnHomeScreen();
});

Then('I see save feedback', async ({ page }) => {
	await expect(page.locator('.save-feedback')).toBeVisible();
});

Then('I see load feedback', async ({ page }) => {
	// After loading, an output line with restore message appears
	await expect(page.locator('.output-line').last()).toBeVisible({ timeout: 5_000 });
});

Then('I see the save badge in the library', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.isOnHomeScreen();
	const saveCount = await yarner.librarySaveBadgesFor('etude');
	expect(saveCount).toBeGreaterThan(0);
});
