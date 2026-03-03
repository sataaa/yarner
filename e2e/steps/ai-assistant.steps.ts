import { createBdd } from 'playwright-bdd';
import { expect } from '@playwright/test';
import { YarnerPage } from '../fixtures/test-helpers';

const { When, Then } = createBdd();

When('I paste a valid API key in onboarding', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForOnboarding();
	await yarner.pasteOnboardingKey('fake-test-api-key-12345');
});

When('the chat input becomes available', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForChatReady();
});

When('I send the AI message {string}', async ({ page }, message: string) => {
	const yarner = new YarnerPage(page);
	await yarner.typeAIMessage(message);
});

When('I click a quick hint chip', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickQuickHint('where am I?');
});

When('I clear the chat', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.clickClearChat();
});

Then('the onboarding panel is visible', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForOnboarding();
});

Then('the onboarding shows success', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForOnboardingSuccess();
});

Then('I see an AI response', async ({ page }) => {
	const yarner = new YarnerPage(page);
	await yarner.waitForAIResponse();
	const response = await yarner.getLastAIResponse();
	expect(response).toBeTruthy();
});

Then('the chat is empty', async ({ page }) => {
	const yarner = new YarnerPage(page);
	const isEmpty = await yarner.isEmptyChatVisible();
	expect(isEmpty).toBe(true);
});
