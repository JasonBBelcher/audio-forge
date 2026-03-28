<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Toast {
    jobId: string;
    type: string;
    status: 'running' | 'completed' | 'failed';
    progress: number;
    error?: string;
    autoDismissTimer?: ReturnType<typeof setTimeout>;
  }

  // Individual analyze-audio jobs are too noisy — hundreds can fire at once.
  // Only show the batch job and other user-initiated job types.
  const SILENT_TYPES = new Set(['analyze-audio']);

  const TYPE_LABELS: Record<string, string> = {
    'analyze-audio-all':   'Analyzing library',
    'download-youtube':    'Downloading',
    'convert-audio':       'Converting audio',
    'separate-stems':      'Separating stems',
    'install-model':       'Installing model',
    'generate-audio':      'Generating audio',
    'audio-to-midi':       'Converting to MIDI',
    'install-basic-pitch': 'Installing basic-pitch',
    'sync-media':          'Syncing media',
  };

  function label(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  let toasts: Toast[] = [];
  let unsubscribers: Array<() => void> = [];

  function upsert(jobId: string, patch: Partial<Toast>): void {
    const idx = toasts.findIndex(t => t.jobId === jobId);
    if (idx >= 0) {
      toasts[idx] = { ...toasts[idx], ...patch };
      toasts = [...toasts];
    } else {
      toasts = [...toasts, { jobId, type: '', status: 'running', progress: 0, ...patch }];
    }
  }

  function dismiss(jobId: string): void {
    const t = toasts.find(t => t.jobId === jobId);
    if (t?.autoDismissTimer) clearTimeout(t.autoDismissTimer);
    toasts = toasts.filter(t => t.jobId !== jobId);
  }

  function scheduleDismiss(jobId: string, ms: number): void {
    const timer = setTimeout(() => dismiss(jobId), ms);
    const idx = toasts.findIndex(t => t.jobId === jobId);
    if (idx >= 0) {
      toasts[idx].autoDismissTimer = timer;
      toasts = [...toasts];
    }
  }

  async function retryJob(jobId: string): Promise<void> {
    const af = (window as any).audioforge;
    try {
      await af.jobs.retry(jobId);
      // Re-queue the job — reset to running state optimistically
      upsert(jobId, { status: 'running', progress: 0, error: undefined });
    } catch (e) {
      console.error('Retry failed:', e);
    }
  }

  onMount(() => {
    const af = (window as any).audioforge;
    if (!af?.on) return;

    unsubscribers.push(af.on('job:progress', (data: any) => {
      if (SILENT_TYPES.has(data.type)) return;
      upsert(data.jobId, {
        type: data.type ?? '',
        status: 'running',
        progress: data.progress ?? 0,
      });
    }));

    unsubscribers.push(af.on('job:complete', (data: any) => {
      if (SILENT_TYPES.has(data.type)) return;
      upsert(data.jobId, { type: data.type ?? '', status: 'completed', progress: 100 });
      scheduleDismiss(data.jobId, 3500);
    }));

    unsubscribers.push(af.on('job:failed', (data: any) => {
      if (SILENT_TYPES.has(data.type)) return;
      upsert(data.jobId, {
        type: data.type ?? '',
        status: 'failed',
        error: data.error,
      });
    }));
  });

  onDestroy(() => {
    toasts.forEach(t => { if (t.autoDismissTimer) clearTimeout(t.autoDismissTimer); });
    unsubscribers.forEach(u => u());
  });
</script>

{#if toasts.length > 0}
  <div class="toast-stack" role="region" aria-label="Job notifications">
    {#each toasts as toast (toast.jobId)}
      <div
        class="toast"
        class:running={toast.status === 'running'}
        class:completed={toast.status === 'completed'}
        class:failed={toast.status === 'failed'}
        role="status"
      >
        <div class="toast-top">
          <span class="toast-label">{label(toast.type)}</span>
          <div class="toast-actions">
            {#if toast.status === 'failed'}
              <button class="btn-retry" onclick={() => retryJob(toast.jobId)}>Retry</button>
            {/if}
            {#if toast.status !== 'running'}
              <button class="btn-dismiss" onclick={() => dismiss(toast.jobId)} aria-label="Dismiss">×</button>
            {/if}
          </div>
        </div>

        {#if toast.status === 'running'}
          <div class="progress-track">
            <div class="progress-fill" style="width: {toast.progress}%"></div>
          </div>
          <span class="progress-label">{toast.progress}%</span>
        {:else if toast.status === 'completed'}
          <span class="status-line ok">Done</span>
        {:else if toast.status === 'failed'}
          <p class="error-line">{toast.error ?? 'Failed'}</p>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-stack {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 300px;
    pointer-events: none;
  }

  .toast {
    pointer-events: all;
    background: #1e1e2e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    animation: slide-in 0.2s ease;
  }

  @keyframes slide-in {
    from { transform: translateX(20px); opacity: 0; }
    to   { transform: translateX(0);    opacity: 1; }
  }

  .toast.running  { border-left: 3px solid #6366f1; }
  .toast.completed { border-left: 3px solid #4ade80; }
  .toast.failed   { border-left: 3px solid #f87171; }

  .toast-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .toast-label {
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .toast-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .btn-retry {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid rgba(99, 102, 241, 0.5);
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-retry:hover { background: rgba(99, 102, 241, 0.3); }

  .btn-dismiss {
    font-size: 16px;
    line-height: 1;
    padding: 0 4px;
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.4);
    cursor: pointer;
    transition: color 0.15s;
  }
  .btn-dismiss:hover { color: rgba(255, 255, 255, 0.85); }

  .progress-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-label {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
  }

  .status-line {
    font-size: 12px;
  }
  .status-line.ok { color: #4ade80; }

  .error-line {
    margin: 0;
    font-size: 11px;
    color: #f87171;
    font-family: monospace;
    max-height: 80px;
    overflow-y: auto;
    word-break: break-word;
    white-space: pre-wrap;
  }
</style>
