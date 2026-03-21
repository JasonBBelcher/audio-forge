<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { settingsStore } from '../stores/settingsStore';
  import { get } from 'svelte/store';

  const dispatch = createEventDispatcher<{ close: void }>();

  $: settings = $settingsStore;

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
    background: var(--bg-secondary, #1a1a2e);
    color: var(--text-primary, #e0e0e0);
    font-family: inherit;
  }

  .settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border, #333);
  }

  .settings-header h2 {
    margin: 0;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #888);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    transition: color 0.15s;
  }

  .close-btn:hover {
    color: var(--text-primary, #e0e0e0);
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
    color: var(--text-secondary, #888);
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
    background: var(--bg-tertiary, #252540);
    border: 1px solid var(--border, #333);
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
    color: var(--text-secondary, #888);
    min-width: 3ch;
  }

  .settings-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border, #333);
  }

  .reset-btn {
    background: var(--bg-tertiary, #252540);
    border: 1px solid var(--border, #333);
    color: var(--text-secondary, #888);
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s;
  }

  .reset-btn:hover {
    background: var(--bg-hover, #2d2d50);
    color: var(--text-primary, #e0e0e0);
  }
</style>
