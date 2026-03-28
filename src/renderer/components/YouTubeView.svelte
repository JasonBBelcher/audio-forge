<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import Button from './ui/Button.svelte';

  type Phase = 'input' | 'fetching' | 'preview' | 'downloading' | 'done' | 'error';

  interface DownloadedItem {
    id: number;
    name: string;
    file_path: string;
    duration?: number;
    bpm?: number;
    key?: string;
    created_at: string;
  }

  let url = '';
  let phase: Phase = 'input';
  let errorMsg = '';
  let videoInfo: { title: string; duration: number; uploader?: string; thumbnail?: string } | null = null;
  let progress = 0;
  let progressText = '';
  let history: DownloadedItem[] = [];

  const af = (window as any).audioforge;
  let activeUnsubs: Array<() => void> = [];

  onMount(async () => {
    history = await af.files.listBySource('youtube');
  });

  onDestroy(() => {
    activeUnsubs.forEach(fn => fn());
    activeUnsubs = [];
  });

  function formatDuration(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  async function handleFetchInfo() {
    if (!url.trim()) return;
    phase = 'fetching';
    errorMsg = '';
    try {
      videoInfo = await af.youtube.getInfo(url.trim());
      phase = 'preview';
    } catch (e: any) {
      errorMsg = e.message?.includes('Invalid')
        ? 'Not a valid YouTube URL.'
        : 'Could not fetch video info. Is yt-dlp installed?';
      phase = 'error';
    }
  }

  async function handleDownload() {
    if (!videoInfo) return;
    phase = 'downloading';
    progress = 0;
    progressText = '';

    // Download into dedicated youtube subfolder
    const youtubeDir = await af.files.getYoutubeDir();
    const sessionId = `yt-view-${Date.now()}`;

    const unsubProgress = af.on('youtube:progress', (data: any) => {
      if (data.trackId === sessionId) {
        progress = data.percent;
        progressText = `${data.percent.toFixed(1)}% • ${data.speed} • ETA ${data.eta}`;
      }
    });
    activeUnsubs.push(unsubProgress);

    try {
      const result = await af.youtube.download(url.trim(), sessionId, youtubeDir, videoInfo.title);
      const jobId = result.jobId;

      const unsubComplete = af.on('job:complete', async (data: any) => {
        if (data.jobId !== jobId) return;
        unsubComplete();
        unsubFailed();
        unsubProgress();
        activeUnsubs = activeUnsubs.filter(fn => fn !== unsubProgress);

        const filePath = data.result.filePath;

        // Import into library tagged as source='youtube', stored in youtube subfolder
        try {
          await af.files.import([filePath], { source: 'youtube', destDir: youtubeDir });
        } catch { /* non-fatal */ }

        // Refresh history from DB
        history = await af.files.listBySource('youtube');
        phase = 'done';
      });

      const unsubFailed = af.on('job:failed', (data: any) => {
        if (data.jobId !== jobId) return;
        unsubComplete();
        unsubFailed();
        unsubProgress();
        activeUnsubs = activeUnsubs.filter(fn => fn !== unsubProgress);
        errorMsg = data.error || 'Download failed';
        phase = 'error';
      });

      activeUnsubs.push(unsubComplete, unsubFailed);
    } catch (e: any) {
      unsubProgress();
      errorMsg = e.message || 'Download failed';
      phase = 'error';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && phase === 'input') handleFetchInfo();
  }

  function reset() {
    url = '';
    phase = 'input';
    errorMsg = '';
    videoInfo = null;
    progress = 0;
    progressText = '';
  }
</script>

<div class="yt-view">
  <div class="yt-main">
    <div class="yt-header">
      <span class="yt-icon">▶</span>
      <div>
        <h2>YouTube Import</h2>
        <p class="subtitle">Download audio from any YouTube video into your library</p>
      </div>
    </div>

    <!-- URL input -->
    {#if phase === 'input' || phase === 'fetching'}
      <div class="url-card">
        <div class="url-row">
          <input
            type="url"
            bind:value={url}
            placeholder="https://youtube.com/watch?v=..."
            on:keydown={handleKeydown}
            disabled={phase === 'fetching'}
            class="url-input"
            autofocus
          />
          <Button variant="primary" on:click={handleFetchInfo} disabled={!url.trim() || phase === 'fetching'}>
            {phase === 'fetching' ? '…' : 'Fetch'}
          </Button>
        </div>
        {#if phase === 'fetching'}
          <div class="spinner-row">
            <div class="spinner"></div>
            <span>Fetching video info…</span>
          </div>
        {/if}
      </div>

    <!-- Preview -->
    {:else if phase === 'preview' && videoInfo}
      <div class="preview-card">
        {#if videoInfo.thumbnail}
          <img src={videoInfo.thumbnail} alt="thumbnail" class="thumb" />
        {/if}
        <div class="preview-info">
          <h3 class="video-title">{videoInfo.title}</h3>
          <p class="meta">
            {#if videoInfo.uploader}<span>{videoInfo.uploader}</span> · {/if}
            <span>{formatDuration(videoInfo.duration)}</span>
          </p>
          <p class="into-lib">Will be saved as WAV → added to Library</p>
        </div>
      </div>
      <div class="actions">
        <Button variant="secondary" on:click={reset}>← Back</Button>
        <Button variant="primary" on:click={handleDownload}>⬇ Download Audio</Button>
      </div>

    <!-- Downloading -->
    {:else if phase === 'downloading'}
      <div class="progress-card">
        <p class="progress-label">Downloading <strong>{videoInfo?.title}</strong>…</p>
        <div class="progress-track">
          <div class="progress-fill" style={`width: ${progress}%`}></div>
        </div>
        <p class="progress-text">{progressText || 'Starting…'}</p>
        <p class="note">yt-dlp is extracting audio — this may take a moment.</p>
      </div>

    <!-- Done -->
    {:else if phase === 'done'}
      <div class="done-card">
        <div class="done-icon">✅</div>
        <p><strong>{videoInfo?.title}</strong> added to Library</p>
        <Button variant="primary" on:click={reset}>Download Another</Button>
      </div>

    <!-- Error -->
    {:else if phase === 'error'}
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <p>{errorMsg}</p>
        {#if errorMsg.includes('yt-dlp')}
          <p class="install-hint">Install yt-dlp: <code>brew install yt-dlp</code></p>
        {/if}
        <Button variant="secondary" on:click={reset}>Try Again</Button>
      </div>
    {/if}
  </div>

  <!-- Persistent YouTube library -->
  <div class="history">
    <h4 class="history-title">YouTube Downloads ({history.length})</h4>
    {#if history.length === 0}
      <p class="history-empty">No downloads yet — paste a URL above to get started.</p>
    {:else}
      <ul class="history-list">
        {#each history as item}
          <li class="history-item">
            <span class="history-icon">🎵</span>
            <div class="history-info">
              <span class="history-name">{item.name}</span>
              <span class="history-meta">
                {#if item.bpm}<span>{Math.round(item.bpm)} BPM</span>{/if}
                {#if item.key}<span>{item.key}</span>{/if}
                {#if item.duration}<span>{formatDuration(Math.round(item.duration))}</span>{/if}
              </span>
            </div>
            <button class="reveal-btn" title="Reveal in Finder"
              on:click={() => af.files.revealInFinder(item.file_path)}>↗</button>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<style>
  .yt-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 2rem;
    gap: 2rem;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .yt-main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 600px;
    width: 100%;
  }

  .yt-header {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .yt-icon {
    width: 48px;
    height: 48px;
    background: #ef4444;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    flex-shrink: 0;
    color: #fff;
  }

  .yt-header h2 {
    margin: 0 0 0.25rem;
    font-size: 1.4rem;
  }

  .subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  /* Cards */
  .url-card,
  .preview-card,
  .progress-card,
  .done-card,
  .error-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .url-row {
    display: flex;
    gap: 0.75rem;
  }

  .url-input {
    flex: 1;
    background: var(--input-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    padding: 0.65rem 0.9rem;
    font-size: 0.9rem;
    min-width: 0;
  }

  .url-input:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
  }

  .url-input:disabled { opacity: 0.5; }

  .spinner-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(99, 102, 241, 0.3);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  /* Preview */
  .preview-card {
    flex-direction: row;
    align-items: flex-start;
  }

  .thumb {
    width: 140px;
    height: 79px;
    object-fit: cover;
    border-radius: 6px;
    flex-shrink: 0;
  }

  .preview-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .video-title {
    margin: 0;
    font-size: 0.95rem;
    line-height: 1.35;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .meta {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .into-lib {
    margin: 0;
    font-size: 0.8rem;
    color: #6366f1;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  /* Progress */
  .progress-label {
    margin: 0;
    font-size: 0.9rem;
  }

  .progress-track {
    background: var(--border);
    border-radius: 99px;
    height: 8px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 99px;
    transition: width 0.3s ease;
  }

  .progress-text {
    margin: 0;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .note {
    margin: 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  /* Done / Error */
  .done-card,
  .error-card {
    align-items: center;
    text-align: center;
  }

  .done-icon,
  .error-icon {
    font-size: 2.5rem;
  }

  .done-card p,
  .error-card p {
    margin: 0;
  }

  .error-card p { color: #f87171; }

  .install-hint {
    color: var(--text-secondary) !important;
    font-size: 0.85rem;
  }

  code {
    background: var(--bg-secondary);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }

  /* History */
  .history {
    max-width: 600px;
    width: 100%;
  }

  .history-title {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--text-muted);
  }

  .history-empty {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-muted);
  }

  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .history-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .history-icon { flex-shrink: 0; }

  .history-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .history-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text-primary);
  }

  .history-meta {
    display: flex;
    gap: 0.6rem;
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: monospace;
  }

  .reveal-btn {
    background: none;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text-muted);
    padding: 0.2rem 0.4rem;
    font-size: 0.8rem;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.15s;
  }

  .reveal-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }
</style>
