<script lang="ts">
  import { onMount } from 'svelte';
  import SP404TransportBar from './SP404TransportBar.svelte';
  import SP404WaveformEditor from './SP404WaveformEditor.svelte';
  import SP404ChopVisualizer from './SP404ChopVisualizer.svelte';
  import SP404StepGrid from './SP404StepGrid.svelte';
  import SP404VelocityLane from './SP404VelocityLane.svelte';

  const af = (window as any).audioforge;

  type Mode = 'edit' | 'sequence' | 'perform';
  let mode: Mode = 'edit';
  let playing = false;
  let bpm = 120;
  let midiConnected = false;
  let activeStep: number | null = null;
  let pattern: any = null;
  let selectedPartIndex = 0;
  let chops: any[] = [];
  let peaks: number[] = [];
  let filePath = '';
  let assetId = 0;
  let padRef = 'A01';
  let selectedChop: number | null = null;

  // Current part's velocities for velocity lane
  $: selectedPartVelocities = pattern?.parts[selectedPartIndex]?.steps?.map((s: any) => s.velocity) ?? Array(16).fill(100);

  onMount(async () => {
    // Load default pattern
    pattern = await af.sp404.pattern.load('P01');
    bpm = pattern?.bpm ?? 120;
  });

  async function handlePlay() {
    await af.sp404.transport.play();
    playing = true;
    // Internal clock for preview when no MIDI
    let step = 0;
    const interval = setInterval(() => {
      if (!playing) {
        clearInterval(interval);
        return;
      }
      activeStep = step;
      step = (step + 1) % 16;
    }, (60 / bpm / 4) * 1000);
  }

  async function handleStop() {
    await af.sp404.transport.stop();
    playing = false;
    activeStep = null;
  }

  async function handleBpmChange(e: CustomEvent<{ bpm: number }>) {
    bpm = e.detail.bpm;
    if (pattern) {
      pattern = { ...pattern, bpm };
      await af.sp404.pattern.save(pattern);
    }
    await af.sp404.transport.setBpm(bpm);
  }

  async function handleToggleStep(e: CustomEvent<{ partIndex: number; step: number }>) {
    const { partIndex, step } = e.detail;
    if (!pattern) return;
    const steps = [...pattern.parts[partIndex].steps];
    steps[step] = { ...steps[step], active: !steps[step].active };
    const parts = [...pattern.parts];
    parts[partIndex] = { ...parts[partIndex], steps };
    pattern = { ...pattern, parts };
    await af.sp404.pattern.setStep('P01', partIndex, step, { active: steps[step].active });
  }

  async function handleSetVelocity(e: CustomEvent<{ partIndex: number; step: number; velocity: number }>) {
    const { partIndex, step, velocity } = e.detail;
    if (!pattern) return;
    const steps = [...pattern.parts[partIndex].steps];
    steps[step] = { ...steps[step], velocity };
    const parts = [...pattern.parts];
    parts[partIndex] = { ...parts[partIndex], steps };
    pattern = { ...pattern, parts };
    await af.sp404.pattern.setVelocity('P01', partIndex, step, velocity);
  }

  function handleVelocityChange(e: CustomEvent<{ step: number; velocity: number }>) {
    if (!pattern) return;
    handleSetVelocity(new CustomEvent('setVelocity', {
      detail: { partIndex: selectedPartIndex, step: e.detail.step, velocity: e.detail.velocity }
    }));
  }

  function handleAddChop(e: CustomEvent<{ offset: number }>) {
    const newChop = {
      sourceAssetId: assetId,
      chopIndex: chops.length,
      startOffset: e.detail.offset,
      endOffset: Math.min(1, e.detail.offset + 0.1),
      crossfadeMs: 0,
      snapToZero: true,
    };
    chops = [...chops, newChop].sort((a, b) => a.startOffset - b.startOffset)
      .map((c, i) => ({ ...c, chopIndex: i }));
  }

  function handleMoveChop(e: CustomEvent<{ index: number; offset: number }>) {
    chops = chops.map((c, i) => i === e.detail.index ? { ...c, startOffset: e.detail.offset } : c);
  }

  function handleSelectChop(e: CustomEvent<{ index: number }>) {
    selectedChop = e.detail.index;
    selectedPartIndex = e.detail.index;
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault();
      playing ? handleStop() : handlePlay();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const modes: Mode[] = ['edit', 'sequence', 'perform'];
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (pattern) af.sp404.pattern.save(pattern);
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });
</script>

