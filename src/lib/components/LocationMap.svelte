<script lang="ts">
	/**
	 * LocationMap — Visual map of visited locations with exits and notes.
	 *
	 * Shows a simple list of all locations the AI has tracked, with:
	 * - Exits: explored (shows destination) or unexplored
	 * - Notes: items on the floor, locked doors, etc.
	 *
	 * Can be shown inline (inside AIAssistant) or as a full third column.
	 * The expand/collapse button toggles between modes.
	 */
	import { aiGameStatus, locationMapExpanded } from '$lib/stores/aiChat';

	/** When true, the component is rendered in the full third-column mode */
	export let expanded = false;

	$: locations = Object.entries($aiGameStatus.locaisVisitados || {});
	$: currentLocation = $aiGameStatus.localizacaoAtual;

	function toggleExpanded() {
		locationMapExpanded.set(!$locationMapExpanded);
	}
</script>

<div class="location-map" class:expanded>
	<div class="map-header">
		<span class="map-title">🗺️ Mapa de Locais</span>
		<button
			class="btn-expand"
			on:click={toggleExpanded}
			title={expanded ? 'Recolher para painel lateral' : 'Expandir para coluna'}
		>
			{expanded ? '↙' : '↗'}
		</button>
	</div>

	{#if locations.length === 0}
		<div class="empty-map">
			<p>Nenhum local visitado ainda.</p>
			<p class="hint">Jogue um pouco para o mapa ser preenchido.</p>
		</div>
	{:else}
		<div class="locations-list">
			{#each locations as [name, data]}
				<div class="location-entry" class:current={name === currentLocation}>
					<div class="location-name">
						{#if name === currentLocation}<span class="here-marker">▶</span>{/if}
						{name}
					</div>

					{#if Object.keys(data.saidas).length > 0}
						<div class="exits">
							{#each Object.entries(data.saidas) as [dir, dest]}
								<span
									class="exit-tag"
									class:explored={dest !== 'não explorado' && dest !== 'nao explorado'}
								>
									{dir}: {dest}
								</span>
							{/each}
						</div>
					{/if}

					{#if data.notas && data.notas.length > 0}
						<ul class="location-notes">
							{#each data.notas as nota}
								<li>{nota}</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.location-map {
		display: flex;
		flex-direction: column;
		background: var(--bg-panel);
		overflow: hidden;
	}

	.location-map.expanded {
		height: 100%;
	}

	/* ---- Header ---- */
	.map-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.6rem 1rem;
		background: var(--bg-elevated);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.map-title {
		font-size: 0.9rem;
		color: var(--accent);
		font-weight: 600;
	}

	.btn-expand {
		background: var(--btn-bg);
		border: none;
		color: var(--text-primary);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: background 0.2s;
	}

	.btn-expand:hover {
		background: var(--btn-hover);
	}

	/* ---- Empty state ---- */
	.empty-map {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--text-faint);
		font-size: 0.85rem;
	}

	.empty-map p {
		margin: 0.25rem 0;
	}

	.hint {
		font-style: italic;
		color: var(--text-faint);
	}

	/* ---- Locations list ---- */
	.locations-list {
		overflow-y: auto;
		flex: 1;
		padding: 0.5rem;
	}

	.locations-list::-webkit-scrollbar {
		width: 6px;
	}

	.locations-list::-webkit-scrollbar-track {
		background: var(--scrollbar-track);
	}

	.locations-list::-webkit-scrollbar-thumb {
		background: var(--scrollbar-thumb);
		border-radius: 4px;
	}

	.location-entry {
		padding: 0.6rem 0.75rem;
		margin-bottom: 0.4rem;
		border-radius: 6px;
		background: var(--msg-user-bg);
		border-left: 3px solid var(--border);
	}

	.location-entry.current {
		border-left-color: var(--accent);
		background: var(--location-current-bg);
	}

	.location-name {
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.35rem;
	}

	.here-marker {
		color: var(--accent);
		margin-right: 0.3rem;
	}

	/* ---- Exits ---- */
	.exits {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin-bottom: 0.3rem;
	}

	.exit-tag {
		font-size: 0.75rem;
		padding: 0.15rem 0.45rem;
		border-radius: 3px;
		background: var(--location-exit-bg);
		color: var(--text-secondary);
	}

	.exit-tag.explored {
		background: var(--location-exit-explored-bg);
		color: var(--location-exit-explored-text);
	}

	/* ---- Notes ---- */
	.location-notes {
		margin: 0.2rem 0 0;
		padding-left: 1rem;
		font-size: 0.78rem;
		color: var(--text-secondary);
	}

	.location-notes li {
		margin-bottom: 0.1rem;
	}
</style>
