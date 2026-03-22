<script lang="ts">
  import { onMount } from 'svelte';

  interface Generation {
    jobId: string;
    filePath: string;
    prompt: string;
    timestamp: number;
    duration: number;
  }

  let prompt = '';
  let durationSec = 10;
  let steps = 100;
  let guidance = 7.0;
  let seed = '';
  let isModelInstalled = false;
  let isInstalling = false;
  let isGenerating = false;
  let generationProgress = 0;
  let generationMessage = '';
  let currentJobId: string | null = null;
  let generations: Generation[] = [];
  let installError = '';
  let generateError = '';

  const MIN_DURATION = 1;
  const MAX_DURATION = 47;
  const MIN_STEPS = 20;
  const MAX_STEPS = 200;
  const MIN_GUIDANCE = 1;
  const MAX_GUIDANCE = 15;

  onMount(async () => {
    await checkModelInstallation();
    subscribeToJobEvents();
  });

  async function checkModelInstallation() {
    try {
      if (window.audioforge?.generation?.isInstalled) {
        isModelInstalled = await window.audioforge.generation.isInstalled('stable-audio-open');
      }
    } catch (error) {
      console.error('Failed to check model installation:', error);
    }
  }

  async function handleInstall() {
    isInstalling = true;
    installError = '';
    try {
      if (window.audioforge?.generation?.install) {
        await window.audioforge.generation.install('stable-audio-open');
        isModelInstalled = true;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      installError = `Installation failed: ${msg}`;
      console.error('Install failed:', error);
    } finally {
      isInstalling = false;
    }
  }

  async function handleGenerate() {
    if (!prompt.trim()) {
      generateError = 'Please enter a prompt';
      return;
    }

    if (!isModelInstalled) {
      generateError = 'Model not installed. Please install first.';
      return;
    }

    isGenerating = true;
    generationProgress = 0;
    generationMessage = 'Starting generation...';
    generateError = '';

    try {
      if (!window.audioforge?.generation?.generate) {
        throw new Error('Generation service not available');
      }

      const params: any = {
        modelId: 'stable-audio-open',
        prompt: prompt.trim(),
        durationSec,
        steps,
        guidance,
      };

      if (seed.trim()) {
        params.seed = parseInt(seed, 10);
        if (isNaN(params.seed)) {
          throw new Error('Invalid seed value');
        }
      }

      const result = await window.audioforge.generation.generate(params);
      currentJobId = result.jobId;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      generateError = `Generation failed: ${msg}`;
      console.error('Generate failed:', error);
      isGenerating = false;
    }
  }

  function subscribeToJobEvents() {
    if (!window.audioforge?.on) {
      return;
    }

    const unsubProgress = window.audioforge.on('job:progress', (data: any) => {
      if (data.jobId === currentJobId) {
        generationProgress = Math.min(data.progress || 0, 99);
        generationMessage = data.message || `Generating... ${generationProgress}%`;
      }
    });

    const unsubComplete = window.audioforge.on('job:completed', (data: any) => {
      if (data.jobId === currentJobId) {
        generationProgress = 100;
        generationMessage = 'Complete!';
        isGenerating = false;

        if (data.result?.filePath) {
          const gen: Generation = {
            jobId: currentJobId!,
            filePath: data.result.filePath,
            prompt: prompt.trim(),
            timestamp: Date.now(),
            duration: durationSec,
          };
          generations = [gen, ...generations];
          prompt = '';
        }
        currentJobId = null;
      }
    });

    const unsubFailed = window.audioforge.on('job:failed', (data: any) => {
      if (data.jobId === currentJobId) {
        generateError = `Generation failed: ${data.error || 'Unknown error'}`;
        isGenerating = false;
        currentJobId = null;
      }
    });

    return () => {
      unsubProgress();
      unsubComplete();
      unsubFailed();
    };
  }

  async function handleSaveGeneration(generation: Generation) {
    try {
      if (!window.audioforge?.library?.importAudio) {
        throw new Error('Library service not available');
      }

      await window.audioforge.library.importAudio(generation.filePath, generation.prompt);
      console.log('Generation saved to library');
    } catch (error) {
      console.error('Failed to save generation:', error);
    }
  }

  async function handleDeleteGeneration(jobId: string) {
    generations = generations.filter(g => g.jobId !== jobId);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatPrompt(text: string): string {
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }
</script>

<div class="ai-generate-view">
  <div class="header">
    <h1>AI Audio Generation</h1>
    <p class="subtitle">Generate audio from text using Stable Audio Open</p>
  </div>

  <!-- Model Status Panel -->
  <div class="model-panel">
    <div class="model-info">
      <div class="model-header">
        <h3>Model: Stable Audio Open</h3>
        <button class="install-btn" onclick={handleInstall} disabled={isInstalling || isModelInstalled}>
          {isInstalling ? 'Installing...' : isModelInstalled ? 'Installed' : 'Install'}
        </button>
      </div>
      <div class="status-indicator" class:installed={isModelInstalled}>
        <span class="dot"></span>
        <span>{isModelInstalled ? 'Ready' : 'Not installed'}</span>
      </div>
      {#if installError}
        <div class="error-message">{installError}</div>
      {/if}
    </div>
  </div>

  <!-- Generation Form -->
  <div class="generation-panel">
    <div class="form-group">
      <label for="prompt">Prompt</label>
      <textarea
        id="prompt"
        placeholder="Describe the audio you want to generate (e.g., '140 BPM trap hi-hat loop, crispy and punchy')"
        bind:value={prompt}
        disabled={!isModelInstalled || isGenerating}
        rows="3"
      ></textarea>
      <div class="char-count">{prompt.length} characters</div>
    </div>

    <div class="sliders-grid">
      <div class="slider-group">
        <label for="duration">
          Duration: <span class="value">{durationSec}s</span>
          <span class="range">({MIN_DURATION}–{MAX_DURATION}s)</span>
        </label>
        <input
          id="duration"
          type="range"
          min={MIN_DURATION}
          max={MAX_DURATION}
          bind:value={durationSec}
          disabled={!isModelInstalled || isGenerating}
        />
      </div>

      <div class="slider-group">
        <label for="steps">
          Steps: <span class="value">{steps}</span>
          <span class="range">({MIN_STEPS}–{MAX_STEPS})</span>
        </label>
        <input
          id="steps"
          type="range"
          min={MIN_STEPS}
          max={MAX_STEPS}
          bind:value={steps}
          disabled={!isModelInstalled || isGenerating}
        />
      </div>

      <div class="slider-group">
        <label for="guidance">
          Guidance: <span class="value">{guidance.toFixed(1)}</span>
          <span class="range">({MIN_GUIDANCE}–{MAX_GUIDANCE})</span>
        </label>
        <input
          id="guidance"
          type="range"
          min={MIN_GUIDANCE}
          max={MAX_GUIDANCE}
          step="0.1"
          bind:value={guidance}
          disabled={!isModelInstalled || isGenerating}
        />
      </div>

      <div class="form-group seed-group">
        <label for="seed">Seed (optional)</label>
        <input
          id="seed"
          type="text"
          placeholder="Leave empty for random"
          bind:value={seed}
          disabled={!isModelInstalled || isGenerating}
        />
      </div>
    </div>

    <button
      class="generate-btn"
      onclick={handleGenerate}
      disabled={!isModelInstalled || isGenerating || !prompt.trim()}
    >
      {isGenerating ? 'Generating...' : 'Generate'}
    </button>

    {#if generateError}
      <div class="error-message">{generateError}</div>
    {/if}

    <!-- Progress Bar -->
    {#if isGenerating}
      <div class="progress-section">
        <div class="progress-bar">
          <div class="progress-fill" style="width: {generationProgress}%"></div>
        </div>
        <div class="progress-text">{generationProgress}% {generationMessage}</div>
      </div>
    {/if}
  </div>

  <!-- Recent Generations -->
  {#if generations.length > 0}
    <div class="generations-panel">
      <h3>Recent Generations</h3>
      <div class="generations-list">
        {#each generations as gen (gen.jobId)}
          <div class="generation-item">
            <div class="gen-info">
              <div class="gen-header">
                <span class="play-icon">▶</span>
                <span class="gen-filename">{formatPrompt(gen.prompt)}</span>
                <span class="gen-time">{formatDate(gen.timestamp)}</span>
              </div>
              <div class="gen-meta">
                <span class="gen-duration">{gen.duration}s</span>
              </div>
            </div>
            <div class="gen-actions">
              <button
                class="action-btn save-btn"
                onclick={() => handleSaveGeneration(gen)}
                title="Save to library"
              >
                Save
              </button>
              <button
                class="action-btn delete-btn"
                onclick={() => handleDeleteGeneration(gen.jobId)}
                title="Delete"
              >
                🗑
              </button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .ai-generate-view {
    display: flex;
    flex-direction: column;
    gap: 24px;
    padding: 24px;
    height: 100%;
    overflow-y: auto;
    background: #0f0f1e;
  }

  .header {
    margin-bottom: 8px;
  }

  .header h1 {
    font-size: 24px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
    margin: 0 0 4px 0;
  }

  .subtitle {
    font-size: 13px;
    color: rgba(255, 255, 255, 0.5);
    margin: 0;
  }

  .model-panel {
    background: rgba(100, 181, 246, 0.08);
    border: 1px solid rgba(100, 181, 246, 0.2);
    border-radius: 8px;
    padding: 16px;
  }

  .model-info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .model-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .model-header h3 {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  .install-btn {
    padding: 6px 12px;
    background: #64b5f6;
    color: #000;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .install-btn:hover:not(:disabled) {
    background: #7fc3f8;
    transform: translateY(-1px);
  }

  .install-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }

  .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e57373;
  }

  .status-indicator.installed .dot {
    background: #81c784;
  }

  .error-message {
    font-size: 12px;
    color: #ef5350;
    margin-top: 8px;
  }

  .generation-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }

  .form-group label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
  }

  textarea,
  input[type="text"],
  input[type="range"] {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-family: inherit;
    font-size: 13px;
    padding: 8px 12px;
    transition: all 0.2s ease;
  }

  textarea:focus,
  input[type="text"]:focus {
    outline: none;
    border-color: #64b5f6;
    background: rgba(255, 255, 255, 0.08);
  }

  textarea:disabled,
  input[type="text"]:disabled,
  input[type="range"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
    min-height: 80px;
    font-family: monospace;
  }

  .char-count {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-align: right;
  }

  .sliders-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .slider-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .slider-group label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .value {
    color: #64b5f6;
    font-weight: 700;
  }

  .range {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    font-weight: 400;
  }

  input[type="range"] {
    padding: 0;
    cursor: pointer;
  }

  .seed-group {
    grid-column: 1;
  }

  .generate-btn {
    width: 100%;
    padding: 12px;
    background: #64b5f6;
    color: #000;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .generate-btn:hover:not(:disabled) {
    background: #7fc3f8;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(100, 181, 246, 0.3);
  }

  .generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .progress-section {
    margin-top: 16px;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #64b5f6, #42a5f5);
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    text-align: center;
  }

  .generations-panel {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    padding: 20px;
  }

  .generations-panel h3 {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin: 0 0 16px 0;
  }

  .generations-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .generation-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    padding: 12px;
    transition: all 0.2s ease;
  }

  .generation-item:hover {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .gen-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .gen-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.85);
  }

  .play-icon {
    color: #64b5f6;
    font-size: 10px;
  }

  .gen-filename {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .gen-time {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .gen-meta {
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
  }

  .gen-duration {
    background: rgba(100, 181, 246, 0.1);
    padding: 2px 6px;
    border-radius: 2px;
  }

  .gen-actions {
    display: flex;
    gap: 6px;
  }

  .action-btn {
    padding: 4px 8px;
    background: rgba(100, 181, 246, 0.15);
    color: #64b5f6;
    border: 1px solid rgba(100, 181, 246, 0.3);
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .action-btn:hover {
    background: rgba(100, 181, 246, 0.25);
    border-color: #64b5f6;
  }

  .delete-btn {
    color: #ef5350;
    background: rgba(239, 83, 80, 0.1);
    border-color: rgba(239, 83, 80, 0.3);
  }

  .delete-btn:hover {
    background: rgba(239, 83, 80, 0.2);
    border-color: #ef5350;
  }
</style>
