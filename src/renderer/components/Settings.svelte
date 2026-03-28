<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { settingsStore } from '../stores/settingsStore';

  const dispatch = createEventDispatcher<{ close: void }>();

  $: settings = $settingsStore;

  const af = (window as any).audioforge;

  // ── Dependencies panel ────────────────────────────────────────────────────
  interface ToolStatus { available: boolean; version?: string }
  interface HealthStatus { tools: Record<string, ToolStatus> }

  let healthStatus: HealthStatus | null = null;
  let installing: Record<string, boolean> = {};
  let installLog: Record<string, string[]> = {};
  let installError: Record<string, string> = {};

  const INSTALLABLE_TOOLS = ['ffmpeg', 'yt-dlp', 'sox', 'aubio', 'demucs'];

  onMount(async () => {
    await refreshHealth();
  });

  let removeProgressListener: (() => void) | null = null;

  onMount(() => {
    removeProgressListener = af.health.onInstallProgress((tool: string, line: string) => {
      if (!installLog[tool]) installLog[tool] = [];
      installLog[tool] = [...installLog[tool], line.trim()].slice(-20);
      installLog = installLog;
    });
    return () => removeProgressListener?.();
  });

  onDestroy(() => {
    removeProgressListener?.();
  });

  async function refreshHealth() {
    try {
      healthStatus = await af.health.getStatus();
    } catch (e) {
      // ignore
    }
  }

  async function installTool(tool: string) {
    installing = { ...installing, [tool]: true };
    installError = { ...installError, [tool]: '' };
    installLog = { ...installLog, [tool]: [] };
    try {
      await af.health.installTool(tool);
      await refreshHealth();
    } catch (e) {
      installError = { ...installError, [tool]: (e as Error).message };
    } finally {
      installing = { ...installing, [tool]: false };
    }
  }

  function handleBpmInput(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) settingsStore.update({ defaultBpm: val });
  }

  function handleThemeChange(e: Event) {
    settingsStore.update({ theme: (e.target as HTMLSelectElement).value as any });
  }

  function handleQualityChange(e: Event) {
    settingsStore.update({ audioQuality: (e.target as HTMLSelectElement).value as any });
  }

  function handleMetronomeVolumeInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(val)) settingsStore.update({ metronomeVolume: val });
  }

  function handleAutoDetectBpm(e: Event) {
    settingsStore.update({ autoDetectBpm: (e.target as HTMLInputElement).checked });
  }

  function handleAutoDetectKey(e: Event) {
    settingsStore.update({ autoDetectKey: (e.target as HTMLInputElement).checked });
  }

  // ── HuggingFace token ─────────────────────────────────────────────────────
  let hfToken = '';
  let hfTokenVisible = false;
  let hfTokenSaved = false;
  let hfTokenSaveTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    hfToken = (await af.settings.get('hf.token', '')) ?? '';
  });

  async function handleHfTokenInput(e: Event) {
    hfToken = (e.target as HTMLInputElement).value;
    await af.settings.set('hf.token', hfToken);
    if (hfTokenSaveTimer) clearTimeout(hfTokenSaveTimer);
    hfTokenSaved = true;
    hfTokenSaveTimer = setTimeout(() => { hfTokenSaved = false; }, 2000);
  }

  function handleReset() {
    settingsStore.reset();
  }

  function handleClose() {
    dispatch('close');
  }
</script>

