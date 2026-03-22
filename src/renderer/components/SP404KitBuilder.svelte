<script lang="ts">
  import { onMount } from 'svelte';

  interface Asset {
    id: number;
    name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }

  let sdCardPath: string = '';
  let detectedSDCards: string[] = [];
  let pads: Record<string, Asset | null> = {};
  let showSamplePicker: boolean = false;
  let selectedPad: string | null = null;
  let assets: Asset[] = [];
  let filteredAssets: Asset[] = [];
  let searchQuery: string = '';
  let isExporting: boolean = false;
  let isDetecting: boolean = false;
  let exportMessage: { type: 'success' | 'error'; text: string } | null = null;
  let activeBank: string = 'A';

  const banks = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

  onMount(async () => {
    // Load SD card path from settings
    if ((window as any).audioforge?.settings?.get) {
      sdCardPath = (window as any).audioforge.settings.get('sp404.sdCardPath', '');
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

  function getAssignedPads(): Array<{ bank: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'; padNumber: number; asset: Asset }> {
    const assigned = [];
    for (const [key, asset] of Object.entries(pads)) {
      if (asset) {
        const [bank, padNum] = key.split('-');
        assigned.push({
          bank: bank as any,
          padNumber: parseInt(padNum),
          asset,
        });
      }
    }
    return assigned;
  }

  $: assignedCount = Object.values(pads).filter(Boolean).length;

  function handleConfirm(message: string): boolean {
    // Use confirm if available, fallback for tests
    if (typeof window !== 'undefined' && window.confirm) {
      return window.confirm(message);
    }
    return true;
  }

  async function handleDetectSDCards() {
    isDetecting = true;
    try {
      if ((window as any).audioforge?.sp404?.detectSDCards) {
        const cards = await (window as any).audioforge.sp404.detectSDCards();
        detectedSDCards = cards || [];
        if (detectedSDCards.length > 0) {
          sdCardPath = detectedSDCards[0];
          if ((window as any).audioforge?.settings?.set) {
            await (window as any).audioforge.settings.set('sp404.sdCardPath', sdCardPath);
          }
          exportMessage = {
            type: 'success',
            text: `Found ${detectedSDCards.length} SD card(s)`,
          };
        } else {
          exportMessage = {
            type: 'error',
            text: 'No SD cards with ROLAND directory detected',
          };
        }
      }
    } catch (error) {
      console.error('Failed to detect SD cards:', error);
      exportMessage = {
        type: 'error',
        text: `Detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    } finally {
      isDetecting = false;
    }
  }

  async function handleChangeSDCardPath() {
    try {
      if ((window as any).audioforge?.files?.showOpenDialog) {
        const result = await (window as any).audioforge.files.showOpenDialog({});
        if (result?.filePaths?.[0]) {
          const newPath = result.filePaths[0];
          sdCardPath = newPath;
          if ((window as any).audioforge?.settings?.set) {
            await (window as any).audioforge.settings.set('sp404.sdCardPath', newPath);
          }
        }
      }
    } catch (error) {
      console.error('Failed to change SD card path:', error);
    }
  }

  async function handleExport() {
    const assignedPads = getAssignedPads();

    // Validation
    if (assignedPads.length === 0) {
      exportMessage = { type: 'error', text: 'Please assign at least one sample' };
      return;
    }

    if (!sdCardPath) {
      exportMessage = { type: 'error', text: 'Please select an SD card path' };
      return;
    }

    if (!handleConfirm('This will write files to your SD card. Continue?')) {
      return;
    }

    isExporting = true;
    exportMessage = null;

    try {
      // Build kit structure: 10 banks × 16 pads
      const padsArray: (any | null)[][] = banks.map((bank) =>
        Array.from({ length: 16 }, (_, i) => {
          const key = getPadKey(bank, i + 1);
          const asset = pads[key];
          if (asset) {
            return {
              bank,
              padNumber: i + 1,
              filePath: asset.file_path,
            };
          }
          return null;
        })
      );

      const kit = {
        name: 'SP-404',
        pads: padsArray,
      };

      if ((window as any).audioforge?.sp404?.exportKit) {
        await (window as any).audioforge.sp404.exportKit(kit, sdCardPath);

        exportMessage = {
          type: 'success',
          text: `Kit exported successfully (${assignedPads.length} pads)`,
        };
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

<div class="sp404-kit-builder">
  <!-- Header -->
  <div class="header">
    <div class="header-title">SP-404 MK2 Kit Builder</div>
  </div>

  <!-- SD Card Selection -->
  <div class="sd-card-section">
    <label for="sd-card-input">SD Card Path</label>
    <div class="sd-card-controls">
      <input
        id="sd-card-input"
        type="text"
        placeholder="Select or detect SD card"
        value={sdCardPath}
        readonly
        class="sd-card-input"
      />
      <button
        class="detect-btn"
        onclick={handleDetectSDCards}
        disabled={isDetecting}
      >
        {isDetecting ? 'Detecting...' : 'Detect'}
      </button>
      <button
        class="browse-btn"
        onclick={handleChangeSDCardPath}
      >
        Browse
      </button>
    </div>
    {#if detectedSDCards.length > 0}
      <div class="detected-cards">
        <select
          value={sdCardPath}
          onchange={(e) => {
            sdCardPath = (e.target as HTMLSelectElement).value;
            if ((window as any).audioforge?.settings?.set) {
              (window as any).audioforge.settings.set('sp404.sdCardPath', sdCardPath);
            }
          }}
          class="sd-card-select"
        >
          {#each detectedSDCards as card}
            <option value={card}>{card}</option>
          {/each}
        </select>
      </div>
    {/if}
  </div>

  <!-- Messages -->
  {#if exportMessage}
    <div class={`message message-${exportMessage.type}`}>
      {exportMessage.text}
    </div>
  {/if}

  <!-- Bank Tabs -->
  <div class="bank-tabs">
    {#each banks as bank}
      <button
        class="bank-tab"
        class:active={activeBank === bank}
        onclick={() => activeBank = bank}
      >
        {bank}
      </button>
    {/each}
  </div>

  <!-- Pads Grid for Active Bank -->
  <div class="pads-section">
    <div class="bank-header">
      <h3>Bank {activeBank}</h3>
      <span class="assigned-count">{Object.values(pads).filter(p => p && pads[getPadKey(activeBank, Object.keys(pads).filter(k => k.startsWith(activeBank)).map(k => parseInt(k.split('-')[1])).length)]).length} pads assigned</span>
    </div>

    <div class="pads-grid">
      {#each Array.from({ length: 16 }, (_, i) => i + 1) as padNumber}
        {@const key = getPadKey(activeBank, padNumber)}
        {@const asset = pads[key]}
        <button
          class="pad"
          class:assigned={asset !== null}
          data-testid={`pad-${activeBank}-${padNumber}`}
          onclick={() => handlePadClick(activeBank, padNumber)}
          title={asset ? asset.name : `Bank ${activeBank} Pad ${padNumber}`}
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

  <!-- Action Buttons -->
  <div class="action-buttons">
    <button
      class="export-btn"
      onclick={handleExport}
      disabled={assignedCount === 0 || !sdCardPath || isExporting}
    >
      {isExporting ? 'Exporting...' : 'Export to SP-404'}
    </button>
    <button class="clear-all-btn" onclick={handleClearAll}>
      Clear All
    </button>
  </div>

  <!-- Sample Picker -->
  {#if showSamplePicker}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sample-picker-overlay" onclick={closeSamplePicker} role="dialog" aria-modal="true">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="sample-picker" onclick={(e) => e.stopPropagation()}>
        <div class="sample-picker-header">
          <h3>Select Sample for Bank {activeBank} Pad {selectedPad ? parseInt(selectedPad.split('-')[1]) : ''}</h3>
          <button class="close-btn" onclick={closeSamplePicker}>×</button>
        </div>

        <div class="sample-picker-search">
          <input
            type="text"
            placeholder="Search samples..."
            value={searchQuery}
            oninput={handleSearchChange}
            /* svelte-ignore a11y_autofocus */
            autofocus
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
  .sp404-kit-builder {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header-title {
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .sd-card-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .sd-card-section label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sd-card-controls {
    display: flex;
    gap: 8px;
  }

  .sd-card-input {
    flex: 1;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.7);
    font-size: 12px;
  }

  .detect-btn,
  .browse-btn {
    padding: 8px 12px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 4px;
    color: #64b5f6;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .detect-btn:hover:not(:disabled),
  .browse-btn:hover {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .detect-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .detected-cards {
    padding-top: 8px;
  }

  .sd-card-select {
    width: 100%;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
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

  .bank-tabs {
    display: flex;
    gap: 4px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    overflow-x: auto;
  }

  .bank-tab {
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .bank-tab:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
  }

  .bank-tab.active {
    background: rgba(100, 181, 246, 0.25);
    border-color: rgba(100, 181, 246, 0.6);
    color: #64b5f6;
  }

  .pads-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
  }

  .bank-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .bank-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
  }

  .assigned-count {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }

  .pads-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    flex: 1;
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

  .action-buttons {
    display: flex;
    gap: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
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
    flex: 1;
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
