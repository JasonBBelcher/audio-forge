<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './ui/Button.svelte';

  interface LoopPoint {
    startSec: number;
    endSec: number;
    durationSec: number;
    confidence: number;
    bpm?: number;
  }

  export let filePath: string;

  let bpm: number | undefined = 120;
  let loops: LoopPoint[] = [];
  let selectedLoopIdx: number = 0;
  let isDetecting: boolean = false;
  let isExtracting: boolean = false;
  let error: string = '';

  async function detectLoops() {
    if (!filePath) {
      error = 'No file selected';
      return;
    }

    isDetecting = true;
    error = '';

    try {
      const result = await (window as any).audioforge?.loop?.detect(filePath, bpm);
      if (result) {
        loops = result.loops;
        bpm = result.suggestedBpm;
        selectedLoopIdx = 0;
      }
    } catch (e) {
      error = `Detection failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
    } finally {
      isDetecting = false;
    }
  }

  async function extractSelectedLoop() {
    if (loops.length === 0) {
      error = 'No loops detected';
      return;
    }

    const loop = loops[selectedLoopIdx];
    if (!loop) {
      error = 'No loop selected';
      return;
    }

    isExtracting = true;
    error = '';

    try {
      const result = await (window as any).audioforge?.loop?.extract(filePath, loop);
      if (result) {
        console.log('Loop extracted to:', result);
        error = '';
      }
    } catch (e) {
      error = `Extraction failed: ${e instanceof Error ? e.message : 'Unknown error'}`;
    } finally {
      isExtracting = false;
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs}`;
  }

  onMount(() => {
    // Auto-detect BPM on mount if needed
  });
</script>

<div class="loop-detector-panel">
  <h3>Loop Detection</h3>

  <div class="controls">
    <div class="bpm-input">
      <label for="bpm">BPM:</label>
      <input
        id="bpm"
        type="number"
        bind:value={bpm}
        min="40"
        max="200"
        disabled={isDetecting}
      />
      <span class="hint">(auto-detected)</span>
    </div>
    <Button on:click={detectLoops} disabled={isDetecting}>
      {isDetecting ? 'Detecting...' : 'Detect'}
    </Button>
  </div>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if loops.length > 0}
    <div class="candidates">
      <p class="label">Candidates:</p>
      {#each loops as loop, idx (idx)}
        <div class="candidate-row">
          <input
            type="radio"
            name="loop-select"
            value={idx}
            bind:group={selectedLoopIdx}
            id="loop-{idx}"
          />
          <label for="loop-{idx}" class="candidate-label">
            <span class="size">
              {#if loop.durationSec === loops[0]?.durationSec}1-bar{:else if loop.durationSec === loops[0]?.durationSec * 2}2-bar{:else if loop.durationSec === loops[0]?.durationSec * 4}4-bar{:else if loop.durationSec === loops[0]?.durationSec * 8}8-bar{:else}custom{/if}
            </span>
            <span class="time">
              {formatTime(loop.startSec)} – {formatTime(loop.endSec)}
            </span>
            <span class="duration">({loop.durationSec.toFixed(2)}s)</span>
            <span class="confidence">[{Math.round(loop.confidence * 100)}%]</span>
          </label>
          <Button
            on:click={() => extractSelectedLoop()}
            disabled={isExtracting}
            size="small"
          >
            Extract
          </Button>
        </div>
      {/each}
    </div>

    <div class="extract-btn-container">
      <Button
        on:click={extractSelectedLoop}
        disabled={isExtracting || selectedLoopIdx === undefined}
        variant="primary"
      >
        {isExtracting ? 'Extracting...' : 'Extract Selected Loop'}
      </Button>
    </div>
  {/if}
</div>

<style>
  .loop-detector-panel {
    padding: 1rem;
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    background: var(--color-panel-bg);
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 600;
  }

  .controls {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    align-items: center;
  }

  .bpm-input {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .bpm-input label {
    font-weight: 500;
  }

  .bpm-input input {
    width: 80px;
    padding: 0.4rem;
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
  }

  .hint {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  .error-message {
    color: var(--color-error);
    padding: 0.5rem;
    margin-bottom: 1rem;
    background: var(--color-error-bg);
    border-radius: 0.25rem;
  }

  .candidates {
    margin-bottom: 1rem;
  }

  .label {
    margin: 0 0 0.5rem 0;
    font-weight: 500;
  }

  .candidate-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    padding: 0.5rem;
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
  }

  .candidate-row:hover {
    background: var(--color-hover);
  }

  .candidate-row input[type='radio'] {
    margin: 0;
  }

  .candidate-label {
    flex: 1;
    display: flex;
    gap: 0.5rem;
    align-items: center;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .size {
    font-weight: 500;
    min-width: 50px;
  }

  .time {
    color: var(--color-text-secondary);
  }

  .duration {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .confidence {
    color: var(--color-text-secondary);
    font-size: 0.85rem;
  }

  .extract-btn-container :global(button) {
    width: 100%;
  }
</style>
