<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  export let buffer: AudioBuffer | null = null;
  export let currentTime: number = 0;
  export let duration: number = 0;
  export let color: string = '#6366f1';
  export let height: number = 60;

  let canvas: HTMLCanvasElement;
  let animFrame: number;
  let peaks: Float32Array = new Float32Array(0);

  $: if (buffer) computePeaks(buffer);
  $: if (canvas && peaks.length) drawWaveform();
  $: if (canvas) drawPlayhead();

  function computePeaks(buf: AudioBuffer) {
    const data = buf.getChannelData(0);
    const samples = canvas?.width || 400;
    const blockSize = Math.floor(data.length / samples);
    peaks = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(data[i * blockSize + j]);
        if (val > max) max = val;
      }
      peaks[i] = max;
    }
  }

  function drawWaveform() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height: h } = canvas;
    ctx.clearRect(0, 0, width, h);

    const mid = h / 2;
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, color + 'cc');
    gradient.addColorStop(0.5, color);
    gradient.addColorStop(1, color + 'cc');

    ctx.beginPath();
    ctx.fillStyle = gradient;

    for (let i = 0; i < peaks.length; i++) {
      const x = i;
      const peakH = peaks[i] * mid * 0.9;
      ctx.fillRect(x, mid - peakH, 1, peakH * 2);
    }

    drawPlayhead();
  }

  function drawPlayhead() {
    if (!canvas || !duration) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous playhead by redrawing just the waveform (avoid infinite loop)
    const { width, height: h } = canvas;
    const ratio = currentTime / duration;
    const x = Math.floor(ratio * width);

    // Dim played region
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, x, h);

    // Playhead line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, 0, 2, h);
  }

  onMount(() => {
    const ro = new ResizeObserver(() => {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = height;
      if (buffer) computePeaks(buffer);
      else {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        drawEmptyState();
      }
    });
    ro.observe(canvas.parentElement!);
    canvas.width = canvas.offsetWidth || 400;
    canvas.height = height;
    drawEmptyState();

    return () => ro.disconnect();
  });

  function drawEmptyState() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height: h } = canvas;
    ctx.clearRect(0, 0, width, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([4, 8]);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(width, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '11px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('↑ Load audio', width / 2, h / 2 + 4);
  }

  $: {
    if (canvas && peaks.length && duration > 0) {
      drawWaveform();
    }
  }
</script>

<div class="waveform-wrap" style={`height: ${height}px`}>
  <canvas bind:this={canvas} class="waveform-canvas"></canvas>
</div>

<style>
  .waveform-wrap {
    width: 100%;
    overflow: hidden;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.25);
    flex: 1;
  }

  .waveform-canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
