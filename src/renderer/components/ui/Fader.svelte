<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let name: string;
  export let value: number = 0.5;
  export let muted: boolean = false;
  export let solo: boolean = false;
  export let isMaster: boolean = false;

  const dispatch = createEventDispatcher();

  function handleChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const newValue = parseFloat(input.value);
    value = newValue;
    dispatch('change', newValue);
  }

  function toggleMute() {
    muted = !muted;
    dispatch('mute');
  }

  function toggleSolo() {
    solo = !solo;
    dispatch('solo');
  }

  function formatValue(v: number) {
    const db = 20 * Math.log10(Math.max(0.001, v));
    return db.toFixed(1);
  }
</script>

<div class="fader-container" class:is-master={isMaster}>
  <div class="fader-label">
    <span class="fader-name">{name}</span>
    <span class="fader-value">{formatValue(value)} dB</span>
  </div>

  <div class="fader-track">
    <input
      type="range"
      min="0"
      max="1"
      step="0.01"
      bind:value
      on:change={handleChange}
      class="fader-slider"
      class:muted
    />
    <div
      class="fader-fill"
      style={`height: ${value * 100}%`}
      class:muted
    ></div>
  </div>

  <div class="fader-controls">
    {#if !isMaster}
      <button
        class={`control-btn mute ${muted ? 'active' : ''}`}
        on:click={toggleMute}
        title="Mute"
      >
        M
      </button>
      <button
        class={`control-btn solo ${solo ? 'active' : ''}`}
        on:click={toggleSolo}
        title="Solo"
      >
        S
      </button>
    {/if}
  </div>
</div>

<style>
  .fader-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    min-width: 60px;
  }

  .fader-container.is-master {
    background: rgba(99, 102, 241, 0.1);
    border-color: rgba(99, 102, 241, 0.3);
  }

  .fader-label {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    text-align: center;
  }

  .fader-name {
    font-size: 0.85rem;
    font-weight: 600;
    color: #e0e0e0;
  }

  .fader-value {
    font-size: 0.75rem;
    color: #a0a0a0;
    font-family: 'Monaco', monospace;
  }

  .fader-track {
    position: relative;
    height: 150px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
  }

  .fader-fill {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(180deg, #6366f1, #8b5cf6);
    transition: height 0.05s linear;
    opacity: 0.6;
  }

  .fader-fill.muted {
    opacity: 0.2;
  }

  .fader-slider {
    position: relative;
    width: 100%;
    height: 100%;
    writing-mode: vertical-lr;
    direction: rtl;
    margin: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
    z-index: 2;
    -webkit-appearance: none;
    appearance: none;
  }

  .fader-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 6px;
    background: #fff;
    border-radius: 3px;
    cursor: grab;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .fader-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
  }

  .fader-slider::-webkit-slider-runnable-track {
    background: transparent;
  }

  .fader-slider::-moz-range-thumb {
    width: 40px;
    height: 6px;
    background: #fff;
    border-radius: 3px;
    border: none;
    cursor: grab;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .fader-slider::-moz-range-thumb:active {
    cursor: grabbing;
  }

  .fader-slider.muted {
    opacity: 0.5;
  }

  .fader-controls {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .control-btn {
    padding: 0.4rem 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    color: #e0e0e0;
    cursor: pointer;
    transition: all 0.2s;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .control-btn.active {
    background: rgba(99, 102, 241, 0.5);
    border-color: rgba(99, 102, 241, 0.8);
  }
</style>
