<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ change: { step: number; velocity: number } }>();

  export let velocities: number[] = Array(16).fill(100);
  export let activeStep: number | null = null;

  let canvas: HTMLCanvasElement;
  let dragging = false;
  let hoverStep: number | null = null;

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;
    const stepW = w / 16;
    ctx.clearRect(0, 0, w, h);

    velocities.forEach((vel, i) => {
      const barH = (vel / 127) * (h - 16);
      const x = i * stepW;
      const isActive = i === activeStep;
      ctx.fillStyle = isActive ? '#64b5f6' : 'rgba(100,181,246,0.4)';
      ctx.fillRect(x + 2, h - barH - 8, stepW - 4, barH);
      // Hover label
      if (i === hoverStep) {
        ctx.fillStyle = '#fff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(vel), x + stepW / 2, h - barH - 10);
      }
    });
    // Step dividers
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(i * stepW, 0);
      ctx.lineTo(i * stepW, h);
      ctx.stroke();
    }
  }

  $: if (canvas) draw();
  $: velocities, activeStep, hoverStep, draw();

  onMount(() => {
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      draw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  });

  function getStepFromX(x: number) {
    return Math.min(15, Math.max(0, Math.floor((x / canvas.offsetWidth) * 16)));
  }

  function getVelocityFromY(y: number) {
    return Math.min(127, Math.max(0, Math.round((1 - y / canvas.offsetHeight) * 127)));
  }

  function handleMouseDown(e: MouseEvent) {
    dragging = true;
    const rect = canvas.getBoundingClientRect();
    const step = getStepFromX(e.clientX - rect.left);
    const vel = getVelocityFromY(e.clientY - rect.top);
    dispatch('change', { step, velocity: vel });
  }

  function handleMouseMove(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    hoverStep = getStepFromX(e.clientX - rect.left);
    if (dragging) {
      const step = getStepFromX(e.clientX - rect.left);
      const vel = getVelocityFromY(e.clientY - rect.top);
      dispatch('change', { step, velocity: vel });
    }
  }

  function handleMouseUp() {
    dragging = false;
  }

  function handleMouseLeave() {
    hoverStep = null;
    dragging = false;
  }
</script>

<div class="velocity-lane">
  <canvas
    bind:this={canvas}
    on:mousedown={handleMouseDown}
    on:mousemove={handleMouseMove}
    on:mouseup={handleMouseUp}
    on:mouseleave={handleMouseLeave}
    aria-label="Velocity lane — click and drag to set step velocities"
  ></canvas>
</div>

<style>
  .velocity-lane {
    width: 100%;
    height: 80px;
    background: #0e0e1a;
    cursor: crosshair;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
