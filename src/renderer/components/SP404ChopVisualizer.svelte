<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    selectChop: { index: number };
    moveChop: { index: number; offset: number };
    addChop: { offset: number };
  }>();

  export let peaks: number[] = [];
  export let chops: any[] = [];
  export let selectedChop: number | null = null;

  const PAD_COLORS = [
    '#e53935','#8e24aa','#1e88e5','#00acc1','#43a047',
    '#fb8c00','#fdd835','#6d4c41','#546e7a','#ec407a',
    '#7e57c2','#26a69a','#9ccc65','#ffca28','#42a5f5','#ab47bc'
  ];

  let canvas: HTMLCanvasElement;
  let draggingChopIndex: number | null = null;
  let dragStartX = 0;
  let dragStartOffset = 0;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Draw waveform peaks
    if (peaks.length > 0) {
      const step = peaks.length / w;
      ctx.fillStyle = 'rgba(100,181,246,0.3)';
      for (let x = 0; x < w; x++) {
        const idx = Math.floor(x * step);
        const peak = Math.abs(peaks[idx] ?? 0);
        const barH = peak * (h * 0.8);
        ctx.fillRect(x, h / 2 - barH / 2, 1, barH);
      }
    } else {
      // Flat line when no peaks
      ctx.strokeStyle = 'rgba(100,181,246,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
    }

    // Color-fill each chop region
    if (chops.length > 0) {
      const allBounds = [0, ...chops.map(c => c.startOffset).sort((a: number, b: number) => a - b), 1];
      allBounds.forEach((bound: number, i: number) => {
        if (i === allBounds.length - 1) return;
        const nextBound = allBounds[i + 1];
        const x1 = bound * w;
        const x2 = nextBound * w;
        ctx.fillStyle = (PAD_COLORS[i % PAD_COLORS.length]) + '33';
        ctx.fillRect(x1, 0, x2 - x1, h);
        // Pad label
        ctx.fillStyle = PAD_COLORS[i % PAD_COLORS.length];
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        const bank = String.fromCharCode(65 + Math.floor(i / 16));
        const padNum = (i % 16) + 1;
        ctx.fillText(`${bank}${padNum}`, (x1 + x2) / 2, 14);
      });
    }

    // Draw chop boundary lines
    chops.forEach((chop: any, i: number) => {
      const x = chop.startOffset * w;
      const isSelected = i === selectedChop;
      ctx.strokeStyle = isSelected ? '#fff' : PAD_COLORS[i % PAD_COLORS.length];
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    });
  }

  $: peaks, chops, selectedChop, draw();

  onMount(() => {
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  });

  function getOffsetFromX(x: number) {
    return Math.max(0, Math.min(1, x / canvas.offsetWidth));
  }

  function findChopAtX(x: number): number {
    const offset = getOffsetFromX(x);
    const threshold = 8 / canvas.offsetWidth;
    return chops.findIndex((c: any) => Math.abs(c.startOffset - offset) < threshold);
  }

  function handleDblClick(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const offset = getOffsetFromX(e.clientX - rect.left);
    dispatch('addChop', { offset });
  }

  function handleMouseDown(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chopIdx = findChopAtX(x);
    if (chopIdx !== -1) {
      draggingChopIndex = chopIdx;
      dragStartX = x;
      dragStartOffset = chops[chopIdx].startOffset;
      dispatch('selectChop', { index: chopIdx });
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (draggingChopIndex === null) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const delta = (x - dragStartX) / canvas.offsetWidth;
    const newOffset = Math.max(0.001, Math.min(0.999, dragStartOffset + delta));
    dispatch('moveChop', { index: draggingChopIndex, offset: newOffset });
  }

  function handleMouseUp() {
    draggingChopIndex = null;
  }
</script>

<div class="chop-viz">
  <canvas
    bind:this={canvas}
    on:dblclick={handleDblClick}
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseUp}
    aria-label="Chop visualizer — double-click to add chop, drag dividers to move"
  ></canvas>
</div>

<style>
  .chop-viz {
    width: 100%;
    height: 120px;
    background: #0a0a14;
    cursor: crosshair;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
