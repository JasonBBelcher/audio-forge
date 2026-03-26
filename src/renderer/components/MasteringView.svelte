<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';

  let selectedFile: string | null = null;
  let selectedFileName: string = '';
  let libraryAssets: any[] = [];
  let analysis: { inputLufs: number; inputPeakDb: number; inputDynamicRange: number } | null = null;
  let analyzing = false;
  let mastering = false;
  let masteringProgress = '';
  let outputPath: string | null = null;

  let eqCanvas: HTMLCanvasElement | null = null;

  // EQ
  let lowFreq = 100;
  let lowGain = 0;
  let midFreq = 1000;
  let midGain = 0;
  let midWidth = 1.5;
  let highFreq = 8000;
  let highGain = 0;

  // Compressor
  let threshold = -20;
  let ratio = 4;
  let attack = 20;
  let release = 200;
  let makeupGain = 0;

  // Loudness
  let targetLufs = -14;
  let ceilingDbtp = -1.0;

  let eqOpen = true;
  let compOpen = true;
  let loudnessOpen = true;

  const af = (window as any).audioforge;

  onMount(async () => {
    try {
      libraryAssets = await af.files.list();
    } catch (err) {
      console.error('Failed to load library assets:', err);
    }
  });

  afterUpdate(() => {
    if (eqCanvas) {
      drawEQCurve();
    }
  });

  function drawEQCurve() {
    if (!eqCanvas) return;

    const w = eqCanvas.clientWidth;
    const h = eqCanvas.clientHeight;
    eqCanvas.width = w;
    eqCanvas.height = h;

    const ctx = eqCanvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, w, h);

    // Draw grid and axes
    const centerY = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();

    // Grid lines at ±3, 6, 9, 12 dB
    const dbLevels = [3, 6, 9, 12];
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (const db of dbLevels) {
      const y1 = centerY - (h / 24) * db;
      const y2 = centerY + (h / 24) * db;
      ctx.beginPath();
      ctx.moveTo(0, y1);
      ctx.lineTo(w, y1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y2);
      ctx.lineTo(w, y2);
      ctx.stroke();
    }

    // Calculate frequency response
    const points: [number, number][] = [];
    const freqs = [20, 50, 100, 150, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 10000, 12000, 15000, 20000];

    for (const freq of freqs) {
      let gain = 0;

      // Low shelf (simple approximation)
      if (Math.abs(lowGain) > 0.1) {
        const normalized = Math.log2(freq / lowFreq);
        gain += lowGain * 0.5 * (1 + Math.tanh(normalized * -2));
      }

      // Mid peak (Gaussian-like)
      if (Math.abs(midGain) > 0.1) {
        const normalized = Math.log2(freq / midFreq);
        gain += midGain * Math.exp(-0.5 * Math.pow(normalized / (midWidth / 2), 2));
      }

      // High shelf (simple approximation)
      if (Math.abs(highGain) > 0.1) {
        const normalized = Math.log2(freq / highFreq);
        gain += highGain * 0.5 * (1 + Math.tanh(normalized * 2));
      }

      gain = Math.max(-15, Math.min(15, gain));
      const x = (Math.log2(freq / 20) / Math.log2(20000 / 20)) * w;
      const y = centerY - (h / 24) * gain;
      points.push([x, y]);
    }

    // Draw curve
    if (points.length > 0) {
      ctx.fillStyle = 'rgba(100, 181, 246, 0.3)';
      ctx.strokeStyle = '#64b5f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      for (const [x, y] of points) {
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  async function handleBrowse() {
    const af = (window as any).audioforge;
    const result = await af.files.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'aiff', 'aif'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      selectedFile = result.filePaths[0];
      selectedFileName = selectedFile.split('/').pop() || 'Unknown';
      analysis = null;
    }
  }

  function handleSelectFromLibrary(asset: any) {
    selectedFile = asset.file_path;
    selectedFileName = asset.name || 'Unknown';
    analysis = null;
  }

  async function handleAnalyze() {
    if (!selectedFile) return;
    analyzing = true;
    try {
      const af = (window as any).audioforge;
      analysis = await af.mastering.analyze(selectedFile);
    } catch (err: any) {
      console.error('Analysis failed:', err);
      analysis = null;
    } finally {
      analyzing = false;
    }
  }

  async function handleMaster() {
    if (!selectedFile) return;
    mastering = true;
    masteringProgress = 'Opening save dialog...';
    try {
      const af = (window as any).audioforge;
      const saveResult = await af.mastering.showSaveDialog(selectedFile);
      if (saveResult.canceled || !saveResult.filePath) {
        mastering = false;
        return;
      }
      masteringProgress = 'Applying mastering chain...';
      await af.mastering.master({
        inputPath: selectedFile,
        outputPath: saveResult.filePath,
        eq: { lowFreq, lowGain, midFreq, midGain, midWidth, highFreq, highGain },
        compressor: { threshold, ratio, attack, release, makeupGain },
        targetLufs,
        ceilingDbtp
      });
      outputPath = saveResult.filePath;
      masteringProgress = 'Done!';
    } catch (e: any) {
      masteringProgress = 'Failed: ' + (e?.message || String(e));
    } finally {
      mastering = false;
    }
  }

  async function handleImport() {
    if (!outputPath) return;
    const af = (window as any).audioforge;
    try {
      await af.files.import([outputPath]);
      outputPath = null;
    } catch (err: any) {
      console.error('Import failed:', err);
    }
  }

  async function handleRevealInFinder() {
    if (!outputPath) return;
    const af = (window as any).audioforge;
    try {
      await af.files.revealInFinder(outputPath);
    } catch (err: any) {
      console.error('Reveal failed:', err);
    }
  }

  function setPreset(lufs: number) {
    targetLufs = lufs;
  }
