import { type Page, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const FIXTURE_DIR = path.dirname(__filename);

export class YarnerPage {
	constructor(public page: Page) {}

	// --- Navigation ---

	async goto() {
		await this.page.goto('/');
		await this.page.waitForLoadState('networkidle');
	}

	async isOnHomeScreen() {
		await expect(this.page.locator('.upload-screen')).toBeVisible();
	}

	// --- Cleanup ---

	async clearIndexedDB() {
		await this.page.evaluate(() => {
			return new Promise<void>((resolve, reject) => {
				const req = indexedDB.deleteDatabase('yarner-ai');
				req.onsuccess = () => resolve();
				req.onerror = () => reject(req.error);
				req.onblocked = () => resolve();
			});
		});
	}

	async clearLocalStorage() {
		await this.page.evaluate(() => localStorage.clear());
	}

	async cleanAll() {
		await this.clearLocalStorage();
		await this.clearIndexedDB();
	}

	// --- Upload ---

	async uploadGame(filename: string = 'advent.z3') {
		const filePath = path.join(FIXTURE_DIR, filename);
		const input = this.page.locator('input.file-input');
		await input.setInputFiles(filePath);
	}

	// --- Library ---

	async clickGameInLibrary(name: string) {
		await this.page.locator('.library-game-btn').filter({ hasText: name }).click();
	}

	async clickSaveInLibrary(saveName: string) {
		await this.page.locator('.save-btn').filter({ hasText: saveName }).click();
	}

	async isGameInLibrary(name: string) {
		await expect(this.page.locator('.library-game-btn').filter({ hasText: name })).toBeVisible({ timeout: 10_000 });
	}

	async getLibraryGameCount() {
		return this.page.locator('.library-game-btn').count();
	}

	async librarySaveBadgesFor(name: string) {
		const wrapper = this.page.locator('.library-item-wrapper').filter({ hasText: name });
		return wrapper.locator('.save-btn').count();
	}

	// --- Game Panel ---

	async waitForGamePanel() {
		await expect(this.page.locator('.panel.game-panel')).toBeVisible({ timeout: 10_000 });
	}

	async waitForGameOutput() {
		await expect(this.page.locator('.output-line').first()).toBeVisible({ timeout: 10_000 });
	}

	async typeCommand(cmd: string) {
		const input = this.page.locator('.command-input');
		await input.fill(cmd);
		await input.press('Enter');
	}

	async getGameOutputText() {
		await this.waitForGameOutput();
		// Wait for typewriter to finish (cursor disappears or stabilize)
		await this.page.waitForTimeout(500);
		const lines = await this.page.locator('.output-line').allTextContents();
		return lines.join('\n');
	}

	async isCommandInputFocused() {
		return this.page.locator('.command-input').evaluate(
			(el) => document.activeElement === el
		);
	}

	async clickOutputArea() {
		await this.page.locator('.output-container').click();
	}

	// --- Save/Load ---

	async openSavePanel() {
		await this.page.locator('.game-controls .btn-icon').nth(0).click();
	}

	async saveAs(slotName: string) {
		await this.openSavePanel();
		await this.page.locator('.slot-input').fill(slotName);
		await this.page.locator('.save-load-panel .btn-confirm').click();
		// Panel auto-closes on success; wait for feedback message
		await expect(this.page.locator('.save-feedback')).toBeVisible({ timeout: 5_000 });
		// Wait for save panel to close
		await expect(this.page.locator('.save-load-panel')).not.toBeVisible({ timeout: 5_000 });
	}

	async closeSavePanel() {
		// Wait for save panel to be stable, then close
		const closeBtn = this.page.locator('.save-load-panel .btn-cancel');
		await expect(closeBtn).toBeVisible({ timeout: 5_000 });
		await closeBtn.click({ force: true });
	}

	async overwriteLastSlot() {
		await this.openSavePanel();
		await this.page.locator('.overwrite-btn').click();
		// Confirm the overwrite
		await this.page.locator('.confirm-strip-inline .btn-confirm').click();
		await expect(this.page.locator('.save-feedback')).toBeVisible({ timeout: 5_000 });
	}

	async openLoadPanel() {
		await this.page.locator('.game-controls .btn-icon').nth(1).click();
	}

	async loadSlot(name: string) {
		await this.openLoadPanel();
		await this.page.locator('.slot-item').filter({ hasText: name }).locator('.btn-load').click();
		// Confirm the load
		await this.page.locator('.confirm-strip-inline .btn-confirm').click();
	}

	async getSaveFeedbackText() {
		return this.page.locator('.save-feedback').textContent();
	}

	// --- Restart / Close ---

	async clickRestartButton() {
		await this.page.locator('.game-controls .btn-icon').nth(3).click();
	}

	async confirmRestart() {
		await this.page.locator('.confirm-strip .btn-danger').click();
	}

	async cancelRestart() {
		await this.page.locator('.confirm-strip .btn-cancel-sm').click();
	}

	async clickCloseButton() {
		await this.page.locator('.game-controls .btn-icon').nth(4).click();
	}

	async confirmClose() {
		await this.page.locator('.confirm-strip .btn-danger').click();
	}

	// --- AI Panel ---

	async waitForOnboarding() {
		await expect(this.page.locator('.onboarding-panel')).toBeVisible({ timeout: 5_000 });
	}

	async pasteOnboardingKey(key: string) {
		const input = this.page.locator('#onboarding-key');
		await input.fill(key);
		// Trigger blur to start validation (paste event needs setTimeout, blur is simpler)
		await input.blur();
	}

	async waitForOnboardingSuccess() {
		await expect(this.page.locator('.onboarding-status.success')).toBeVisible({ timeout: 10_000 });
	}

	async waitForOnboardingError() {
		await expect(this.page.locator('.onboarding-status.error')).toBeVisible({ timeout: 10_000 });
	}

	async waitForChatReady() {
		// Onboarding disappears, message input appears
		await expect(this.page.locator('.message-input')).toBeVisible({ timeout: 10_000 });
	}

	async typeAIMessage(msg: string) {
		const input = this.page.locator('.message-input');
		await input.fill(msg);
		await this.page.locator('.btn-send').click();
	}

	async waitForAIResponse() {
		// Wait for assistant message to appear and streaming to finish
		await expect(this.page.locator('.message.assistant').last()).toBeVisible({ timeout: 15_000 });
		// Wait for streaming class to be removed
		await expect(this.page.locator('.message.assistant.streaming')).toHaveCount(0, { timeout: 15_000 });
	}

	async getAIMessages() {
		return this.page.locator('.message').allTextContents();
	}

	async getLastAIResponse() {
		return this.page.locator('.message.assistant').last().textContent();
	}

	async clickQuickHint(hintText: string) {
		await this.page.locator('.empty-hints span').filter({ hasText: hintText }).click();
	}

	async clickClearChat() {
		// Clear chat is the trash button in AI header
		const buttons = this.page.locator('.chat-header .btn-icon');
		// It's the second button (Notes, Clear, Settings)
		await buttons.nth(1).click();
	}

	async isEmptyChatVisible() {
		return this.page.locator('.empty-chat').isVisible();
	}

	async clickSettingsButton() {
		const buttons = this.page.locator('.chat-header .btn-icon');
		await buttons.nth(2).click();
	}

	// --- Header ---

	async clickThemeButton() {
		// Theme is the second header-btn
		await this.page.locator('.header-btn').nth(1).click();
	}

	async clickLocaleButton() {
		// Locale is the first header-btn
		await this.page.locator('.header-btn').nth(0).click();
	}

	async getActiveTheme(): Promise<string> {
		return this.page.locator('html').getAttribute('data-theme') ?? 'classic';
	}

	async getLocaleButtonText(): Promise<string> {
		return (await this.page.locator('.header-btn').nth(0).textContent()) ?? '';
	}

	// --- Clear All Data ---

	async clearAllData() {
		await this.page.locator('.btn-clear-data').click();
		await this.page.locator('.clear-confirm-input').fill('DELETE');
		await this.page.locator('.btn-danger-sm').click();
		await this.page.waitForURL('/', { timeout: 10_000 });
		await this.page.waitForLoadState('networkidle');
	}

	// --- API Mocking ---

	static async mockGeminiAPI(page: Page) {
		// Mock models endpoint (for onboarding validation)
		await page.route('**/generativelanguage.googleapis.com/v1beta/models*', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					models: [
						{
							name: 'models/gemma-3-27b-it',
							displayName: 'Gemma 3 27B',
							supportedGenerationMethods: ['generateContent', 'countTokens']
						}
					]
				})
			})
		);

		// Mock OpenAI-compatible chat completions endpoint (used by Gemini provider)
		await page.route('**/generativelanguage.googleapis.com/v1beta/openai/chat/completions*', (route) =>
			route.fulfill({
				status: 200,
				contentType: 'text/event-stream',
				body: 'data: {"choices":[{"delta":{"content":"This is a mocked AI response for testing."}}]}\n\ndata: [DONE]\n\n'
			})
		);
	}

	static async mockGeminiAPIError(page: Page) {
		await page.route('**/generativelanguage.googleapis.com/v1beta/models*', (route) =>
			route.fulfill({ status: 401, body: 'Unauthorized' })
		);
	}
}
