<script lang="ts">
  import { onMount } from 'svelte';

  export let peaks: number[] = [];
  export let width: number = 80;
  export let height: number = 24;
  export let color: string = '#6366f1';

  let canvas: HTMLCanvasElement | undefined;

  onMount(() => {
    drawWaveform();
  });

  // Re-draw when peaks change
  $: if (peaks) {
    drawWaveform();
  }

  function drawWaveform(): void {
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (peaks.length === 0) {
      // Draw centerline when no peaks
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    // Calculate bar dimensions
    const barWidth = Math.max(1, Math.floor(width / Math.max(peaks.length, 1)) - 1);
    const barSpacing = width / peaks.length;

    // Set fill color
    ctx.fillStyle = color;

    // Draw bars for each peak
    for (let i = 0; i < peaks.length; i++) {
      const peak = Math.abs(peaks[i]); // Ensure positive value
      const barHeight = peak * height;
      const x = i * barSpacing;
      const y = (height - barHeight) / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  }
</script>

<canvas bind:this={canvas} {width} {height}></canvas>

<style>
  canvas {
    display: block;
  }
</style>
