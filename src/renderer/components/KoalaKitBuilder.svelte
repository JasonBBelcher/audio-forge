<script lang="ts">
  import { onMount } from 'svelte';

  interface Asset {
    id: number;
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }

  let kitName: string = '';
  let bpm: number | undefined = undefined;
  let syncFolder: string = '';
  let pads: Record<string, Asset | null> = {};
  let showSamplePicker: boolean = false;
  let selectedPad: string | null = null;
  let assets: Asset[] = [];
  let filteredAssets: Asset[] = [];
  let searchQuery: string = '';
  let isExporting: boolean = false;
  let exportMessage: { type: 'success' | 'error'; text: string } | null = null;

  const banks = ['A', 'B', 'C', 'D'];

  onMount(async () => {
    // Load sync folder from settings
    if ((window as any).audioforge?.settings?.get) {
      syncFolder = await (window as any).audioforge.settings.get('koala.syncFolder') ?? '';
    }

    // Initialize pads
    initializePads();

    // Load assets
    await loadAssets();
  });

  function initializePads() {
    const initial: Record<string, Asset | null> = {};
    for (const bank of banks) {
      for (let i = 1; i <= 16; i++) {
        initial[`${bank}-${i}`] = null;
      }
    }
    pads = initial;
  }

  async function loadAssets() {
    try {
      if ((window as any).audioforge?.assets?.list) {
        assets = await (window as any).audioforge.assets.list();
        filteredAssets = assets;
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
      assets = [];
      filteredAssets = [];
    }
  }

  function getPadKey(bank: string, padNumber: number): string {
    return `${bank}-${padNumber}`;
  }

  function handlePadClick(bank: string, padNumber: number) {
    const key = getPadKey(bank, padNumber);
    const current = pads[key];

    if (current) {
      // Show clear option
      showClearDialog(key);
    } else {
      // Open sample picker
      selectedPad = key;
      showSamplePicker = true;
      searchQuery = '';
      filteredAssets = assets;
    }
  }

  function showClearDialog(key: string) {
    if (handleConfirm('Clear this pad?')) {
      pads = { ...pads, [key]: null };
    }
  }

  function handleSearchChange(e: Event) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;

    if (!searchQuery.trim()) {
      filteredAssets = assets;
    } else {
      filteredAssets = assets.filter(a =>
        a.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
  }

  function selectAsset(asset: Asset) {
    if (selectedPad) {
      pads = { ...pads, [selectedPad]: asset };
    }
    closeSamplePicker();
  }

  function closeSamplePicker() {
    showSamplePicker = false;
    selectedPad = null;
    searchQuery = '';
  }

  function handleClearAll() {
    if (handleConfirm('Clear all pad assignments?')) {
      const cleared: Record<string, Asset | null> = {};
      for (const key of Object.keys(pads)) {
        cleared[key] = null;
      }
      pads = cleared;
    }
  }

  function getAssignedPads(): Array<{ bank: 'A' | 'B' | 'C' | 'D'; padNumber: number; asset: Asset }> {
    const assigned = [];
    for (const [key, asset] of Object.entries(pads)) {
      if (asset) {
        const [bank, padNum] = key.split('-');
        assigned.push({
          bank: bank as 'A' | 'B' | 'C' | 'D',
          padNumber: parseInt(padNum),
          asset,
        });
      }
    }
    return assigned;
  }

  $: assignedCount = Object.values(pads).filter(Boolean).length;

  async function handleChangeSyncFolder() {
    try {
      if ((window as any).audioforge?.files?.showOpenDialog) {
        const result = await (window as any).audioforge.files.showOpenDialog({});
        if (result?.filePaths?.[0]) {
          const newPath = result.filePaths[0];
          syncFolder = newPath;
          if ((window as any).audioforge?.settings?.set) {
            await (window as any).audioforge.settings.set('koala.syncFolder', newPath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to change sync folder:', error);
    }
  }

  function handleConfirm(message: string): boolean {
    // Use confirm if available, fallback for tests
    if (typeof window !== 'undefined' && window.confirm) {
      return window.confirm(message);
    }
    return true;
  }

  async function handleExport() {
    const assignedPads = getAssignedPads();

    // Validation
    if (!kitName.trim()) {
      exportMessage = { type: 'error', text: 'Please enter a kit name' };
      return;
    }

    if (assignedPads.length === 0) {
      exportMessage = { type: 'error', text: 'Please assign at least one sample' };
      return;
    }

    if (!syncFolder) {
      exportMessage = { type: 'error', text: 'Please set a sync folder' };
      return;
    }

    isExporting = true;
    exportMessage = null;

    try {
      const kit = {
        name: kitName,
        bpm: bpm && bpm > 0 ? bpm : undefined,
        pads: assignedPads.map(p => ({
          bank: p.bank,
          pad: p.padNumber,
          samplePath: p.asset.file_path,
        })),
      };

      if ((window as any).audioforge?.koala?.exportKit) {
        const result = await (window as any).audioforge.koala.exportKit(kit, syncFolder);

        if (result?.success) {
          exportMessage = {
            type: 'success',
            text: `Kit exported to ${result.path} (${assignedPads.length} pads)`,
          };
        } else {
          throw new Error(result?.error || 'Export failed');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      exportMessage = {
        type: 'error',
        text: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    } finally {
      isExporting = false;
    }
  }

</script>

<div class="koala-kit-builder">
  <!-- Header -->
  <div class="header">
    <div class="header-inputs">
      <input
        type="text"
        placeholder="My Kit"
        value={kitName}
        oninput={(e) => kitName = (e.target as HTMLInputElement).value}
        onchange={(e) => kitName = (e.target as HTMLInputElement).value}
        class="kit-name-input"
      />
      <input
        type="number"
        placeholder="120"
        value={bpm}
        oninput={(e) => { const v = (e.target as HTMLInputElement).valueAsNumber; bpm = isNaN(v) ? undefined : v; }}
        onchange={(e) => { const v = (e.target as HTMLInputElement).valueAsNumber; bpm = isNaN(v) ? undefined : v; }}
        class="bpm-input"
        min="1"
      />
    </div>
    <div class="header-buttons">
      <button
        class="export-btn"
        onclick={handleExport}
        disabled={!kitName.trim() || assignedCount === 0 || isExporting}
      >
        {isExporting ? 'Exporting...' : 'Export'}
      </button>
      <button class="clear-all-btn" onclick={handleClearAll}>
        Clear All
      </button>
    </div>
  </div>

  <!-- Sync Folder Display -->
  <div class="sync-folder">
    <label for="sync-folder-display">Sync Folder</label>
    <div class="sync-folder-content">
      <span id="sync-folder-display" class="folder-path">
        {syncFolder || 'Not set'}
      </span>
      <button class="change-btn" onclick={handleChangeSyncFolder}>
        Change
      </button>
    </div>
  </div>

  <!-- Messages -->
  {#if exportMessage}
    <div class={`message message-${exportMessage.type}`}>
      {exportMessage.text}
    </div>
  {/if}

  <!-- Pad Grid -->
  <div class="pad-grid">
    {#each banks as bank}
      <div class="bank-section">
        <h3 class="bank-label">Bank {bank}</h3>
        <div class="pads-container">
          {#each Array.from({ length: 16 }, (_, i) => i + 1) as padNumber}
            {@const key = getPadKey(bank, padNumber)}
            {@const asset = pads[key]}
            <button
              class="pad"
              class:assigned={asset !== null}
              data-testid={`pad-${bank}-${padNumber}`}
              onclick={() => handlePadClick(bank, padNumber)}
              title={asset ? asset.name : `Bank ${bank} Pad ${padNumber}`}
            >
              {#if asset}
                <div class="pad-content">
                  <span class="pad-sample-name">{asset.name}</span>
                </div>
              {:else}
                <div class="pad-content">
                  <span class="pad-number">{padNumber}</span>
                </div>
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/each}
  </div>

  <!-- Sample Picker -->
  {#if showSamplePicker}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sample-picker-overlay" onclick={closeSamplePicker} role="dialog" aria-modal="true" tabindex="-1">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sample-picker" onclick={(e) => e.stopPropagation()}>
        <div class="sample-picker-header">
          <h3>Select Sample</h3>
          <button class="close-btn" onclick={closeSamplePicker}>×</button>
        </div>

        <div class="sample-picker-search">
          <input
            type="text"
            placeholder="Search samples..."
            value={searchQuery}
            oninput={handleSearchChange}
          />
        </div>

        <div class="sample-picker-list">
          {#if filteredAssets.length === 0}
            <div class="no-assets">No samples found</div>
          {:else}
            {#each filteredAssets as asset (asset.id)}
              <button
                class="sample-item"
                onclick={() => selectAsset(asset)}
              >
                <div class="sample-info">
                  <span class="sample-name">{asset.name}</span>
                  <span class="sample-meta">{asset.file_type}</span>
                </div>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .koala-kit-builder {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .header-inputs {
    display: flex;
    gap: 12px;
    flex: 1;
  }

  .kit-name-input,
  .bpm-input {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
  }

  .kit-name-input {
    flex: 1;
    min-width: 200px;
  }

  .bpm-input {
    width: 120px;
  }

  .kit-name-input::placeholder,
  .bpm-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .kit-name-input:focus,
  .bpm-input:focus {
    outline: none;
    border-color: #64b5f6;
    background: rgba(255, 255, 255, 0.08);
  }

  .header-buttons {
    display: flex;
    gap: 8px;
  }

  .export-btn,
  .clear-all-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .export-btn {
    background: #64b5f6;
    color: #000;
  }

  .export-btn:hover:not(:disabled) {
    background: #42a5f5;
  }

  .export-btn:disabled {
    background: rgba(100, 181, 246, 0.4);
    color: rgba(0, 0, 0, 0.5);
    cursor: not-allowed;
  }

  .clear-all-btn {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.4);
  }

  .clear-all-btn:hover {
    background: rgba(244, 67, 54, 0.3);
    border-color: rgba(244, 67, 54, 0.6);
  }

  .sync-folder {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .sync-folder label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sync-folder-content {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .folder-path {
    flex: 1;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    word-break: break-all;
  }

  .change-btn {
    padding: 4px 8px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 2px;
    color: #64b5f6;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .change-btn:hover {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .message {
    padding: 12px;
    border-radius: 4px;
    font-size: 12px;
    animation: slideIn 0.3s ease;
  }

  .message-success {
    background: rgba(76, 175, 80, 0.2);
    border: 1px solid rgba(76, 175, 80, 0.4);
    color: #4caf50;
  }

  .message-error {
    background: rgba(244, 67, 54, 0.2);
    border: 1px solid rgba(244, 67, 54, 0.4);
    color: #f44336;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .pad-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    flex: 1;
    overflow-y: auto;
  }

  .bank-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .bank-label {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
  }

  .pads-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
  }

  .pad {
    aspect-ratio: 1;
    padding: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 2px dashed rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pad:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.4);
    color: rgba(255, 255, 255, 0.9);
  }

  .pad.assigned {
    background: rgba(100, 181, 246, 0.15);
    border: 2px solid rgba(100, 181, 246, 0.4);
    color: #64b5f6;
  }

  .pad.assigned:hover {
    background: rgba(100, 181, 246, 0.25);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .pad-content {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    text-align: center;
    word-break: break-word;
  }

  .pad-number {
    font-size: 12px;
  }

  .pad-sample-name {
    font-size: 9px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .sample-picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .sample-picker {
    background: rgba(30, 30, 46, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow: hidden;
  }

  .sample-picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sample-picker-header h3 {
    margin: 0;
    font-size: 16px;
    color: rgba(255, 255, 255, 0.9);
  }

  .close-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 20px;
    cursor: pointer;
    transition: color 0.2s ease;
  }

  .close-btn:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .sample-picker-search {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .sample-picker-search input {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
  }

  .sample-picker-search input::placeholder {
    color: rgba(255, 255, 255, 0.4);
  }

  .sample-picker-search input:focus {
    outline: none;
    border-color: #64b5f6;
    background: rgba(255, 255, 255, 0.08);
  }

  .sample-picker-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .no-assets {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }

  .sample-item {
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
    display: flex;
    align-items: center;
  }

  .sample-item:hover {
    background: rgba(100, 181, 246, 0.15);
  }

  .sample-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }

  .sample-name {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    word-break: break-word;
  }

  .sample-meta {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
