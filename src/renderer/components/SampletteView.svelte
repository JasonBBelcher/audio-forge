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
  let currentTime = 0;
  let duration = 0;
  let isPlaying = false;
  let volume = 1;
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
      <label>Genre:</label>
      <select bind:value={selectedGenres[0]}>
        <option value="">Any</option>
        {#each genres as genre}
          <option value={genre}>{genre}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <label>Max Views:</label>
      <select bind:value={maxViews}>
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

  <!-- Now Playing -->
  {#if currentTrack}
    <div class="now-playing">
      <div class="track-info">
        <div class="thumbnail-container">
          {#if currentTrack.thumbnail_url}
            <img src={currentTrack.thumbnail_url} alt="thumbnail" class="thumbnail" />
          {:else}
            <div class="thumbnail-placeholder">🎵</div>
          {/if}
        </div>

        <div class="info">
          <h2>{currentTrack.title}</h2>
          <p class="artist">{currentTrack.uploader || 'Unknown Artist'}</p>
          <p class="stats">
            {formatDuration(currentTrack.duration)} •
            {formatViews(currentTrack.view_count)} views •
            {currentTrack.upload_date || '?'}
          </p>

          <div class="metadata">
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

          {#if currentTrack.description}
            <p class="description">{currentTrack.description.substring(0, 200)}...</p>
          {/if}
        </div>
      </div>

      <!-- Player Controls -->
      <div class="player-controls">
        <div class="playback-bar">
          <span class="time">{formatDuration(currentTime)}</span>
          <div class="progress-container">
            <div
              class="progress-bar"
              style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
            />
          </div>
          <span class="time">{formatDuration(duration)}</span>
        </div>

        <div class="buttons">
          <Button variant="primary" on:click={handleRollDice} disabled={phase === 'rolling'}>
            {phase === 'rolling' ? 'Rolling...' : '🎲 Roll Dice'}
          </Button>

          <button
            on:click={handleToggleFavorite}
            class="icon-btn"
            title={currentTrack.is_favorite ? 'Remove favorite' : 'Add to favorites'}
          >
            {currentTrack.is_favorite ? '⭐' : '☆'}
          </button>

          <Button variant="secondary" on:click={handleImportCurrent} disabled={phase === 'importing'}>
            {phase === 'importing' ? 'Importing...' : '⬇️ Import to Library'}
          </Button>
        </div>

        <div class="volume-control">
          <label>🔊</label>
          <input type="range" min="0" max="1" step="0.1" bind:value={volume} />
          <span>{Math.round(volume * 100)}%</span>
        </div>
      </div>
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
        <div
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
        </div>
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

  .now-playing {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .track-info {
    display: flex;
    gap: 1.5rem;
  }

  .thumbnail-container {
    flex-shrink: 0;
  }

  .thumbnail,
  .thumbnail-placeholder {
    width: 120px;
    height: 120px;
    border-radius: 8px;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    background: rgba(0, 0, 0, 0.3);
  }

  .info {
    flex: 1;
  }

  .info h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.3rem;
  }

  .artist {
    margin: 0 0 0.3rem 0;
    color: #aaa;
  }

  .stats {
    margin: 0 0 0.8rem 0;
    font-size: 0.85rem;
    color: #999;
  }

  .metadata {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.8rem;
  }

  .tag {
    background: rgba(100, 150, 255, 0.2);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .description {
    margin: 0;
    font-size: 0.85rem;
    color: #bbb;
    line-height: 1.4;
  }

  .player-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .playback-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .time {
    font-size: 0.8rem;
    color: #999;
    min-width: 40px;
  }

  .progress-container {
    flex: 1;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    cursor: pointer;
  }

  .progress-bar {
    height: 100%;
    background: #6496ff;
    transition: width 0.1s linear;
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

  .volume-control {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .volume-control input {
    width: 120px;
  }

  .volume-control span {
    min-width: 35px;
    text-align: right;
    font-size: 0.85rem;
    color: #999;
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
