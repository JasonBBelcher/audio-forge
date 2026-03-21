<script lang="ts">
  import { onMount } from 'svelte';

  interface AudioSettings {
    audioSampleRate?: number;
    audioBufferSize?: number;
  }

  let sampleRate: number = 44100;
  let bufferSize: number = 256;
  let isLoading: boolean = true;

  const sampleRates = [44100, 48000, 88200, 96000];
  const bufferSizes = [128, 256, 512, 1024];

  onMount(async () => {
    try {
      if ((window as any).audioforge?.settings?.getAll) {
        const settings = await (window as any).audioforge.settings.getAll();
        sampleRate = settings?.audioSampleRate ?? 44100;
        bufferSize = settings?.audioBufferSize ?? 256;
      }
    } catch {
      // Fallback to defaults
      sampleRate = 44100;
      bufferSize = 256;
    } finally {
      isLoading = false;
    }
  });

  function handleSampleRateChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newRate = target.value;
    sampleRate = parseInt(newRate);
    if ((window as any).audioforge?.settings?.set) {
      (window as any).audioforge.settings.set('audioSampleRate', newRate);
    }
  }

  function handleBufferSizeChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    const newSize = target.value;
    bufferSize = parseInt(newSize);
    if ((window as any).audioforge?.settings?.set) {
      (window as any).audioforge.settings.set('audioBufferSize', newSize);
    }
  }
</script>

<div class="audio-view">
  <h2>Audio Settings</h2>

  {#if isLoading}
    <div class="loading">Loading audio settings...</div>
  {:else}
    <div class="settings-container">
      <div class="setting">
        <label for="sample-rate">Sample Rate (Hz)</label>
        <select id="sample-rate" value={sampleRate} onchange={handleSampleRateChange}>
          {#each sampleRates as rate}
            <option value={rate}>{rate}</option>
          {/each}
        </select>
        <span class="current-value">{sampleRate} Hz</span>
      </div>

      <div class="setting">
        <label for="buffer-size">Buffer Size (samples)</label>
        <select id="buffer-size" value={bufferSize} onchange={handleBufferSizeChange}>
          {#each bufferSizes as size}
            <option value={size}>{size}</option>
          {/each}
        </select>
        <span class="current-value">{bufferSize} samples</span>
      </div>
    </div>
  {/if}
</div>

<style>
  .audio-view {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .loading {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    padding: 12px;
  }

  .settings-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .setting {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  select:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.15);
  }

  select:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.08);
    border-color: #64b5f6;
  }

  .current-value {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
  }
</style>
