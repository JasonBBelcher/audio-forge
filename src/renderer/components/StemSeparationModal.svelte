<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';

  interface Asset {
    id: number;
    name: string;
    file_path: string;
    file_type?: string;
    file_size?: number;
  }

  export let asset: Asset | null = null;
  export let open: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
    stemsImported: { stems: Asset[] };
  }>();

  let model: 'htdemucs' | 'htdemucs_6s' | 'mdx_extra' = 'htdemucs';
  let separating = false;
  let progress = 0;
  let progressLabel = '';
  let error: string | null = null;

  const af = (window as any).audioforge;

  onDestroy(() => {
    // No subscriptions to clean up in this version (synchronous API)
  });

  async function handleSeparateStems(): Promise<void> {
    if (!asset) return;

    separating = true;
    error = null;
    progress = 0;
    progressLabel = 'Starting separation…';

    try {
      // Call the synchronous API
      const stemResult = await af.audio.separateStems(asset.file_path, { model });

      // Build array of stem file paths in order
      const stemPaths = [stemResult.vocals, stemResult.drums, stemResult.bass, stemResult.other];

      progressLabel = 'Importing stems to library…';
      progress = 50;

      // Import stems to library
      const importedStems: Asset[] = await af.files.import(stemPaths);

      progress = 100;
      progressLabel = 'Complete!';

      // Dispatch event with imported stems
      dispatch('stemsImported', { stems: importedStems });

      // Close modal after brief delay
      await new Promise(r => setTimeout(r, 500));
      dispatch('close');
    } catch (e: any) {
      error = e?.message || 'Stem separation failed';
    } finally {
      separating = false;
    }
  }

  function handleCancel(): void {
    dispatch('close');
  }

  function handleCloseModal(): void {
    dispatch('close');
  }
</script>

{#if open}
  <Modal title="Separate Stems" width="520px" on:close={handleCloseModal}>
    <div class="stem-separation">
      {#if !separating && !error}
        <!-- Source info -->
        <div class="source-info">
          <label for="source-display">Source:</label>
          <p id="source-display" class="source-name">{asset?.name ?? '(no asset selected)'}</p>
        </div>

        <!-- Model selection -->
        <div class="model-selection">
          <label for="model-select">Model:</label>
          <select id="model-select" bind:value={model} disabled={separating}>
            <option value="htdemucs">Demucs (4-stem: vocals, drums, bass, other)</option>
            <option value="htdemucs_6s">Demucs (6-stem: vocals, drums, bass, guitar, piano, other)</option>
            <option value="mdx_extra">MDX (4-stem, higher quality)</option>
          </select>
        </div>

        <!-- Expected output -->
        <div class="output-info">
          <label for="output-display">Output:</label>
          <p id="output-display" class="output-stems">
            {#if model === 'htdemucs' || model === 'mdx_extra'}
              4 stems: vocals, drums, bass, other
            {:else}
              6 stems: vocals, drums, bass, guitar, piano, other
            {/if}
          </p>
        </div>

        <!-- Action buttons -->
        <div class="actions">
          <Button variant="secondary" on:click={handleCancel} disabled={separating}>
            Cancel
          </Button>
          <Button variant="primary" on:click={handleSeparateStems} disabled={separating}>
            Separate Stems
          </Button>
        </div>
      {:else if separating}
        <!-- Progress state -->
        <div class="progress-section">
          <p class="progress-label">{progressLabel}</p>
          <div class="progress-bar-wrap">
            <div class="progress-bar" style={`width: ${progress}%`}></div>
          </div>
          <p class="progress-percent">{progress}%</p>
          <p class="progress-note">Separating audio may take several minutes…</p>
        </div>

        <!-- Cancel button during separation -->
        <div class="actions">
          <Button variant="secondary" on:click={handleCancel} disabled={separating}>
            Cancel
          </Button>
        </div>
      {:else if error}
        <!-- Error state -->
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <p class="error-message">{error}</p>
          {#if error.toLowerCase().includes('demucs')}
            <p class="install-hint">Install demucs: <code>pip install demucs</code></p>
          {/if}
          <div class="actions">
            <Button variant="secondary" on:click={handleCancel}>
              Close
            </Button>
            <Button variant="primary" on:click={handleSeparateStems}>
              Try Again
            </Button>
          </div>
        </div>
      {/if}
    </div>
  </Modal>
{/if}

<style>
  .stem-separation {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .source-info,
  .model-selection,
  .output-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.85rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .source-name {
    margin: 0;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #e0e0f0;
    font-size: 0.95rem;
    word-break: break-all;
  }

  select {
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: #e0e0f0;
    font-size: 0.9rem;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
  }

  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .output-stems {
    margin: 0;
    padding: 0.75rem;
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 6px;
    color: #a5b4fc;
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .progress-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem 0;
    text-align: center;
  }

  .progress-label {
    margin: 0;
    color: #e0e0f0;
    font-size: 0.95rem;
    font-weight: 500;
  }

  .progress-bar-wrap {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 99px;
    height: 12px;
    overflow: hidden;
    margin: 0.5rem 0;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 99px;
    transition: width 0.3s ease;
  }

  .progress-percent {
    margin: 0;
    font-size: 0.9rem;
    color: #a0a0b8;
    font-weight: 600;
  }

  .progress-note {
    margin: 0;
    font-size: 0.8rem;
    color: #505060;
  }

  .error-state {
    text-align: center;
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }

  .error-icon {
    font-size: 2rem;
  }

  .error-message {
    margin: 0;
    color: #ef4444;
    font-size: 0.9rem;
  }

  .install-hint {
    margin: 0;
    color: #a0a0b8;
    font-size: 0.85rem;
  }

  code {
    background: rgba(255, 255, 255, 0.08);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8rem;
  }
</style>