<div class="settings">
  <div class="settings-header">
    <h2>Settings</h2>
    <button class="close-btn" on:click={handleClose} aria-label="Close settings">✕</button>
  </div>

  <div class="settings-body">
    <section class="settings-section">
      <h3>Project Defaults</h3>

      <div class="setting-row">
        <label for="default-bpm">Default BPM</label>
        <input
          id="default-bpm"
          type="number"
          min="20"
          max="300"
          value={settings.defaultBpm}
          on:input={handleBpmInput}
        />
      </div>
    </section>

    <section class="settings-section">
      <h3>Appearance</h3>

      <div class="setting-row">
        <label for="theme">Theme</label>
        <select id="theme" value={settings.theme} on:change={handleThemeChange}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </div>
    </section>

    <section class="settings-section">
      <h3>Audio</h3>

      <div class="setting-row">
        <label for="audio-quality">Audio Quality</label>
        <select id="audio-quality" value={settings.audioQuality} on:change={handleQualityChange}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div class="setting-row">
        <label for="metronome-volume">Metronome Volume</label>
        <input
          id="metronome-volume"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={settings.metronomeVolume}
          on:input={handleMetronomeVolumeInput}
        />
        <span class="value-label">{Math.round(settings.metronomeVolume * 100)}%</span>
      </div>
    </section>

    <section class="settings-section">
      <h3>Analysis</h3>

      <div class="setting-row">
        <label for="auto-detect-bpm">Auto-detect BPM</label>
        <input
          id="auto-detect-bpm"
          type="checkbox"
          checked={settings.autoDetectBpm}
          on:change={handleAutoDetectBpm}
        />
      </div>

      <div class="setting-row">
        <label for="auto-detect-key">Auto-detect Key</label>
        <input
          id="auto-detect-key"
          type="checkbox"
          checked={settings.autoDetectKey}
          on:change={handleAutoDetectKey}
        />
      </div>
    </section>
    <section class="settings-section">
      <h3>AI Models</h3>
      <p class="dep-note">
        Some AI models (like Stable Audio Open) are hosted on HuggingFace and may need a free
        account token to download. You only need this once — the model is saved on your computer
        after the first download.
      </p>

      <div class="setting-row hf-token-row">
        <label for="hf-token">HuggingFace Token</label>
        <div class="hf-token-input-wrap">
          <input
            id="hf-token"
            type={hfTokenVisible ? 'text' : 'password'}
            placeholder="hf_••••••••••••••••"
            value={hfToken}
            on:input={handleHfTokenInput}
            autocomplete="off"
            spellcheck="false"
          />
          <button
            class="token-visibility-btn"
            type="button"
            on:click={() => (hfTokenVisible = !hfTokenVisible)}
            aria-label={hfTokenVisible ? 'Hide token' : 'Show token'}
          >{hfTokenVisible ? '🙈' : '👁'}</button>
        </div>
        {#if hfTokenSaved}
          <span class="token-saved">Saved</span>
        {/if}
      </div>

      <p class="hf-token-help">
        Don't have a token? <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer">Get one free at huggingface.co</a> — just sign up and click "New token".
      </p>
    </section>

    <section class="settings-section">
      <h3>Dependencies</h3>
      <p class="dep-note">Optional CLI tools that power audio analysis and processing.</p>

      {#if !healthStatus}
        <p class="dep-loading">Checking tools…</p>
      {:else}
        <div class="dep-list">
          {#each INSTALLABLE_TOOLS as tool}
            {@const status = healthStatus.tools[tool]}
            <div class="dep-row">
              <span class="dep-indicator" class:ok={status?.available} class:missing={!status?.available}>
                {status?.available ? '●' : '○'}
              </span>
              <span class="dep-name">{tool}</span>
              {#if status?.available}
                <span class="dep-version">{status.version ?? ''}</span>
              {:else}
                <button
                  class="install-btn"
                  disabled={installing[tool]}
                  on:click={() => installTool(tool)}
                >
                  {installing[tool] ? 'Installing…' : 'Install'}
                </button>
              {/if}
            </div>
            {#if installError[tool]}
              <p class="dep-error">{installError[tool]}</p>
            {/if}
            {#if installing[tool] && installLog[tool]?.length}
              <pre class="dep-log">{installLog[tool].join('\n')}</pre>
            {/if}
          {/each}
        </div>

        <button class="refresh-btn" on:click={refreshHealth}>Refresh</button>
      {/if}
    </section>
  </div>

  <div class="settings-footer">
    <button class="reset-btn" on:click={handleReset}>Reset to Defaults</button>
  </div>
</div>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-family: inherit;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .settings-header h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .close-btn:hover {
    color: var(--text-primary);
  }

  .settings-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
  }

  .settings-section {
    margin-bottom: 1.5rem;
  }

  .settings-section h3 {
    margin: 0 0 0.75rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .setting-row label {
    flex: 1;
    font-size: 0.9rem;
  }

  .setting-row input[type='number'],
  .setting-row select {
    width: 120px;
    padding: 0.35rem 0.5rem;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: inherit;
    font-size: 0.9rem;
  }

  .setting-row input[type='range'] {
    width: 120px;
  }

  .setting-row input[type='checkbox'] {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }

  .value-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    min-width: 3ch;
  }

  .settings-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
  }

  .reset-btn {
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s;
  }

  .reset-btn:hover {
    background: var(--bg-hover, #2d2d50);
    color: var(--text-primary);
  }

  .hf-token-row {
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .hf-token-row label {
    padding-top: 0.4rem;
    min-width: 140px;
  }

  .hf-token-input-wrap {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 180px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }

  .hf-token-input-wrap input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    padding: 0.35rem 0.5rem;
    color: inherit;
    font-size: 0.88rem;
    font-family: monospace;
    width: 0;
  }

  .token-visibility-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.2rem 0.5rem;
    font-size: 0.9rem;
    opacity: 0.6;
    transition: opacity 0.15s;
    flex-shrink: 0;
  }

  .token-visibility-btn:hover {
    opacity: 1;
  }

  .token-saved {
    font-size: 0.78rem;
    color: #3fb950;
    align-self: center;
  }

  .hf-token-help {
    margin: 0.25rem 0 0;
    font-size: 0.78rem;
    color: var(--text-secondary);
  }

  .hf-token-help a {
    color: #58a6ff;
    text-decoration: none;
  }

  .hf-token-help a:hover {
    text-decoration: underline;
  }

  .dep-note {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .dep-loading {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .dep-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .dep-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.35rem 0;
  }

  .dep-indicator {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .dep-indicator.ok {
    color: #3fb950;
  }

  .dep-indicator.missing {
    color: #f85149;
  }

  .dep-name {
    flex: 1;
    font-size: 0.88rem;
    font-family: monospace;
  }

  .dep-version {
    font-size: 0.75rem;
    color: var(--text-secondary);
    font-family: monospace;
  }

  .install-btn {
    padding: 0.25rem 0.65rem;
    font-size: 0.78rem;
    background: rgba(56, 139, 253, 0.15);
    border: 1px solid rgba(56, 139, 253, 0.4);
    border-radius: 4px;
    color: #58a6ff;
    cursor: pointer;
    transition: background 0.15s;
  }

  .install-btn:hover:not(:disabled) {
    background: rgba(56, 139, 253, 0.25);
  }

  .install-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .dep-error {
    margin: 0 0 0.4rem 1.6rem;
    font-size: 0.78rem;
    color: #f85149;
  }

  .dep-log {
    margin: 0 0 0.4rem 1.6rem;
    font-size: 0.72rem;
    color: var(--text-secondary);
    background: var(--bg-tertiary);
    border-radius: 4px;
    padding: 0.4rem 0.6rem;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  .refresh-btn {
    margin-top: 0.5rem;
    padding: 0.25rem 0.65rem;
    font-size: 0.78rem;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .refresh-btn:hover {
    color: var(--text-primary);
  }
</style>
