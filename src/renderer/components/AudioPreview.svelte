<script lang="ts">
  import { onDestroy } from 'svelte';

  export let filePath: string = '';
  export let fileName: string = '';

  let audioContext: AudioContext | null = null;
  let audioBuffer: AudioBuffer | null = null;
  let sourceNode: AudioBufferSourceNode | null = null;
  let gainNode: GainNode | null = null;
  let isPlaying = false;
  let isPaused = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 0.8;
  let loading = false;
  let error: string | null = null;
  let animationFrameId: number | null = null;

  function fmt(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function loadAudio(): Promise<void> {
    if (!filePath) {
      return;
    }

    loading = true;
    error = null;

    try {
      // Initialize AudioContext if needed
      if (!audioContext) {
        audioContext = new (window as any).AudioContext();
      }

      // Fetch audio file
      const response = await fetch(`file://${filePath}`);
      const arrayBuffer = await response.arrayBuffer();

      // Decode audio data
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      duration = audioBuffer.duration;
      currentTime = 0;
    } catch (err: any) {
      error = err?.message || 'Failed to load audio file';
      audioBuffer = null;
      duration = 0;
      currentTime = 0;
    } finally {
      loading = false;
    }
  }

  function createAudioNodes(): void {
    if (!audioContext || !audioBuffer) return;

    // Create new source node
    sourceNode = audioContext.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // Create gain node if not exists
    if (!gainNode) {
      gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
    }

    // Set volume
    gainNode.gain.value = volume;

    // Connect source to gain
    sourceNode.connect(gainNode);

    // Handle playback end
    sourceNode.onended = () => {
      isPlaying = false;
      isPaused = false;
      currentTime = 0;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
  }

  function startPlayback(): void {
    if (!sourceNode || !audioContext || !audioBuffer) return;

    // Start from current time (offset)
    sourceNode.start(0, currentTime);
    isPlaying = true;
    isPaused = false;

    // Update time tracking
    const startTime = audioContext.currentTime;
    const playStartTime = currentTime;

    const updateTime = () => {
      if (!isPlaying) {
        return;
      }

      if (!audioContext) {
        isPlaying = false;
        return;
      }

      const elapsed = audioContext.currentTime - startTime;
      currentTime = playStartTime + elapsed;

      // Stop if we've reached the end
      if (currentTime >= duration) {
        currentTime = duration;
        isPlaying = false;
        isPaused = false;
        return;
      }

      animationFrameId = requestAnimationFrame(updateTime);
    };

    animationFrameId = requestAnimationFrame(updateTime);
  }

  function play(): void {
    if (!audioBuffer) return;

    if (isPaused) {
      // Resume from pause
      createAudioNodes();
      startPlayback();
    } else {
      // Start from beginning or current seek position
      createAudioNodes();
      startPlayback();
    }
  }

  function pause(): void {
    if (!sourceNode) return;

    sourceNode.stop();
    isPlaying = false;
    isPaused = true;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function stop(): void {
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {
        // Already stopped
      }
    }

    isPlaying = false;
    isPaused = false;
    currentTime = 0;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  function handlePlayPause(): void {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function handleSeek(e: Event): void {
    const target = e.target as HTMLInputElement;
    const newTime = parseFloat(target.value);

    // Stop current playback
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {
        // Already stopped
      }
    }

    currentTime = newTime;
    isPlaying = false;
    isPaused = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // If was playing, restart
    if (isPaused || isPlaying) {
      createAudioNodes();
      startPlayback();
    }
  }

  function handleVolumeChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    volume = parseFloat(target.value);

    if (gainNode) {
      gainNode.gain.value = volume;
    }
  }

  // Reactive: load audio when filePath changes
  $: if (filePath) {
    loadAudio();
  }

  onDestroy(() => {
    // Stop playback
    if (sourceNode) {
      try {
        sourceNode.stop();
      } catch {
        // Already stopped
      }
    }

    // Cancel animation frame
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
    }

    // Close audio context
    if (audioContext) {
      const closePromise = audioContext.close();
      if (closePromise && typeof closePromise.catch === 'function') {
        closePromise.catch(() => {
          // Already closed
        });
      }
    }
  });
</script>

<div class="audio-preview">
  <div class="player-bar">
    <!-- Play/Pause Button -->
    <button class="play-btn" on:click={handlePlayPause} disabled={!audioBuffer && !loading}>
      {isPlaying ? '⏸' : '▶'}
    </button>

    <!-- Filename -->
    <span class="filename">{fileName || 'No file selected'}</span>

    <!-- Seek Slider -->
    <input
      type="range"
      class="seek-input"
      min="0"
      max={duration || 0}
      value={currentTime}
      step="0.01"
      on:change={handleSeek}
      disabled={!audioBuffer}
    />

    <!-- Time Display -->
    <span class="time-display">{fmt(currentTime)} / {fmt(duration)}</span>

    <!-- Volume Icon -->
    <span class="volume-icon">🔊</span>

    <!-- Volume Slider -->
    <input
      type="range"
      class="volume-input"
      min="0"
      max="1"
      value={volume}
      step="0.01"
      on:change={handleVolumeChange}
    />
  </div>

  <!-- Loading/Error State -->
  {#if loading}
    <div class="loading-state">
      <span class="loading-text">loading audio...</span>
    </div>
  {/if}

  {#if error}
    <div class="error-state">
      <span class="error-text">error: {error}</span>
    </div>
  {/if}
</div>

<style>
  .audio-preview {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.75rem 1rem;
    box-sizing: border-box;
  }

  .player-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    height: 36px;
  }

  .play-btn {
    padding: 0.25rem 0.5rem;
    background: linear-gradient(45deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.2s;
    min-width: 36px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .play-btn:hover:not(:disabled) {
    background: linear-gradient(45deg, #4f46e5, #7c3aed);
    transform: scale(1.05);
  }

  .play-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .filename {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.85rem;
    font-weight: 500;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .seek-input {
    flex: 1;
    min-width: 200px;
    cursor: pointer;
    height: 4px;
  }

  .seek-input:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .time-display {
    color: rgba(255, 255, 255, 0.7);
    font-family: 'Monaco', 'Courier New', monospace;
    font-size: 0.8rem;
    min-width: 70px;
    text-align: right;
    flex-shrink: 0;
  }

  .volume-icon {
    font-size: 0.9rem;
    flex-shrink: 0;
  }

  .volume-input {
    width: 80px;
    cursor: pointer;
    height: 4px;
    flex-shrink: 0;
  }

  .loading-state {
    font-size: 0.75rem;
    color: rgba(100, 181, 246, 0.8);
    padding: 0.5rem 0;
  }

  .loading-text {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  .error-state {
    font-size: 0.75rem;
    color: #ff6b6b;
    padding: 0.5rem 0;
  }
</style>
