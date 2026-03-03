/**
 * i18n setup — svelte-i18n initialization with locale persistence.
 *
 * Default locale (PT-BR) is loaded synchronously to avoid flash.
 * Other locales are lazy-loaded on demand.
 */

import { register, init, getLocaleFromNavigator, locale } from 'svelte-i18n';
import { get } from 'svelte/store';
import ptBR from './locales/pt-BR.json';

const STORAGE_KEY = 'yarner-locale';
const DEFAULT_LOCALE = 'pt-BR';
export const SUPPORTED_LOCALES = ['pt-BR', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// PT-BR loaded sync (no flash); EN lazy-loaded
register('pt-BR', () => Promise.resolve(ptBR));
register('en', () => import('./locales/en.json'));

function getInitialLocale(): string {
	if (typeof localStorage === 'undefined') return DEFAULT_LOCALE;

	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
		return saved;
	}

	// Auto-detect from browser
	const nav = getLocaleFromNavigator() ?? DEFAULT_LOCALE;
	if (nav.startsWith('en')) return 'en';
	return DEFAULT_LOCALE; // pt-BR for pt* and any other
}

init({
	fallbackLocale: DEFAULT_LOCALE,
	initialLocale: getInitialLocale()
});

/** Persists locale choice to localStorage */
export function setLocale(loc: SupportedLocale): void {
	locale.set(loc);
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_KEY, loc);
	}
}

/** Cycles to the next locale (same pattern as theme cycling) */
export function cycleLocale(): void {
	const current = get(locale) ?? DEFAULT_LOCALE;
	const idx = SUPPORTED_LOCALES.indexOf(current as SupportedLocale);
	const next = SUPPORTED_LOCALES[(idx + 1) % SUPPORTED_LOCALES.length];
	setLocale(next);
}

/** Display label for a locale */
export function getLocaleLabel(loc: string | null | undefined): string {
	const labels: Record<string, string> = {
		'pt-BR': 'PT-BR',
		en: 'EN'
	};
	return labels[loc ?? DEFAULT_LOCALE] ?? (loc ?? DEFAULT_LOCALE);
}

/** Icon (flag) for a locale */
export function getLocaleIcon(loc: string | null | undefined): string {
	const icons: Record<string, string> = {
		'pt-BR': '🇧🇷',
		en: '🇺🇸'
	};
	return icons[loc ?? DEFAULT_LOCALE] ?? '🌐';
}

export { DEFAULT_LOCALE };
