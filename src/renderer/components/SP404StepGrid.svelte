<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  export let parts: any[] = [];
  export let activeStep: number | null = null;
  export let playing: boolean = false;

  const dispatch = createEventDispatcher<{
    toggleStep: { partIndex: number; step: number };
    setVelocity: { partIndex: number; step: number; velocity: number };
  }>();

  let dragPartIndex: number | null = null;
  let dragStep: number | null = null;
  let dragStartY: number = 0;
  let dragStartVelocity: number = 100;

  function handleCellClick(partIndex: number, step: number) {
    dispatch('toggleStep', { partIndex, step });
  }

  function handleCellMouseDown(e: MouseEvent, partIndex: number, step: number, currentVelocity: number) {
    if (!parts[partIndex]?.steps[step]?.active) return;
    dragPartIndex = partIndex;
    dragStep = step;
    dragStartY = e.clientY;
    dragStartVelocity = currentVelocity;
    e.preventDefault();
  }

  function handleMouseMove(e: MouseEvent) {
    if (dragPartIndex === null || dragStep === null) return;
    const delta = Math.round((dragStartY - e.clientY) / 1.5);
    const newVel = Math.max(1, Math.min(127, dragStartVelocity + delta));
    dispatch('setVelocity', { partIndex: dragPartIndex, step: dragStep, velocity: newVel });
  }

  function handleMouseUp() {
    dragPartIndex = null;
    dragStep = null;
  }

  onMount(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  });
</script>

<div class="step-grid">
  <div class="grid-header">
    <div class="row-meta-spacer"></div>
    {#each Array(16) as _, i}
      <div class="step-header" class:playhead={i === activeStep}>{i + 1}</div>
    {/each}
  </div>

  {#each parts as part, partIndex}
    <div class="grid-row">
      <div class="row-meta">
        <div class="part-color" style="background:{part.color}"></div>
        <span class="part-label">{part.label}</span>
        <button
          class="mute-btn"
          class:muted={part.muted}
          on:click|stopPropagation={() => dispatch('toggleStep', { partIndex, step: -1 })}
          aria-label={part.muted ? 'Unmute' : 'Mute'}
          title={part.muted ? 'Unmute' : 'Mute'}
        >M</button>
      </div>
      {#each part.steps as stepData, step}
        <button
          class="step-cell"
          class:active={stepData.active}
          class:playhead={step === activeStep && playing}
          style={stepData.active ? `background-color:${part.color};opacity:${0.3 + 0.7 * (stepData.velocity / 127)}` : ''}
          on:click={() => handleCellClick(partIndex, step)}
          on:mousedown={(e) => handleCellMouseDown(e, partIndex, step, stepData.velocity)}
          aria-label={`Part ${partIndex + 1} step ${step + 1} ${stepData.active ? 'on' : 'off'}`}
          title={stepData.active ? `Velocity: ${stepData.velocity}` : ''}
        >
          {#if stepData.active}
            <span class="cell-dot"></span>
          {/if}
        </button>
      {/each}
    </div>
  {/each}
</div>

<style>
  .step-grid {
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: #0e0e1a;
    overflow-y: auto;
    flex: 1;
  }
  .grid-header {
    display: flex;
    align-items: center;
    background: #13131f;
    padding: 4px 0;
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .row-meta-spacer {
    width: 140px;
    flex-shrink: 0;
  }
  .step-header {
    flex: 1;
    text-align: center;
    font-size: 0.65rem;
    color: rgba(255,255,255,0.35);
    font-variant-numeric: tabular-nums;
    transition: color 0.1s;
  }
  .step-header.playhead {
    color: #64b5f6;
  }
  .grid-row {
    display: flex;
    align-items: center;
    gap: 1px;
    min-height: 36px;
  }
  .row-meta {
    width: 140px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 8px;
  }
  .part-color {
    width: 8px;
    height: 24px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  .part-label {
    flex: 1;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.7);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mute-btn {
    width: 18px;
    height: 18px;
    font-size: 0.6rem;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 2px;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mute-btn.muted {
    background: rgba(248,81,73,0.3);
    color: #f85149;
    border-color: #f85149;
  }
  .step-cell {
    flex: 1;
    height: 34px;
    min-width: 0;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 3px;
    cursor: pointer;
    position: relative;
    transition: background 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .step-cell:hover {
    background: rgba(255,255,255,0.08);
  }
  .step-cell.playhead {
    box-shadow: 0 0 0 1px rgba(100,181,246,0.5);
  }
  .cell-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255,255,255,0.9);
  }
  .step-cell.active .cell-dot {
    display: none;
  }
</style>
