<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import WaveformSparkline from './WaveformSparkline.svelte';
  import StemSeparationModal from './StemSeparationModal.svelte';

  interface Asset {
    id: number;
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
    bpm?: number;
    key?: string;
    duration?: number;
    tags?: string[];
    created_at?: string;
  }

  const dispatch = createEventDispatcher<{
    edit: { asset: Asset };
    preview: { filePath: string; fileName: string };
  }>();

  let assets: Asset[] = [];
  let filteredAssets: Asset[] = [];
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  let sortColumn: 'name' | 'bpm' | 'key' | 'duration' | 'file_type' | 'file_size' = 'name';
  let sortDir: 'asc' | 'desc' = 'asc';

  // Filters
  let filterTypes: Set<string> = new Set();
  let filterBpmMin = 0;
  let filterBpmMax = 300;
  let filterKey = '';

  // UI state
  let contextMenu: { asset: Asset; x: number; y: number } | null = null;
  let uniqueTypes: string[] = [];
  let uniqueKeys: string[] = [];

  // Waveform peaks cache
  let peaksCache = new Map<number, number[]>();

  // Analyze All state
  let analyzingAll = false;
  let analyzeProgress = 0;
  let analyzeJobId: string | null = null;
  let unsubscribers: Array<() => void> = [];

  // Stem Separation state
  let stemSeparationAsset: Asset | null = null;
  let showStemModal = false;

  function downsample(peaks: number[], target: number): number[] {
    if (peaks.length <= target) return peaks;
    const step = peaks.length / target;
    return Array.from({ length: target }, (_, i) => {
      const slice = peaks.slice(Math.floor(i * step), Math.floor((i + 1) * step));
      return slice.length ? Math.max(...slice.map(Math.abs)) : 0;
    });
  }

  async function loadPeaks(assetsToLoad: Asset[]): Promise<void> {
    for (let i = 0; i < assetsToLoad.length; i += 5) {
      const batch = assetsToLoad.slice(i, i + 5);
      await Promise.all(batch.map(async (asset) => {
        if (peaksCache.has(asset.id)) return;
        try {
          const af = (window as any).audioforge;
          const result = await af.audio?.analyzeWaveform(asset.file_path);
          // analyzeWaveform may return { peaks: number[] } or number[] — handle both
          const raw: number[] = Array.isArray(result) ? result : (result?.peaks ?? []);
          // Downsample to 80 points max
          peaksCache.set(asset.id, downsample(raw, 80));
          peaksCache = new Map(peaksCache); // trigger Svelte reactivity
        } catch (e) {
          // On error, store empty array
          peaksCache.set(asset.id, []);
          peaksCache = new Map(peaksCache);
        }
      }));
    }
  }

  onMount(async () => {
    loading = true;
    error = null;
    try {
      const af = (window as any).audioforge;
      if (!af?.files?.list) {
        error = 'AudioForge API not available';
        loading = false;
        return;
      }

      assets = await af.files.list();

      // Initialize filters with all types checked
      uniqueTypes = [...new Set(assets.map(a => a.file_type))].sort();
      filterTypes = new Set(uniqueTypes);

      // Collect unique keys
      uniqueKeys = [...new Set(assets.filter(a => a.key).map(a => a.key!))].sort();

      applyFiltersAndSearch();

      // Load waveform peaks in batches
      if (assets.length > 0) {
        await loadPeaks(assets);
      }

      // Subscribe to library:fileAdded event to auto-refresh when new files are imported
      if (af?.on) {
        const unsub = af.on('library:fileAdded', async () => {
          try {
            assets = await af.files.list();
            uniqueTypes = [...new Set(assets.map(a => a.file_type))].sort();
            filterTypes = new Set(uniqueTypes);
            uniqueKeys = [...new Set(assets.filter(a => a.key).map(a => a.key!))].sort();
            applyFiltersAndSearch();
            if (assets.length > 0) {
              await loadPeaks(assets);
            }
          } catch (e) {
            console.error('Failed to refresh assets on file added:', e);
          }
        });
        unsubscribers.push(unsub);
      }
    } catch (e: any) {
      error = e?.message || 'Failed to load assets';
    } finally {
      loading = false;
    }
  });

  function applyFiltersAndSearch(): void {
    let result = assets.filter(asset => {
      // Type filter
      if (!filterTypes.has(asset.file_type)) {
        return false;
      }

      // BPM filter (assets without BPM pass through)
      if (asset.bpm !== undefined && (asset.bpm < filterBpmMin || asset.bpm > filterBpmMax)) {
        return false;
      }

      // Key filter
      if (filterKey && asset.key !== filterKey) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        if (!asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
          return false;
        }
      }

      return true;
    });

    // Sort
    result.sort((a, b) => {
      let aVal: any = '';
      let bVal: any = '';

      switch (sortColumn) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'bpm':
          aVal = a.bpm ?? 0;
          bVal = b.bpm ?? 0;
          break;
        case 'key':
          aVal = a.key ?? '';
          bVal = b.key ?? '';
          break;
        case 'duration':
          aVal = a.duration ?? 0;
          bVal = b.duration ?? 0;
          break;
        case 'file_type':
          aVal = a.file_type.toLowerCase();
          bVal = b.file_type.toLowerCase();
          break;
        case 'file_size':
          aVal = a.file_size;
          bVal = b.file_size;
          break;
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    filteredAssets = result;
  }

  function handleSearchInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;

    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(() => {
      applyFiltersAndSearch();
    }, 300);
  }

  function handleColumnClick(col: typeof sortColumn): void {
    if (sortColumn === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = col;
      sortDir = 'asc';
    }
    applyFiltersAndSearch();
  }

  function handleTypeFilterChange(type: string): void {
    if (filterTypes.has(type)) {
      filterTypes.delete(type);
    } else {
      filterTypes.add(type);
    }
    filterTypes = filterTypes; // Trigger reactivity
    applyFiltersAndSearch();
  }

  function handleBpmRangeChange(): void {
    applyFiltersAndSearch();
  }

  function handleKeyFilterChange(e: Event): void {
    filterKey = (e.target as HTMLSelectElement).value;
    applyFiltersAndSearch();
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDuration(secs: number | undefined): string {
    if (!secs) return '-';
    const mins = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${mins}:${sec.toString().padStart(2, '0')}`;
  }

  function formatBpm(bpm: number | undefined): string {
    if (!bpm) return '-';
    return bpm.toString();
  }

  function formatKey(key: string | undefined): string {
    if (!key) return '-';
    return key;
  }

  function getSortArrow(col: typeof sortColumn): string {
    if (sortColumn !== col) return '';
    return sortDir === 'asc' ? '▲' : '▼';
  }

  function handleRowClick(asset: Asset): void {
    dispatch('edit', { asset });
  }

  function handlePlayClick(e: MouseEvent, asset: Asset): void {
    e.stopPropagation();
    dispatch('preview', { filePath: asset.file_path, fileName: asset.name });
  }

  function handleRowContextMenu(e: MouseEvent, asset: Asset): void {
    e.preventDefault();
    contextMenu = {
      asset,
      x: e.clientX,
      y: e.clientY,
    };
  }

  function closeContextMenu(): void {
    contextMenu = null;
  }

  async function handleAnalyzeBpmKey(): Promise<void> {
    if (!contextMenu) return;

    const asset = contextMenu.asset;
    try {
      const af = (window as any).audioforge;
      const bpm = await af.audio?.analyzeBPM(asset.file_path);
      const key = await af.audio?.analyzeKey(asset.file_path);

      // Update the asset inline
      const idx = assets.findIndex(a => a.id === asset.id);
      if (idx >= 0) {
        assets[idx].bpm = bpm || assets[idx].bpm;
        assets[idx].key = key || assets[idx].key;
        assets = assets; // Trigger reactivity
        applyFiltersAndSearch();
      }
    } catch (e) {
      console.error('Failed to analyze:', e);
    }

    closeContextMenu();
  }

  async function handleDelete(): Promise<void> {
    if (!contextMenu) return;

    const asset = contextMenu.asset;
    const confirmed = confirm(`Delete "${asset.name}"?`);
    if (!confirmed) {
      closeContextMenu();
      return;
    }

    try {
      const af = (window as any).audioforge;
      await af.files?.deleteAsset?.(asset.id);

      assets = assets.filter(a => a.id !== asset.id);
      applyFiltersAndSearch();
    } catch (e) {
      console.error('Failed to delete:', e);
    }

    closeContextMenu();
  }

  function handleRevealInFinder(): void {
    if (!contextMenu) return;

    const asset = contextMenu.asset;
    const af = (window as any).audioforge;
    af.files?.revealInFinder?.(asset.file_path).catch((e: any) => {
      console.error('Failed to reveal in finder:', e);
    });

    closeContextMenu();
  }

  function dispatchEditEvent(): void {
    if (!contextMenu) return;

    handleRowClick(contextMenu.asset);
    closeContextMenu();
  }

  function handleSeparateStems(): void {
    if (!contextMenu) return;

    stemSeparationAsset = contextMenu.asset;
    showStemModal = true;
    closeContextMenu();
  }

  async function handleStemsImported(event: CustomEvent<{ stems: Asset[] }>): Promise<void> {
    // Reload assets to show newly imported stems
    try {
      const af = (window as any).audioforge;
      assets = await af.files.list();
      applyFiltersAndSearch();
      await loadPeaks(assets);
    } catch (e) {
      console.error('Failed to reload assets after stem import:', e);
    }

    showStemModal = false;
    stemSeparationAsset = null;
  }

  // Calculate unanalyzed count (missing BPM or Key)
  $: unanalyzedCount = assets ? assets.filter(a => !a.bpm || !a.key).length : 0;

  async function handleAnalyzeAll(): Promise<void> {
    if (analyzingAll) return;

    try {
      analyzingAll = true;
      analyzeProgress = 0;

      const af = (window as any).audioforge;
      const result = await af.files?.analyzeAll?.();

      if (!result?.jobId) {
        throw new Error('Failed to start analysis job');
      }

      analyzeJobId = result.jobId;

      // Subscribe to progress updates
      if (af?.on) {
        const unsubProgress = af.on('job:progress', (data: any) => {
          if (data.jobId === analyzeJobId && data.progress !== undefined) {
            analyzeProgress = data.progress;
          }
        });

        const unsubComplete = af.on('job:complete', (data: any) => {
          if (data.jobId === analyzeJobId) {
            handleAnalyzeAllComplete();
          }
        });

        const unsubFailed = af.on('job:failed', (data: any) => {
          if (data.jobId === analyzeJobId) {
            handleAnalyzeAllFailed();
          }
        });

        unsubscribers.push(unsubProgress, unsubComplete, unsubFailed);
      }
    } catch (e) {
      console.error('Failed to start analyze all:', e);
      analyzingAll = false;
      analyzeJobId = null;
    }
  }

  async function handleAnalyzeAllComplete(): Promise<void> {
    // Refresh asset list to show newly populated metadata
    try {
      const af = (window as any).audioforge;
      assets = await af.files.list();
      applyFiltersAndSearch();

      // Reload peaks for assets that now have them
      if (assets.length > 0) {
        await loadPeaks(assets);
      }
    } catch (e) {
      console.error('Failed to refresh assets after analysis:', e);
    } finally {
      analyzingAll = false;
      analyzeProgress = 0;
      analyzeJobId = null;
      // Clean up subscriptions
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];
    }
  }

  function handleAnalyzeAllFailed(): void {
    analyzingAll = false;
    analyzeProgress = 0;
    analyzeJobId = null;
    // Clean up subscriptions
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
  }

  onDestroy(() => {
    // Clean up any remaining subscriptions
    unsubscribers.forEach(unsub => unsub());
  });
</script>

<svelte:window onclick={closeContextMenu} />

<div class="library-view">
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="search-box">
      <span class="search-icon">#</span>
      <input
        type="text"
        placeholder="Search assets..."
        value={searchQuery}
        oninput={handleSearchInput}
      />
    </div>

    <div class="toolbar-buttons">
      <button class="import-btn">Import</button>
      <button class="analyze-btn" disabled={analyzingAll} onclick={handleAnalyzeAll}>
        {#if analyzingAll}
          <span class="analyzing-spinner"></span>
          Analyzing... {analyzeProgress}%
        {:else if unanalyzedCount > 0}
          Analyze All ({unanalyzedCount})
        {:else}
          Analyze All ✓
        {/if}
      </button>
    </div>
  </div>

  <div class="main-content">
    <!-- Filter Sidebar -->
    <div class="sidebar">
      <div class="filter-section">
        <h3>FILTER</h3>
      </div>

      <div class="filter-section">
        <div class="filter-title">Type</div>
        {#each uniqueTypes as type}
          <label class="checkbox-label">
            <input
              type="checkbox"
              value={type}
              checked={filterTypes.has(type)}
              onchange={() => handleTypeFilterChange(type)}
            />
            <span>{type.toUpperCase()}</span>
          </label>
        {/each}
      </div>

      <div class="filter-section">
        <div class="filter-title">BPM Range</div>
        <div class="bpm-range">
          <input
            type="number"
            min="0"
            max="300"
            bind:value={filterBpmMin}
            onchange={handleBpmRangeChange}
          />
          <span class="bpm-dash">-</span>
          <input
            type="number"
            min="0"
            max="300"
            bind:value={filterBpmMax}
            onchange={handleBpmRangeChange}
          />
        </div>
      </div>

      <div class="filter-section">
        <div class="filter-title">Key</div>
        <select value={filterKey} onchange={handleKeyFilterChange}>
          <option value="">All</option>
          {#each uniqueKeys as key}
            <option value={key}>{key}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      {#if loading}
        <div class="loading">Loading assets...</div>
      {:else if error}
        <div class="error">Error: {error}</div>
      {:else if filteredAssets.length === 0}
        <div class="empty-state">
          {#if assets.length === 0}
            <p>No assets imported yet</p>
          {:else}
            <p>No assets match your filters</p>
          {/if}
        </div>
      {:else}
        <table>
          <thead>
            <tr>
              <th class="col-name" role="columnheader" onclick={() => handleColumnClick('name')}>
                Name {getSortArrow('name')}
              </th>
              <th class="col-waveform">Waveform</th>
              <th class="col-bpm" role="columnheader" onclick={() => handleColumnClick('bpm')}>
                BPM {getSortArrow('bpm')}
              </th>
              <th class="col-key" role="columnheader" onclick={() => handleColumnClick('key')}>
                Key {getSortArrow('key')}
              </th>
              <th class="col-duration" role="columnheader" onclick={() => handleColumnClick('duration')}>
                Duration {getSortArrow('duration')}
              </th>
              <th class="col-type" role="columnheader" onclick={() => handleColumnClick('file_type')}>
                Type {getSortArrow('file_type')}
              </th>
              <th class="col-size" role="columnheader" onclick={() => handleColumnClick('file_size')}>
                Size {getSortArrow('file_size')}
              </th>
            </tr>
          </thead>
          <tbody>
            {#each filteredAssets as asset (asset.id)}
              <tr oncontextmenu={(e) => handleRowContextMenu(e, asset)}>
                <td class="col-name">
                  <button class="play-btn" type="button" onclick={(e) => handlePlayClick(e, asset)} aria-label="Preview {asset.name}">▶</button>
                  <button class="asset-name" type="button" onclick={() => handleRowClick(asset)}>{asset.name}</button>
                </td>
                <td class="col-waveform">
                  <WaveformSparkline peaks={peaksCache.get(asset.id) ?? []} width={80} height={24} />
                </td>
                <td class="col-bpm">{formatBpm(asset.bpm)}</td>
                <td class="col-key">{formatKey(asset.key)}</td>
                <td class="col-duration">{formatDuration(asset.duration)}</td>
                <td class="col-type">
                  <span class="type-badge">{asset.file_type}</span>
                </td>
                <td class="col-size">{formatSize(asset.file_size)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>

  <!-- Context Menu -->
  {#if contextMenu}
    <div class="context-menu" style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px;`} role="menu">
      <button role="menuitem" onclick={dispatchEditEvent}>Edit in Wave Editor</button>
      <button role="menuitem" onclick={handleAnalyzeBpmKey}>Analyze BPM+Key</button>
      <button role="menuitem" onclick={handleRevealInFinder}>Reveal in Finder</button>
      <button role="menuitem" onclick={handleSeparateStems}>Separate Stems</button>
      <hr />
      <button role="menuitem" class="delete-option" onclick={handleDelete}>Delete</button>
    </div>
  {/if}

  <!-- Stem Separation Modal -->
  <StemSeparationModal
    asset={stemSeparationAsset}
    open={showStemModal}
    on:close={() => { showStemModal = false; stemSeparationAsset = null; }}
    on:stemsImported={handleStemsImported}
  />
</div>

<style>
  .library-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: rgba(255, 255, 255, 0.02);
    color: rgba(255, 255, 255, 0.9);
    overflow: hidden;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .search-box {
    flex: 1;
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 12px;
    gap: 8px;
  }

  .search-icon {
    font-size: 14px;
    opacity: 0.6;
  }

  .search-box input {
    flex: 1;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    outline: none;
  }

  .search-box input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .toolbar-buttons {
    display: flex;
    gap: 8px;
  }

  .import-btn,
  .analyze-btn {
    padding: 6px 12px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 4px;
    color: #64b5f6;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .import-btn:hover,
  .analyze-btn:hover {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .import-btn:disabled,
  .analyze-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .analyzing-spinner {
    display: inline-block;
    width: 10px;
    height: 10px;
    border: 1.5px solid rgba(100, 181, 246, 0.3);
    border-top-color: #64b5f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-right: 4px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 12px;
    padding: 12px;
  }

  .sidebar {
    width: 150px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 12px;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .filter-section {
    margin-bottom: 16px;
  }

  .filter-section h3 {
    margin: 0 0 8px 0;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: rgba(255, 255, 255, 0.5);
  }

  .filter-title {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    margin-bottom: 6px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
    cursor: pointer;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }

  .bpm-range {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .bpm-range input {
    width: 40px;
    padding: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 10px;
  }

  .bpm-dash {
    color: rgba(255, 255, 255, 0.5);
    font-size: 11px;
  }

  .sidebar select {
    width: 100%;
    padding: 4px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 10px;
  }

  .table-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    overflow: hidden;
  }

  .loading,
  .error,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .error {
    color: #ff6b6b;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  thead {
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    position: sticky;
    top: 0;
  }

  th {
    padding: 10px 12px;
    text-align: left;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 600;
    user-select: none;
    cursor: pointer;
    white-space: nowrap;
  }

  th:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  tbody {
    overflow-y: auto;
  }

  tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background-color 0.15s ease;
  }

  tbody tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  td {
    padding: 8px 12px;
    color: rgba(255, 255, 255, 0.8);
  }

  .col-name {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    flex: 1;
    min-width: 200px;
  }

  .play-btn {
    font-size: 10px;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .col-name:hover .play-btn {
    opacity: 1;
  }

  .asset-name {
    word-break: break-all;
  }

  .col-waveform {
    width: 100px;
    text-align: center;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .col-bpm,
  .col-key,
  .col-duration {
    width: 80px;
    text-align: center;
  }

  .col-type {
    width: 70px;
  }

  .col-size {
    width: 80px;
    text-align: right;
  }

  .type-badge {
    display: inline-block;
    padding: 2px 6px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 3px;
    color: #64b5f6;
    font-weight: 500;
    font-size: 10px;
    text-transform: uppercase;
  }

  .context-menu {
    position: fixed;
    background: #2d2d44;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    min-width: 180px;
    overflow: hidden;
  }

  .context-menu button {
    display: block;
    width: 100%;
    padding: 8px 12px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.8);
    text-align: left;
    cursor: pointer;
    font-size: 11px;
    transition: background-color 0.15s ease;
  }

  .context-menu button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .context-menu button.delete-option {
    color: #ff6b6b;
  }

  .context-menu button.delete-option:hover {
    background: rgba(255, 107, 107, 0.2);
  }

  .context-menu hr {
    margin: 4px 0;
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
