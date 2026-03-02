<script lang="ts">
	import '$lib/i18n';
	import { isLoading } from 'svelte-i18n';
</script>

{#if !$isLoading}
	<slot />
{/if}

<style>
	/* ===== TEMA: Dark Orange (default) ===== */
	:global(:root),
	:global([data-theme="dark-orange"]) {
		--bg-base: #1a1a1a;
		--bg-panel: #1e1e1e;
		--bg-header: #242424;
		--bg-input: #1e1e1e;
		--bg-elevated: #2a2a2a;
		--bg-hover: #3a3a2a;

		--text-primary: #e0e0e0;
		--text-secondary: #b0b0b0;
		--text-faint: #666;
		--text-code: #80e0a0;

		--accent: #ffa500;
		--accent-hover: #ffb733;
		--accent-dark: #ff8c00;
		--accent-dim: #5a3a00;
		--accent-text-on: #1a1a1a;

		--border: #3a3a3a;
		--border-light: #4a4a4a;
		--border-accent: #552222;

		--btn-bg: #3a3a3a;
		--btn-hover: #4a4a4a;

		--success-bg: #1e3a1e;
		--success-text: #80d080;
		--success-border: #2a5a2a;
		--success-dim-bg: #1e2a1e;
		--success-dim-text: #70a870;

		--error-bg: #331818;
		--error-text: #ff8888;
		--error-border: #552222;
		--error-btn-bg: #7a2020;
		--error-btn-border: #aa3030;
		--error-btn-text: #ffaaaa;
		--error-btn-hover: #9a2a2a;
		--error-dim-bg: #442222;
		--error-item-bg: #1e1010;
		--error-item-border: #6a3030;
		--error-delete-hover-bg: #3a2020;
		--error-delete-hover-text: #e06060;

		--warning-bg: #2a1a0a;
		--warning-text: #e0a060;
		--warning-border: #5a3a1a;

		--info-text: #88aaff;
		--info-bg: #1e2a4a;
		--info-border: #3a4a7a;
		--info-hover: #2a3a6a;
		--info-selected-bg: #2a3a6a;
		--info-selected-border: #5a6aaa;

		--link-color: #6db3f2;

		--scrollbar-track: #2a2a2a;
		--scrollbar-thumb: #4a4a4a;
		--scrollbar-thumb-hover: #5a5a5a;

		--msg-user-bg: #252525;
		--msg-assistant-bg: #1e1e1e;
		--msg-assistant-border: #2e2e2e;
		--msg-strong: #ffd080;
		--msg-em: #c0d0ff;
		--msg-code-bg: #2a2a2a;
		--msg-code-border: #3a3a3a;

		--hint-chip-bg: #2a2a2a;
		--hint-chip-border: #3a3a3a;
		--hint-chip-text: #777;

		--location-current-bg: #2a2418;
		--location-exit-bg: #3a2a2a;
		--location-exit-explored-bg: #1e3a2a;
		--location-exit-explored-text: #6dbb8a;

		--upload-border: #4a4a4a;
		--upload-drag-bg: #2a2200;
	}

	/* ===== TEMA: Amber Terminal ===== */
	:global([data-theme="amber-terminal"]) {
		--bg-base: #0a0800;
		--bg-panel: #100e04;
		--bg-header: #1a1508;
		--bg-input: #0a0800;
		--bg-elevated: #1a1508;
		--bg-hover: #2a2010;

		--text-primary: #ffb000;
		--text-secondary: #cc8800;
		--text-faint: #885500;
		--text-code: #ffe080;

		--accent: #ffb000;
		--accent-hover: #ffc333;
		--accent-dark: #cc8800;
		--accent-dim: #4a3000;
		--accent-text-on: #0a0800;

		--border: #332a10;
		--border-light: #4a3a18;
		--border-accent: #553a10;

		--btn-bg: #2a2010;
		--btn-hover: #3a3018;

		--success-bg: #1a2a0a;
		--success-text: #bbcc44;
		--success-border: #2a3a10;
		--success-dim-bg: #1a2a0a;
		--success-dim-text: #99aa33;

		--error-bg: #2a1000;
		--error-text: #ff6633;
		--error-border: #553018;
		--error-btn-bg: #6a2000;
		--error-btn-border: #993300;
		--error-btn-text: #ffaa77;
		--error-btn-hover: #8a3010;
		--error-dim-bg: #331a08;
		--error-item-bg: #1a0a00;
		--error-item-border: #5a2a10;
		--error-delete-hover-bg: #3a1a08;
		--error-delete-hover-text: #dd5522;

		--warning-bg: #2a1a00;
		--warning-text: #ffaa33;
		--warning-border: #5a3a10;

		--info-text: #ffcc55;
		--info-bg: #1a1800;
		--info-border: #3a3010;
		--info-hover: #2a2808;
		--info-selected-bg: #2a2808;
		--info-selected-border: #5a5020;

		--link-color: #ffcc55;

		--scrollbar-track: #1a1508;
		--scrollbar-thumb: #3a3018;
		--scrollbar-thumb-hover: #4a4020;

		--msg-user-bg: #181408;
		--msg-assistant-bg: #100e04;
		--msg-assistant-border: #252010;
		--msg-strong: #ffcc44;
		--msg-em: #ffe088;
		--msg-code-bg: #1a1508;
		--msg-code-border: #332a10;

		--hint-chip-bg: #1a1508;
		--hint-chip-border: #332a10;
		--hint-chip-text: #885500;

		--location-current-bg: #2a2008;
		--location-exit-bg: #2a1a08;
		--location-exit-explored-bg: #1a2a0a;
		--location-exit-explored-text: #bbcc44;

		--upload-border: #4a3a18;
		--upload-drag-bg: #2a2008;
	}

	/* ===== TEMA: Green Phosphor ===== */
	:global([data-theme="green-phosphor"]) {
		--bg-base: #0a100a;
		--bg-panel: #0e150e;
		--bg-header: #0a1a0a;
		--bg-input: #0a100a;
		--bg-elevated: #122012;
		--bg-hover: #1a301a;

		--text-primary: #33ff33;
		--text-secondary: #22bb22;
		--text-faint: #1a7a1a;
		--text-code: #66ff99;

		--accent: #33ff33;
		--accent-hover: #55ff55;
		--accent-dark: #22bb22;
		--accent-dim: #0a3a0a;
		--accent-text-on: #0a100a;

		--border: #1a3a1a;
		--border-light: #2a4a2a;
		--border-accent: #1a5a1a;

		--btn-bg: #1a2a1a;
		--btn-hover: #2a3a2a;

		--success-bg: #0a2a0a;
		--success-text: #55ff55;
		--success-border: #1a4a1a;
		--success-dim-bg: #0a200a;
		--success-dim-text: #33cc33;

		--error-bg: #1a0a0a;
		--error-text: #ff5555;
		--error-border: #3a1a1a;
		--error-btn-bg: #5a1010;
		--error-btn-border: #882222;
		--error-btn-text: #ff8888;
		--error-btn-hover: #7a2020;
		--error-dim-bg: #2a1010;
		--error-item-bg: #150808;
		--error-item-border: #4a1a1a;
		--error-delete-hover-bg: #2a0a0a;
		--error-delete-hover-text: #dd4444;

		--warning-bg: #1a2a0a;
		--warning-text: #aaff33;
		--warning-border: #2a4a1a;

		--info-text: #55ffaa;
		--info-bg: #0a1a15;
		--info-border: #1a3a2a;
		--info-hover: #122a20;
		--info-selected-bg: #122a20;
		--info-selected-border: #2a5a3a;

		--link-color: #55ffaa;

		--scrollbar-track: #0e150e;
		--scrollbar-thumb: #1a3a1a;
		--scrollbar-thumb-hover: #2a4a2a;

		--msg-user-bg: #0e1a0e;
		--msg-assistant-bg: #0e150e;
		--msg-assistant-border: #1a2a1a;
		--msg-strong: #55ff55;
		--msg-em: #88ffaa;
		--msg-code-bg: #0a1a0a;
		--msg-code-border: #1a3a1a;

		--hint-chip-bg: #122012;
		--hint-chip-border: #1a3a1a;
		--hint-chip-text: #1a7a1a;

		--location-current-bg: #0a2a0a;
		--location-exit-bg: #1a2a1a;
		--location-exit-explored-bg: #0a3a1a;
		--location-exit-explored-text: #55ff55;

		--upload-border: #2a4a2a;
		--upload-drag-bg: #0a2a0a;
	}

	/* ===== TEMA: Parchment ===== */
	:global([data-theme="parchment"]) {
		--bg-base: #f4eed8;
		--bg-panel: #ebe5cf;
		--bg-header: #d4ceb8;
		--bg-input: #fff8e8;
		--bg-elevated: #e0dac4;
		--bg-hover: #d8d0b8;

		--text-primary: #2a2218;
		--text-secondary: #5a5040;
		--text-faint: #8a8070;
		--text-code: #5a3010;

		--accent: #8b4513;
		--accent-hover: #a0522d;
		--accent-dark: #6b3410;
		--accent-dim: #c4a878;
		--accent-text-on: #f4eed8;

		--border: #c4b898;
		--border-light: #b0a488;
		--border-accent: #a08060;

		--btn-bg: #d4ceb8;
		--btn-hover: #c4b898;

		--success-bg: #e8f0d8;
		--success-text: #2a6a1a;
		--success-border: #a0c888;
		--success-dim-bg: #e8f0d8;
		--success-dim-text: #3a7a2a;

		--error-bg: #f4e0d8;
		--error-text: #8b2020;
		--error-border: #d0a098;
		--error-btn-bg: #c44040;
		--error-btn-border: #a03030;
		--error-btn-text: #fff0f0;
		--error-btn-hover: #a03030;
		--error-dim-bg: #f0d8d0;
		--error-item-bg: #f4e8e0;
		--error-item-border: #d0a098;
		--error-delete-hover-bg: #f0d0c8;
		--error-delete-hover-text: #8b2020;

		--warning-bg: #f4e8d0;
		--warning-text: #7a5020;
		--warning-border: #c4a070;

		--info-text: #2a5088;
		--info-bg: #d8e4f0;
		--info-border: #a0b8d0;
		--info-hover: #c8d8e8;
		--info-selected-bg: #c8d8e8;
		--info-selected-border: #8aa8c8;

		--link-color: #2a5088;

		--scrollbar-track: #e0dac4;
		--scrollbar-thumb: #c4b898;
		--scrollbar-thumb-hover: #b0a488;

		--msg-user-bg: #e8e2cc;
		--msg-assistant-bg: #ebe5cf;
		--msg-assistant-border: #d4ceb8;
		--msg-strong: #5a2810;
		--msg-em: #2a5088;
		--msg-code-bg: #e0dac4;
		--msg-code-border: #c4b898;

		--hint-chip-bg: #e0dac4;
		--hint-chip-border: #c4b898;
		--hint-chip-text: #8a8070;

		--location-current-bg: #e8dcc0;
		--location-exit-bg: #e0d4b8;
		--location-exit-explored-bg: #d8e8d0;
		--location-exit-explored-text: #2a6a1a;

		--upload-border: #b0a488;
		--upload-drag-bg: #e8e0c0;
	}

	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: var(--bg-base);
		color: var(--text-primary);
		transition: background 0.3s, color 0.3s;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
