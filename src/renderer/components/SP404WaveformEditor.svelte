<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ chopPointsChanged: { chops: any[] } }>();
  const af = (window as any).audioforge;

  export let filePath: string = '';
  export const padRef: string = '';
  export const assetId: number = 0;

  let waveContainer: HTMLDivElement;
  let beatCanvas: HTMLCanvasElement;
  let duration = 0;
  let peaks: number[] = [];
  let beatGrid: any = null;
  let onsets: number[] = [];
  let showBeatGrid = true;
  let showOnsets = true;
  let gridSnap = true;
  let analyzing = false;
  let bpm: number | null = null;
  let yZoom = 1;

  async function initWaveform() {
    if (!waveContainer || !filePath) return;

    try {
      const metadata = await af.audio.getMetadata(filePath);
      duration = metadata.duration || 30;
      peaks = await af.audio.analyzeWaveform(filePath);
      drawWaveform();
    } catch (error) {
      console.error('Failed to load waveform:', error);
    }
  }

  function drawWaveform() {
    if (!waveContainer) return;
    const canvas = document.createElement('canvas');
    canvas.width = waveContainer.offsetWidth;
    canvas.height = waveContainer.offsetHeight;
    const ctx = canvas.getContext('2d')!;

    // Draw background
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw waveform peaks
    if (peaks.length > 0) {
      const step = peaks.length / canvas.width;
      ctx.fillStyle = 'rgba(100,181,246,0.6)';
      for (let x = 0; x < canvas.width; x++) {
        const idx = Math.floor(x * step);
        const peak = Math.abs(peaks[idx] ?? 0);
        const barH = peak * (canvas.height * 0.8);
        ctx.fillRect(x, canvas.height / 2 - barH / 2, 1, barH);
      }
    }

    waveContainer.innerHTML = '';
    waveContainer.appendChild(canvas);
  }

  function drawBeatGrid() {
    if (!beatCanvas || !showBeatGrid || !beatGrid) return;
    const ctx = beatCanvas.getContext('2d')!;
    const w = beatCanvas.width;
    const h = beatCanvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!duration) return;

    // Draw bar positions
    beatGrid.barPositions.forEach((t: number) => {
      const x = (t / duration) * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });

    // Draw beat positions
    beatGrid.beatPositions.forEach((t: number) => {
      if (beatGrid.barPositions.includes(t)) return;
      const x = (t / duration) * w;
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });

    // Draw onsets
    if (showOnsets) {
      ctx.fillStyle = '#fb8c00';
      onsets.forEach((t: number) => {
        const x = (t / duration) * w;
        ctx.beginPath();
        ctx.moveTo(x, h - 6);
        ctx.lineTo(x - 4, h);
        ctx.lineTo(x + 4, h);
        ctx.fill();
      });
    }
  }

  $: showBeatGrid, showOnsets, beatGrid, drawBeatGrid();
  $: if (filePath) initWaveform();

  async function runAnalysis() {
    if (!filePath || analyzing) return;
    analyzing = true;
    try {
      const result = await af.sp404.waveform.analyze(filePath, duration || 30);
      beatGrid = result;
      bpm = result.bpm;
      onsets = result.onsets ?? [];
      drawBeatGrid();
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      analyzing = false;
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'g' || e.key === 'G') {
      showBeatGrid = !showBeatGrid;
      drawBeatGrid();
    }
    if (e.key === 's' || e.key === 'S') {
      gridSnap = !gridSnap;
    }
    if (e.key === 'o' || e.key === 'O') {
      showOnsets = !showOnsets;
      drawBeatGrid();
    }
  }

  function handleScroll(e: WheelEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      yZoom = Math.max(0.5, Math.min(4, yZoom * (e.deltaY < 0 ? 1.1 : 0.9)));
      if (waveContainer) waveContainer.style.transform = `scaleY(${yZoom})`;
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    // Cleanup if needed
  });
</script>

<div class="wave-editor" on:wheel={handleScroll}>
  <div class="analysis-bar">
    <span class="badge">
      {#if bpm}<strong>BPM:</strong> {bpm.toFixed(1)}{:else}BPM: —{/if}
    </span>
    <div class="spacer"></div>
    <button class="toggle-btn" class:on={showBeatGrid} on:click={() => { showBeatGrid = !showBeatGrid; drawBeatGrid(); }} title="Toggle beat grid (G)">Grid</button>
    <button class="toggle-btn" class:on={showOnsets} on:click={() => { showOnsets = !showOnsets; drawBeatGrid(); }} title="Toggle onset markers (O)">Onsets</button>
    <button class="toggle-btn" class:on={gridSnap} on:click={() => gridSnap = !gridSnap} title="Toggle snap (S)">Snap</button>
    <button class="analyze-btn" disabled={analyzing} on:click={runAnalysis}>
      {analyzing ? 'Analyzing…' : 'Analyze'}
    </button>
  </div>

  <div class="waveform-wrapper">
    <div bind:this={waveContainer} class="waveform-container" style="transform-origin: center; transform: scaleY({yZoom})"></div>
    <canvas bind:this={beatCanvas} class="beat-canvas" aria-hidden="true"></canvas>
  </div>
</div>

<style>
  .wave-editor {
    display: flex;
    flex-direction: column;
    background: #0d0d1a;
    height: 100%;
  }
  .analysis-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.75rem;
    background: #13131f;
    border-bottom: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
    font-size: 0.8rem;
    color: rgba(255,255,255,0.7);
  }
  .badge {
    color: rgba(255,255,255,0.6);
    font-size: 0.78rem;
  }
  .spacer {
    flex: 1;
  }
  .toggle-btn {
    padding: 0.2rem 0.5rem;
    font-size: 0.72rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 3px;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: all 0.15s;
  }
  .toggle-btn.on {
    background: rgba(100,181,246,0.15);
    border-color: #64b5f6;
    color: #64b5f6;
  }
  .analyze-btn {
    padding: 0.2rem 0.7rem;
    font-size: 0.72rem;
    background: rgba(100,181,246,0.15);
    border: 1px solid #64b5f6;
    border-radius: 3px;
    color: #64b5f6;
    cursor: pointer;
  }
  .analyze-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .waveform-wrapper {
    position: relative;
    flex: 1;
    overflow: hidden;
  }
  .waveform-container {
    width: 100%;
    height: 100%;
  }
  .beat-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
