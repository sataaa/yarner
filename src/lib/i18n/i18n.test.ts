import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { get } from 'svelte/store';
import { register, locale, waitLocale } from 'svelte-i18n';
import ptBR from './locales/pt-BR.json';
import en from './locales/en.json';
import {
	SUPPORTED_LOCALES,
	DEFAULT_LOCALE,
	cycleLocale,
	setLocale,
	getLocaleLabel,
	getLocaleIcon
} from './index';

/** Recursively extract all keys from a nested object as dot-separated paths */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
	const keys: string[] = [];
	for (const key of Object.keys(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		const value = obj[key];
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
		} else {
			keys.push(fullKey);
		}
	}
	return keys.sort();
}

describe('i18n', () => {
	beforeAll(() => {
		// Register 'en' synchronously so setLocale('en') works in tests
		register('en', () => Promise.resolve(en));
	});

	describe('SUPPORTED_LOCALES', () => {
		it('contains pt-BR and en', () => {
			expect(SUPPORTED_LOCALES).toContain('pt-BR');
			expect(SUPPORTED_LOCALES).toContain('en');
		});
	});

	describe('DEFAULT_LOCALE', () => {
		it('is pt-BR', () => {
			expect(DEFAULT_LOCALE).toBe('pt-BR');
		});
	});

	describe('getLocaleLabel', () => {
		it('returns PT-BR for pt-BR', () => {
			expect(getLocaleLabel('pt-BR')).toBe('PT-BR');
		});

		it('returns EN for en', () => {
			expect(getLocaleLabel('en')).toBe('EN');
		});

		it('returns the locale itself for unknown locales', () => {
			expect(getLocaleLabel('fr')).toBe('fr');
		});

		it('returns default label for null/undefined', () => {
			expect(getLocaleLabel(null)).toBe('PT-BR');
			expect(getLocaleLabel(undefined)).toBe('PT-BR');
		});
	});

	describe('getLocaleIcon', () => {
		it('returns BR text for pt-BR', () => {
			expect(getLocaleIcon('pt-BR')).toBe('BR');
		});

		it('returns US text for en', () => {
			expect(getLocaleIcon('en')).toBe('US');
		});

		it('returns fallback for unknown locales', () => {
			expect(getLocaleIcon('fr')).toBe('??');
		});

		it('returns default icon for null/undefined', () => {
			expect(getLocaleIcon(null)).toBe('BR');
			expect(getLocaleIcon(undefined)).toBe('BR');
		});
	});

	describe('setLocale', () => {
		beforeEach(() => {
			setLocale('pt-BR');
		});

		it('sets the locale store', async () => {
			setLocale('en');
			await waitLocale('en');
			expect(get(locale)).toBe('en');
		});

		it('changes back to pt-BR', () => {
			setLocale('en');
			setLocale('pt-BR');
			expect(get(locale)).toBe('pt-BR');
		});
	});

	describe('cycleLocale', () => {
		beforeEach(() => {
			setLocale('pt-BR');
		});

		it('cycles from pt-BR to en', () => {
			cycleLocale();
			expect(get(locale)).toBe('en');
		});

		it('cycles from en back to pt-BR', () => {
			setLocale('en');
			cycleLocale();
			expect(get(locale)).toBe('pt-BR');
		});
	});

	describe('locale key parity', () => {
		it('en.json has the same keys as pt-BR.json', () => {
			const ptKeys = extractKeys(ptBR as Record<string, unknown>);
			const enKeys = extractKeys(en as Record<string, unknown>);
			expect(enKeys).toEqual(ptKeys);
		});

		it('pt-BR.json has no empty string values', () => {
			const ptKeys = extractKeys(ptBR as Record<string, unknown>);
			for (const key of ptKeys) {
				const value = key.split('.').reduce((obj: unknown, k) => (obj as Record<string, unknown>)?.[k], ptBR);
				if (typeof value === 'string') {
					expect(value.trim().length, `pt-BR key "${key}" is empty`).toBeGreaterThan(0);
				}
			}
		});

		it('en.json has no empty string values', () => {
			const enKeys = extractKeys(en as Record<string, unknown>);
			for (const key of enKeys) {
				const value = key.split('.').reduce((obj: unknown, k) => (obj as Record<string, unknown>)?.[k], en);
				if (typeof value === 'string') {
					expect(value.trim().length, `en key "${key}" is empty`).toBeGreaterThan(0);
				}
			}
		});
	});
});