<div class="companion-view">
  <SP404TransportBar
    {bpm}
    {playing}
    {midiConnected}
    on:play={handlePlay}
    on:stop={handleStop}
    on:bpmChange={handleBpmChange}
  />

  <div class="mode-tabs">
    <button class="mode-tab" class:active={mode === 'edit'} on:click={() => mode = 'edit'}>Edit</button>
    <button class="mode-tab" class:active={mode === 'sequence'} on:click={() => mode = 'sequence'}>Sequence</button>
    <button class="mode-tab" class:active={mode === 'perform'} on:click={() => mode = 'perform'}>Perform</button>
  </div>

  <div class="mode-content">
    {#if mode === 'edit'}
      <div class="edit-layout">
        <div class="wave-section">
          <SP404WaveformEditor {filePath} {padRef} {assetId} />
        </div>
        <div class="chop-section">
          <div class="section-header">
            <span>Chop Visualizer</span>
            <span class="chop-count">{chops.length} chop{chops.length !== 1 ? 's' : ''}</span>
          </div>
          <SP404ChopVisualizer
            {peaks}
            {chops}
            {selectedChop}
            on:addChop={handleAddChop}
            on:moveChop={handleMoveChop}
            on:selectChop={handleSelectChop}
          />
        </div>
      </div>
    {:else if mode === 'sequence'}
      {#if pattern}
        <SP404StepGrid
          parts={pattern.parts}
          {activeStep}
          {playing}
          on:toggleStep={handleToggleStep}
          on:setVelocity={handleSetVelocity}
        />
        <SP404VelocityLane
          velocities={selectedPartVelocities}
          {activeStep}
          on:change={handleVelocityChange}
        />
      {:else}
        <div class="loading">Loading pattern…</div>
      {/if}
    {:else}
      <div class="perform-layout">
        <div class="perform-waveform">
          <SP404WaveformEditor {filePath} {padRef} {assetId} />
        </div>
        <div class="perform-info">
          <span class="big-bpm">{bpm} BPM</span>
          <span class="pad-ref">{padRef}</span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .companion-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0d0d1a;
    color: rgba(255,255,255,0.85);
    font-family: inherit;
    overflow: hidden;
  }
  .mode-tabs {
    display: flex;
    gap: 0;
    background: #13131f;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }
  .mode-tab {
    padding: 0.4rem 1.2rem;
    font-size: 0.82rem;
    font-weight: 500;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    transition: all 0.15s;
  }
  .mode-tab:hover {
    color: rgba(255,255,255,0.8);
  }
  .mode-tab.active {
    color: #64b5f6;
    border-bottom-color: #64b5f6;
  }
  .mode-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .edit-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .wave-section {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .chop-section {
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0.75rem;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.4);
    background: #10101c;
  }
  .chop-count {
    color: rgba(255,255,255,0.3);
  }
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255,255,255,0.3);
  }
  .perform-layout {
    display: flex;
    flex-direction: column;
    height: 100%;
    gap: 1rem;
    padding: 1rem;
  }
  .perform-waveform {
    flex: 1;
    min-height: 0;
  }
  .perform-info {
    display: flex;
    gap: 2rem;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }
  .big-bpm {
    font-size: 2rem;
    font-weight: 700;
    color: #64b5f6;
    font-variant-numeric: tabular-nums;
  }
  .pad-ref {
    font-size: 1.2rem;
    font-family: monospace;
    color: rgba(255,255,255,0.5);
  }
</style>
