import { writable } from 'svelte/store';

export interface Theme {
	id: string;
	label: string;
	icon: string;
}

export const themes: Theme[] = [
	{ id: 'dark-orange', label: 'Dark Orange', icon: '🌑' },
	{ id: 'amber-terminal', label: 'Amber Terminal', icon: '💛' },
	{ id: 'green-phosphor', label: 'Green Phosphor', icon: '💚' },
	{ id: 'parchment', label: 'Parchment', icon: '📜' }
];

const STORAGE_KEY = 'yarner-theme';
const DEFAULT_THEME = 'dark-orange';

function getInitialTheme(): string {
	if (typeof localStorage === 'undefined') return DEFAULT_THEME;
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved && themes.some((t) => t.id === saved)) return saved;
	return DEFAULT_THEME;
}

function createThemeStore() {
	const { subscribe, set } = writable<string>(getInitialTheme());

	return {
		subscribe,
		setTheme(themeId: string) {
			if (!themes.some((t) => t.id === themeId)) return;
			set(themeId);
			if (typeof localStorage !== 'undefined') {
				localStorage.setItem(STORAGE_KEY, themeId);
			}
			if (typeof document !== 'undefined') {
				document.documentElement.setAttribute('data-theme', themeId);
			}
		}
	};
}

export const currentTheme = createThemeStore();

// Apply theme on load
if (typeof document !== 'undefined') {
	document.documentElement.setAttribute('data-theme', getInitialTheme());
}
