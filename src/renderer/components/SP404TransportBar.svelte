<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    play: void;
    stop: void;
    bpmChange: { bpm: number };
    midiSetup: void;
  }>();

  export let bpm: number = 120;
  export let playing: boolean = false;
  export let midiConnected: boolean = false;
  export let midiPortName: string | null = null;
  export let syncSource: 'hardware' | 'app' | 'free' = 'free';

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

  function handleMidiSetup() {
    dispatch('midiSetup');
  }

  function truncatePortName(name: string | null, max: number): string {
    if (!name) return 'FREE';
    return name.length > max ? name.slice(0, max) + '\u2026' : name;
  }

  $: dotClass = !midiConnected
    ? 'dot dot--red'
    : syncSource === 'hardware'
    ? 'dot dot--green'
    : 'dot dot--yellow';

  $: indicatorLabel = !midiConnected
    ? 'FREE'
    : syncSource === 'hardware'
    ? truncatePortName(midiPortName, 14)
    : 'APP';

  $: indicatorTitle = !midiConnected
    ? 'No MIDI clock — using internal clock'
    : syncSource === 'hardware'
    ? `MIDI clock locked: ${midiPortName ?? 'unknown'}`
    : `App is MIDI clock master: ${midiPortName ?? 'unknown'}`;
</script>

<div class="transport-bar">
  <button class="transport-btn" class:active={playing} on:click={handlePlay} aria-label="Play" title="Play">&#9654;</button>
  <button class="transport-btn" on:click={handleStop} aria-label="Stop" title="Stop">&#9632;</button>
  <div class="bpm-control">
    <label for="companion-bpm">BPM</label>
    <input id="companion-bpm" type="number" min="20" max="300" step="1" bind:value={localBpm} on:change={handleBpmChange} />
  </div>

  <div class="midi-indicator" title={indicatorTitle}>
    <span class={dotClass}></span>
    <span class="midi-port-label">{indicatorLabel}</span>
  </div>

  <button
    class="midi-setup-btn"
    on:click={handleMidiSetup}
    aria-label="MIDI port setup"
    title="Configure MIDI ports"
  >&#128268;</button>
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

  .midi-indicator {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    margin-left: auto;
    cursor: default;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background 0.3s;
  }
  .dot--green  { background: #3fb950; }
  .dot--yellow { background: #d29922; }
  .dot--red    { background: #f85149; }

  .midi-port-label {
    font-size: 0.7rem;
    color: rgba(255,255,255,0.45);
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .midi-setup-btn {
    width: 26px;
    height: 26px;
    background: transparent;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 4px;
    color: rgba(255,255,255,0.45);
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .midi-setup-btn:hover {
    background: rgba(100,181,246,0.12);
    color: #64b5f6;
    border-color: rgba(100,181,246,0.4);
  }
</style>
