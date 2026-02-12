<script lang="ts">
	import type { LayoutData } from './$types';

	export let data: LayoutData;
</script>

<slot />

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
		background: #1a1a1a;
		color: #e0e0e0;
	}

	:global(*) {
		box-sizing: border-box;
	}
</style>
