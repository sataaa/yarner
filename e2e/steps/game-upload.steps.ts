import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { YarnerPage } from '../fixtures/test-helpers';

const { When, Then } = createBdd();

When('I upload a Z5 game file', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.uploadGame();
});

When('I click the game in the library', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickGameInLibrary('etude');
});

When('I type the command {string}', async ({ page }, command: string) => {
	const yarner = new YarnerPage(page);
	await yarner.typeCommand(command);
});

When('I upload the same game file again', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.uploadGame();
});

When('I click the game output area', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickOutputArea();
});

Then('the game appears in the library', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.isGameInLibrary('etude');
});

Then('the game panel is visible', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForGamePanel();
});

Then('the game output is rendered', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForGameOutput();
});

Then('the command input is focused', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const isFocused = await yarner.isCommandInputFocused();
	expect(isFocused).toBe(true);
});

Then('the game output updates', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const output = await yarner.getGameOutputText();
	// After typing "look", there should be more output
	expect(output.length).toBeGreaterThan(0);
});

Then('the duplicate message is shown', async ({ page }) => {
	await expect(page.locator('.duplicate-msg')).toBeVisible({ timeout: 5_000 });
});

Then('the bundled game appears in the library', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.isGameInLibrary('Colossal Cave Adventure');
});

Then('the bundled game has no remove button', async ({ page }) => {
	const wrapper = page.locator('.library-item-wrapper').filter({ hasText: 'Colossal Cave Adventure' });
	await expect(wrapper.locator('.btn-remove')).toHaveCount(0);
	await expect(wrapper.locator('.btn-bundled')).toBeVisible();
});
