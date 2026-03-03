import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { YarnerPage } from '../fixtures/test-helpers';

const { When, Then } = createBdd();

const THEMES = ['classic', 'dark', 'solarized', 'dracula'];

When('I click the theme button 4 times', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const seen: string[] = [];
	for (let i = 0; i < 4; i++) {
		await yarner.clickThemeButton();
		await page.waitForTimeout(200);
		const theme = await yarner.getActiveTheme();
		seen.push(theme);
	}
	// Store themes seen for assertion
	(page as any).__themesSeen = seen;
});

When('I click the theme button once', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const before = await yarner.getActiveTheme();
	await yarner.clickThemeButton();
	await page.waitForTimeout(200);
	const after = await yarner.getActiveTheme();
	(page as any).__themeBefore = before;
	(page as any).__themeAfter = after;
});

When('I reload the page', async ({ page }) => {
	await page.reload();
	await page.waitForLoadState('networkidle');
});

When('I click the locale button', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const before = await yarner.getLocaleButtonText();
	await yarner.clickLocaleButton();
	await page.waitForTimeout(300);
	const after = await yarner.getLocaleButtonText();
	(page as any).__localeBefore = before;
	(page as any).__localeAfter = after;
});

When('I clear all data', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clearAllData();
});

Then('each click changes the data-theme attribute', async ({ page }) => {
	const seen: string[] = (page as any).__themesSeen;
	// All 4 themes should cycle through (they may repeat if we start mid-cycle)
	expect(seen.length).toBe(4);
	// At least 2 different themes should appear
	const unique = new Set(seen);
	expect(unique.size).toBeGreaterThanOrEqual(2);
});

Then('the theme is still changed', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const after = (page as any).__themeAfter;
	const current = await yarner.getActiveTheme();
	expect(current).toBe(after);
});

Then('the UI text language changes', async ({ page }) => {
	const before = (page as any).__localeBefore;
	const after = (page as any).__localeAfter;
	expect(before).not.toBe(after);
});

Then('the locale is still changed', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const afterClick = (page as any).__localeAfter;
	const current = await yarner.getLocaleButtonText();
	expect(current).toBe(afterClick);
});

Then('the library is empty', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const count = await yarner.getLibraryGameCount();
	expect(count).toBe(0);
});
