<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ play: void; stop: void; bpmChange: { bpm: number } }>();

  export let bpm: number = 120;
  export let playing: boolean = false;
  export let midiConnected: boolean = false;

  let localBpm = bpm;
  $: localBpm = bpm;

  function handlePlay() {
    dispatch('play');
  }

  function handleStop() {
    dispatch('stop');
  }

  function handleBpmChange() {
    const val = Math.max(20, Math.min(300, localBpm));
    localBpm = val;
    dispatch('bpmChange', { bpm: val });
  }
</script>

<div class="transport-bar">
  <button class="transport-btn" class:active={playing} on:click={handlePlay} aria-label="Play" title="Play">▶</button>
  <button class="transport-btn" on:click={handleStop} aria-label="Stop" title="Stop">■</button>
  <div class="bpm-control">
    <label for="companion-bpm">BPM</label>
    <input id="companion-bpm" type="number" min="20" max="300" step="1" bind:value={localBpm} on:change={handleBpmChange} />
  </div>
  <div class="sync-dot" class:connected={midiConnected} title={midiConnected ? 'MIDI clock locked' : 'MIDI disconnected'}></div>
  <span class="sync-label">{midiConnected ? 'MIDI' : 'FREE'}</span>
</div>

<style>
  .transport-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #13131f;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    height: 44px;
    flex-shrink: 0;
  }
  .transport-btn {
    width: 32px;
    height: 32px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    font-size: 0.85rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }
  .transport-btn:hover {
    background: rgba(255,255,255,0.12);
  }
  .transport-btn.active {
    background: rgba(100,181,246,0.2);
    border-color: #64b5f6;
    color: #64b5f6;
  }
  .bpm-control {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: 0.5rem;
  }
  .bpm-control label {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
  }
  .bpm-control input {
    width: 60px;
    padding: 0.25rem 0.4rem;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 4px;
    color: #fff;
    font-size: 0.85rem;
    text-align: center;
  }
  .sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #f85149;
    margin-left: auto;
    transition: background 0.3s;
  }
  .sync-dot.connected {
    background: #3fb950;
  }
  .sync-label {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.4);
    min-width: 2.5rem;
  }
</style>