</script>

<div class="mastering-container">
  <!-- Left Column -->
  <div class="left-column">
    <!-- Source File Section -->
    <section class="section source-section">
      <h3 class="section-header">SOURCE FILE</h3>
      <button onclick={handleBrowse} class="browse-btn">
        📂 Browse...
      </button>

      <div class="library-header">FROM LIBRARY</div>
      <div class="library-list">
        {#each libraryAssets as asset (asset.id)}
          <button
            onclick={() => handleSelectFromLibrary(asset)}
            class="library-item"
            class:active={selectedFile === asset.file_path}
          >
            {asset.name || 'Untitled'}
          </button>
        {/each}
        {#if libraryAssets.length === 0}
          <div class="library-empty">No assets in library</div>
        {/if}
      </div>

      {#if selectedFileName}
        <div class="selected-badge">{selectedFileName}</div>
      {/if}
    </section>

    <!-- Analysis Section -->
    {#if selectedFile}
      <section class="section analysis-section">
        <h3 class="section-header">ANALYSIS</h3>
        <button onclick={handleAnalyze} disabled={analyzing} class="analyze-btn">
          {analyzing ? 'Analyzing...' : 'Analyze'}
        </button>

        {#if analysis}
          <div class="analysis-grid">
            <div class="stat">
              <div class="stat-label">Input LUFS</div>
              <div class="stat-value">{analysis.inputLufs.toFixed(1)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Peak dB</div>
              <div class="stat-value">{analysis.inputPeakDb.toFixed(1)}</div>
            </div>
            <div class="stat">
              <div class="stat-label">Dynamic Range</div>
              <div class="stat-value">{analysis.inputDynamicRange.toFixed(1)}</div>
            </div>
          </div>
        {/if}
      </section>
    {/if}

    <!-- Output Section -->
    {#if selectedFile}
      <section class="section output-section">
        <h3 class="section-header">OUTPUT</h3>
        <button onclick={handleMaster} disabled={mastering} class="master-btn">
          {mastering ? '⏳ Mastering...' : '🎚 Master & Export'}
        </button>

        {#if masteringProgress}
          <div class="progress-bar">
            <div class="progress-status">{masteringProgress}</div>
          </div>
        {/if}

        {#if outputPath}
          <div class="success-actions">
            <button onclick={handleImport} class="action-btn import-btn">
              ✓ Import to Library
            </button>
            <button onclick={handleRevealInFinder} class="action-btn reveal-btn">
              👁 Reveal in Finder
            </button>
          </div>
        {/if}
      </section>
    {/if}
  </div>

  <!-- Right Column -->
  <div class="right-column">
    <!-- EQ Section -->
    <section class="section eq-section">
      <div class="section-header-row">
        <h3 class="section-header">EQ</h3>
        <button onclick={() => (eqOpen = !eqOpen)} class="toggle-btn">
          {eqOpen ? '▼' : '▶'}
        </button>
      </div>

      {#if eqOpen}
        <canvas bind:this={eqCanvas} width="100%" height="120" class="eq-canvas"></canvas>

        <div class="eq-controls">
          <!-- Low Shelf -->
          <div class="band">
            <div class="band-label">LOW SHELF</div>
            <div class="control-row">
              <label>Freq (Hz)</label>
              <input type="number" min="20" max="500" bind:value={lowFreq} />
              <span class="value-badge">{lowFreq}</span>
            </div>
            <div class="control-row">
              <label>Gain (dB)</label>
              <input type="range" min="-12" max="12" step="0.1" bind:value={lowGain} />
              <span class="value-badge">{lowGain.toFixed(1)}</span>
            </div>
          </div>

          <!-- Mid Peak -->
          <div class="band">
            <div class="band-label">MID PEAK</div>
            <div class="control-row">
              <label>Freq (Hz)</label>
              <input type="number" min="200" max="8000" bind:value={midFreq} />
              <span class="value-badge">{midFreq}</span>
            </div>
            <div class="control-row">
              <label>Gain (dB)</label>
              <input type="range" min="-12" max="12" step="0.1" bind:value={midGain} />
              <span class="value-badge">{midGain.toFixed(1)}</span>
            </div>
            <div class="control-row">
              <label>Width (oct)</label>
              <input type="range" min="0.5" max="3" step="0.1" bind:value={midWidth} />
              <span class="value-badge">{midWidth.toFixed(1)}</span>
            </div>
          </div>

          <!-- High Shelf -->
          <div class="band">
            <div class="band-label">HIGH SHELF</div>
            <div class="control-row">
              <label>Freq (Hz)</label>
              <input type="number" min="2000" max="20000" bind:value={highFreq} />
              <span class="value-badge">{highFreq}</span>
            </div>
            <div class="control-row">
              <label>Gain (dB)</label>
              <input type="range" min="-12" max="12" step="0.1" bind:value={highGain} />
              <span class="value-badge">{highGain.toFixed(1)}</span>
            </div>
          </div>
        </div>
      {/if}
    </section>

    <!-- Compressor Section -->
    <section class="section comp-section">
      <div class="section-header-row">
        <h3 class="section-header">COMPRESSOR</h3>
        <button onclick={() => (compOpen = !compOpen)} class="toggle-btn">
          {compOpen ? '▼' : '▶'}
        </button>
      </div>

      {#if compOpen}
        <div class="comp-controls">
          <div class="control-row">
            <label>Threshold (dB)</label>
            <input type="range" min="-50" max="0" step="1" bind:value={threshold} />
            <span class="value-badge">{threshold}</span>
          </div>

          <div class="control-row">
            <label>Ratio</label>
            <input type="range" min="1" max="20" step="0.1" bind:value={ratio} />
            <span class="value-badge">{ratio.toFixed(1)}:1</span>
          </div>

          <div class="control-row">
            <label>Attack (ms)</label>
            <input type="range" min="0.1" max="200" step="0.1" bind:value={attack} />
            <span class="value-badge">{attack.toFixed(1)}</span>
          </div>

          <div class="control-row">
            <label>Release (ms)</label>
            <input type="range" min="10" max="3000" step="10" bind:value={release} />
            <span class="value-badge">{release.toFixed(0)}</span>
          </div>

          <div class="control-row">
            <label>Makeup Gain (dB)</label>
            <input type="range" min="0" max="24" step="0.1" bind:value={makeupGain} />
            <span class="value-badge">{makeupGain.toFixed(1)}</span>
          </div>
        </div>
      {/if}
    </section>

    <!-- Loudness Section -->
    <section class="section loudness-section">
      <div class="section-header-row">
        <h3 class="section-header">LOUDNESS & LIMITER</h3>
        <button onclick={() => (loudnessOpen = !loudnessOpen)} class="toggle-btn">
          {loudnessOpen ? '▼' : '▶'}
        </button>
      </div>

      {#if loudnessOpen}
        <div class="loudness-controls">
          <div class="control-row">
            <label>Target LUFS</label>
            <input type="range" min="-30" max="-5" step="0.1" bind:value={targetLufs} />
            <span class="value-badge">{targetLufs.toFixed(1)}</span>
          </div>

          <div class="presets">
            <button onclick={() => setPreset(-14)} class="preset-btn">Streaming (-14)</button>
            <button onclick={() => setPreset(-8)} class="preset-btn">Club (-8)</button>
            <button onclick={() => setPreset(-23)} class="preset-btn">Broadcast (-23)</button>
          </div>

          <div class="control-row">
            <label>True Peak Ceiling (dBTP)</label>
            <input type="range" min="-3" max="0" step="0.1" bind:value={ceilingDbtp} />
            <span class="value-badge">{ceilingDbtp.toFixed(1)}</span>
          </div>
        </div>
      {/if}
    </section>
  </div>
</div>

<style>
  .mastering-container {
    display: flex;
    gap: 24px;
    padding: 20px;
    height: 100%;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.1);
  }

  .left-column {
    width: 320px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .right-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
  }

  .section {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 16px;
  }

  .section-header {
    margin: 0 0 12px 0;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.6);
  }

  .section-header-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .toggle-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    cursor: pointer;
    padding: 4px;
  }

  .browse-btn,
  .analyze-btn,
  .master-btn {
    width: 100%;
    padding: 10px 12px;
    background: rgba(100, 181, 246, 0.15);
    border: 1px solid rgba(100, 181, 246, 0.3);
    color: rgba(100, 181, 246, 0.9);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-bottom: 8px;
  }

  .browse-btn:hover,
  .analyze-btn:hover {
    background: rgba(100, 181, 246, 0.25);
    border-color: rgba(100, 181, 246, 0.5);
  }

  .master-btn {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.5);
    color: #64b5f6;
    font-size: 14px;
    font-weight: 700;
  }

  .master-btn:hover:not(:disabled) {
    background: rgba(100, 181, 246, 0.4);
  }

  .master-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .library-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
    margin: 12px 0 8px 0;
  }

  .library-list {
    max-height: 120px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .library-item {
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.6);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .library-item:hover {
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.8);
  }

  .library-item.active {
    background: rgba(100, 181, 246, 0.2);
    border-color: rgba(100, 181, 246, 0.4);
    color: #64b5f6;
  }

  .library-empty {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.4);
    text-align: center;
    padding: 8px;
  }

  .selected-badge {
    padding: 8px;
    background: rgba(100, 181, 246, 0.15);
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 4px;
    font-size: 12px;
    color: rgba(100, 181, 246, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .analysis-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
  }

  .stat {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 8px;
    text-align: center;
  }

  .stat-label {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.9);
  }

  .progress-bar {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 4px;
    border: 1px solid rgba(100, 181, 246, 0.2);
  }

  .progress-status {
    font-size: 11px;
    color: rgba(100, 181, 246, 0.8);
  }

  .success-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 8px;
  }

  .action-btn {
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.7);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .import-btn {
    border-color: rgba(76, 175, 80, 0.3);
    color: rgba(76, 175, 80, 0.8);
  }

  .import-btn:hover {
    background: rgba(76, 175, 80, 0.15);
    color: #4caf50;
  }

  .reveal-btn {
    border-color: rgba(156, 39, 176, 0.3);
    color: rgba(156, 39, 176, 0.8);
  }

  .reveal-btn:hover {
    background: rgba(156, 39, 176, 0.15);
    color: #9c27b0;
  }

  .eq-canvas {
    width: 100%;
    height: 120px;
    background: #0d0d0d;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    margin-bottom: 12px;
    display: block;
  }

  .eq-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .band {
    background: rgba(255, 255, 255, 0.02);
    padding: 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .band-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 6px;
  }

  .control-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
  }

  .control-row:last-child {
    margin-bottom: 0;
  }

  .control-row label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.6);
    width: 70px;
    flex-shrink: 0;
  }

  .control-row input[type="number"] {
    width: 60px;
    padding: 4px 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
    border-radius: 3px;
    font-size: 12px;
  }

  .control-row input[type="range"] {
    flex: 1;
    min-width: 80px;
  }

  .value-badge {
    font-size: 11px;
    color: rgba(100, 181, 246, 0.8);
    min-width: 45px;
    text-align: right;
  }

  .comp-controls,
  .loudness-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .presets {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
    margin: 8px 0;
  }

  .preset-btn {
    padding: 6px 8px;
    background: rgba(100, 181, 246, 0.1);
    border: 1px solid rgba(100, 181, 246, 0.2);
    color: rgba(100, 181, 246, 0.7);
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
  }

  .preset-btn:hover {
    background: rgba(100, 181, 246, 0.2);
    border-color: rgba(100, 181, 246, 0.4);
    color: #64b5f6;
  }

  input[type="number"]:focus,
  input[type="range"]:focus {
    outline: none;
  }
</style>
