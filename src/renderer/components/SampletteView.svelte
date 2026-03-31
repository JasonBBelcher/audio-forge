<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Button from './ui/Button.svelte';
  import BatchImportPanel from './BatchImportPanel.svelte';

  interface Discovery {
    id?: number;
    youtube_id: string;
    title: string;
    uploader: string | null;
    upload_date: string | null;
    duration: number | null;
    view_count: number | null;
    thumbnail_url: string | null;
    description: string | null;
    bpm: number | null;
    key: string | null;
    genre: string | null;
    discovered_via: string;
    is_favorite: boolean;
  }

  type Phase = 'idle' | 'rolling' | 'playing' | 'importing';

  let currentTrack: Discovery | null = null;
  let phase: Phase = 'idle';
  let history: Discovery[] = [];
  let favorites: Discovery[] = [];
  let showFavoritesOnly = false;
  let selectedGenres: string[] = [];
  let maxViews: number | undefined;
  let showBatchImport = false;
  let importProgress = 0;
  let importStatus = '';

  const af = (window as any).audioforge;
  let unsubscribers: (() => void)[] = [];

  const genres = [
    'funk',
    'soul',
    'jazz',
    'afrobeat',
    'latin',
    'disco',
    'reggae',
    'hiphop',
    'electronic',
    'world',
  ];

  onMount(async () => {
    history = await af.discovery.getHistory(100);
    favorites = await af.discovery.getFavorites();
  });

  onDestroy(() => {
    unsubscribers.forEach((fn) => fn());
  });

  async function handleRollDice() {
    try {
      phase = 'rolling';
      const filters = selectedGenres.length > 0 ? { genres: selectedGenres, maxViews } : { maxViews };
      currentTrack = await af.discovery.roll(filters);
      history = [currentTrack, ...history].slice(0, 100);
      phase = 'playing';
    } catch (err) {
      console.error('Roll failed:', err);
      phase = 'idle';
    }
  }

  async function handleImportCurrent() {
    if (!currentTrack) return;
    try {
      phase = 'importing';
      const assetId = await af.discovery.importToLibrary(currentTrack.id, { analyze: true });
      console.log('Imported as asset', assetId);
      phase = 'idle';
      handleRollDice();
    } catch (err) {
      console.error('Import failed:', err);
      phase = 'idle';
    }
  }

  async function handleToggleFavorite() {
    if (!currentTrack || !currentTrack.id) return;
    const newFav = await af.discovery.toggleFavorite(currentTrack.id);
    if (currentTrack) {
      currentTrack.is_favorite = newFav;
    }
    favorites = await af.discovery.getFavorites();
  }

  async function handleBatchImport(urls: string[]) {
    try {
      importStatus = 'Processing URLs...';
      const results = await af.discovery.batch(urls);
      importStatus = `Imported ${results.length} tracks`;
      showBatchImport = false;
      history = await af.discovery.getHistory(100);
      setTimeout(() => (importStatus = ''), 3000);
    } catch (err) {
      importStatus = `Error: ${err}`;
    }
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatViews(views: number | null): string {
    if (!views) return '?';
    if (views > 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views > 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
  }

  function getDisplayHistory() {
    if (showFavoritesOnly) {
      return favorites;
    }
    return history;
  }
</script>

<div class="samplette-view">
  <div class="header">
    <h1>🎲 CrateDigger</h1>
    <p class="subtitle">Digital Crate Digging</p>
  </div>

  <!-- Filter Bar -->
  <div class="filter-bar">
    <div class="filter-group">
      <label for="genre-select">Genre:</label>
      <select id="genre-select" bind:value={selectedGenres[0]}>
        <option value="">Any</option>
        {#each genres as genre}
          <option value={genre}>{genre}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label for="max-views-select">Max Views:</label>
      <select id="max-views-select" bind:value={maxViews}>
        <option value={undefined}>Any</option>
        <option value={100}>Deep Cut (&lt;100)</option>
        <option value={1000}>Forgotten (&lt;1K)</option>
        <option value={10000}>Obscure (&lt;10K)</option>
        <option value={50000}>Moderate (&lt;50K)</option>
        <option value={100000}>Popular (&lt;100K)</option>
      </select>
    </div>

    <Button variant="secondary" on:click={() => (showBatchImport = !showBatchImport)}>
      📋 Batch Import
    </Button>
  </div>

  {#if showBatchImport}
    <BatchImportPanel on:import={(e) => handleBatchImport(e.detail.urls)} />
  {/if}

  <!-- Now Playing / Loading / Empty -->
  {#if phase === 'rolling'}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Digging through the crates...</p>
    </div>
  {:else if currentTrack}
    <div class="now-playing">
      <!-- Compact track card -->
      <div class="track-card">
        <!-- Small thumbnail -->
        <button
          class="thumb-btn"
          on:click={() => af.shell.openExternal(`https://www.youtube.com/watch?v=${currentTrack.youtube_id}`)}
          title="Watch on YouTube"
        >
          {#if currentTrack.thumbnail_url}
            <img src={currentTrack.thumbnail_url} alt={currentTrack.title} class="thumb" />
          {:else}
            <div class="thumb thumb-placeholder">🎵</div>
          {/if}
          <div class="thumb-overlay">▶</div>
        </button>

        <!-- Metadata -->
        <div class="track-meta">
          <h2 class="track-title">{currentTrack.title}</h2>
          <p class="track-artist">{currentTrack.uploader || 'Unknown Artist'}</p>
          <p class="track-stats">
            {formatDuration(currentTrack.duration)} •
            {formatViews(currentTrack.view_count)} views •
            {currentTrack.upload_date || '?'}
          </p>
          <div class="track-tags">
            {#if currentTrack.bpm}
              <span class="tag">BPM: {currentTrack.bpm}</span>
            {/if}
            {#if currentTrack.key}
              <span class="tag">Key: {currentTrack.key}</span>
            {/if}
            {#if currentTrack.genre}
              <span class="tag">{currentTrack.genre}</span>
            {/if}
          </div>
        </div>

        <!-- Actions -->
        <div class="track-actions">
          <button
            on:click={handleToggleFavorite}
            class="icon-btn"
            title={currentTrack.is_favorite ? 'Remove favorite' : 'Add to favorites'}
          >
            {currentTrack.is_favorite ? '⭐' : '☆'}
          </button>
          <Button variant="secondary" on:click={handleImportCurrent} disabled={phase === 'importing'}>
            {phase === 'importing' ? 'Importing...' : '⬇ Import'}
          </Button>
          <Button variant="primary" on:click={handleRollDice} disabled={phase === 'importing'}>
            🎲 Roll
          </Button>
        </div>
      </div>

      {#if currentTrack.description}
        <p class="description">{currentTrack.description.substring(0, 200)}...</p>
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <p>Press the dice to discover music</p>
      <Button variant="primary" on:click={handleRollDice} size="large">
        🎲 Roll the Dice
      </Button>
    </div>
  {/if}

  <!-- Discovery History -->
  <div class="history-section">
    <div class="history-header">
      <h3>Discovery History</h3>
      <div class="history-controls">
        <button
          class="toggle-btn"
          class:active={showFavoritesOnly}
          on:click={() => (showFavoritesOnly = !showFavoritesOnly)}
        >
          {showFavoritesOnly ? '⭐ Favorites Only' : 'Show All'}
        </button>
      </div>
    </div>

    {#if importStatus}
      <div class="import-status">
        <p>{importStatus}</p>
      </div>
    {/if}

    <div class="history-list">
      {#each getDisplayHistory().slice(0, 20) as item (item.id || item.youtube_id)}
        <button
          class="history-item"
          class:current={currentTrack?.youtube_id === item.youtube_id}
          on:click={() => (currentTrack = item)}
        >
          <span class="fav-badge">{item.is_favorite ? '⭐' : ''}</span>
          <span class="title">{item.title}</span>
          <span class="metadata">
            {#if item.bpm}
              <span>{item.bpm}bpm</span>
            {/if}
            {#if item.key}
              <span>{item.key}</span>
            {/if}
          </span>
          <span class="views">{formatViews(item.view_count)}</span>
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .samplette-view {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    padding: 2rem;
    height: 100%;
    overflow-y: auto;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: #eee;
  }

  .header {
    text-align: center;
  }

  .header h1 {
    margin: 0;
    font-size: 2.5rem;
  }

  .subtitle {
    margin: 0.5rem 0 0 0;
    color: #aaa;
    font-size: 0.95rem;
  }

  .filter-bar {
    display: flex;
    gap: 1rem;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    padding: 1rem;
    border-radius: 8px;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .filter-group label {
    font-weight: 500;
    font-size: 0.9rem;
  }

  .filter-group select {
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #444;
    background: #222;
    color: #eee;
    cursor: pointer;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 4rem;
    color: #aaa;
    font-size: 1rem;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(100, 150, 255, 0.2);
    border-top-color: #6496ff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .now-playing {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .track-card {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  /* Small thumbnail button */
  .thumb-btn {
    position: relative;
    flex-shrink: 0;
    width: 96px;
    height: 96px;
    border-radius: 6px;
    overflow: hidden;
    background: #000;
    border: none;
    cursor: pointer;
    padding: 0;
  }

  .thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .thumb-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    background: rgba(255, 255, 255, 0.05);
    width: 100%;
    height: 100%;
  }

  .thumb-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    color: #fff;
    background: rgba(0, 0, 0, 0.3);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .thumb-btn:hover .thumb-overlay {
    opacity: 1;
  }

  /* Metadata column */
  .track-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .track-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track-artist {
    margin: 0;
    font-size: 0.85rem;
    color: #aaa;
  }

  .track-stats {
    margin: 0;
    font-size: 0.78rem;
    color: #888;
  }

  .track-tags {
    display: flex;
    gap: 0.4rem;
    flex-wrap: wrap;
    margin-top: 0.25rem;
  }

  .tag {
    background: rgba(100, 150, 255, 0.2);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  /* Actions column */
  .track-actions {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    align-items: stretch;
    flex-shrink: 0;
  }

  .description {
    margin: 0;
    font-size: 0.8rem;
    color: #888;
    line-height: 1.4;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .icon-btn {
    background: none;
    border: none;
    color: #eee;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 3rem;
    text-align: center;
    color: #999;
  }

  .history-section {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
  }

  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .history-header h3 {
    margin: 0;
  }

  .toggle-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #eee;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .toggle-btn:hover,
  .toggle-btn.active {
    background: rgba(100, 150, 255, 0.3);
    border-color: rgba(100, 150, 255, 0.5);
  }

  .import-status {
    background: rgba(100, 200, 100, 0.2);
    padding: 0.8rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    color: #9f9;
  }

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
    background: transparent;
    border: none;
    color: inherit;
    text-align: left;
    font: inherit;
  }

  .history-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  .history-item.current {
    background: rgba(100, 150, 255, 0.2);
    border-left: 3px solid #6496ff;
  }

  .fav-badge {
    min-width: 20px;
  }

  .history-item .title {
    flex: 1;
    font-size: 0.9rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .history-item .metadata {
    display: flex;
    gap: 0.3rem;
    font-size: 0.75rem;
    color: #999;
  }

  .history-item .metadata span {
    background: rgba(255, 255, 255, 0.05);
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
  }

  .history-item .views {
    font-size: 0.8rem;
    color: #999;
    min-width: 40px;
    text-align: right;
  }
</style>
