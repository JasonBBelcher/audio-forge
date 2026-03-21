<script lang="ts">
  import { onMount } from 'svelte';
  import KoalaKitBuilder from './KoalaKitBuilder.svelte';

  let kits: string[] = [];
  let syncFolder: string = '';
  let isLoadingKits: boolean = true;

  onMount(async () => {
    await loadKitsAndFolder();
  });

  async function loadKitsAndFolder() {
    isLoadingKits = true;
    try {
      if ((window as any).audioforge?.settings?.get) {
        syncFolder = (window as any).audioforge.settings.get('koala.syncFolder', '');
      }

      if (syncFolder && (window as any).audioforge?.koala?.listKits) {
        kits = await (window as any).audioforge.koala.listKits(syncFolder);
      }
    } catch (error) {
      console.error('Failed to load kits:', error);
      kits = [];
    } finally {
      isLoadingKits = false;
    }
  }

  async function handleRefresh() {
    await loadKitsAndFolder();
  }

  async function handleDeleteKit(kitName: string) {
    if (!confirm(`Delete kit "${kitName}"?`)) {
      return;
    }

    try {
      if ((window as any).audioforge?.koala?.deleteKit) {
        await (window as any).audioforge.koala.deleteKit(kitName, syncFolder);
        await loadKitsAndFolder();
      }
    } catch (error) {
      console.error('Failed to delete kit:', error);
    }
  }
</script>

<div class="koala-view">
  <header class="koala-header">
    <h1>Koala Sampler</h1>
  </header>

  <div class="koala-content">
    <!-- Existing Kits Panel -->
    {#if syncFolder}
      <aside class="kits-panel">
        <div class="panel-header">
          <h2>Kits</h2>
          <button class="refresh-btn" onclick={handleRefresh} title="Refresh kits list">
            ↻
          </button>
        </div>

        {#if isLoadingKits}
          <div class="loading">Loading kits...</div>
        {:else if kits.length === 0}
          <div class="empty">No kits yet</div>
        {:else}
          <div class="kits-list">
            {#each kits as kit (kit)}
              <div class="kit-item">
                <span class="kit-name">{kit}</span>
                <button
                  class="delete-kit-btn"
                  onclick={() => handleDeleteKit(kit)}
                  title="Delete kit"
                >
                  ×
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </aside>
    {/if}

    <!-- Kit Builder -->
    <main class="builder-section">
      <KoalaKitBuilder />
    </main>
  </div>
</div>

<style>
  .koala-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
    color: #e0e0f0;
  }

  .koala-header {
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(0, 0, 0, 0.3);
  }

  .koala-header h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .koala-content {
    flex: 1;
    display: grid;
    grid-template-columns: auto 1fr;
    overflow: hidden;
  }

  .kits-panel {
    width: 280px;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .panel-header h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
  }

  .refresh-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 2px;
    color: #64b5f6;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-btn:hover {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.5);
  }

  .loading,
  .empty {
    padding: 16px;
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 12px;
  }

  .kits-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
  }

  .kit-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .kit-item:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  .kit-name {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    word-break: break-word;
    flex: 1;
  }

  .delete-kit-btn {
    width: 20px;
    height: 20px;
    padding: 0;
    background: rgba(244, 67, 54, 0.2);
    border: 1px solid rgba(244, 67, 54, 0.4);
    border-radius: 2px;
    color: #f44336;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-left: 8px;
  }

  .delete-kit-btn:hover {
    background: rgba(244, 67, 54, 0.3);
    border-color: rgba(244, 67, 54, 0.6);
  }

  .builder-section {
    flex: 1;
    overflow: hidden;
  }

  @media (max-width: 1024px) {
    .koala-content {
      grid-template-columns: 1fr;
    }

    .kits-panel {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      max-height: 200px;
    }
  }
</style>
