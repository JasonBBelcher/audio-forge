<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ done: void }>();
  const af = (window as any).audioforge;

  interface ToolInfo {
    id: string;
    label: string;
    description: string;
    required: boolean;
  }

  const TOOLS: ToolInfo[] = [
    { id: 'ffmpeg',  label: 'FFmpeg',     description: 'Audio/video processing — required for almost everything', required: true },
    { id: 'sox',     label: 'SoX',        description: 'Audio format conversion and effects', required: false },
    { id: 'aubio',   label: 'Aubio',      description: 'BPM detection, onset analysis, beat grid', required: false },
    { id: 'yt-dlp',  label: 'yt-dlp',     description: 'YouTube and SoundCloud download', required: false },
    { id: 'demucs',  label: 'Demucs',     description: 'AI stem separation (vocals, drums, bass, other)', required: false },
  ];

  type ToolState = 'checking' | 'ok' | 'missing' | 'installing' | 'done' | 'error';

  interface ToolStatus {
    state: ToolState;
    version?: string;
    log: string[];
    error?: string;
  }

  let statuses: Record<string, ToolStatus> = Object.fromEntries(
    TOOLS.map(t => [t.id, { state: 'checking', log: [] }])
  );

  let overallDone = false;
  let anyInstalling = false;
  let removeProgressListener: (() => void) | null = null;

  onMount(async () => {
    // Listen for install progress lines streamed from main process
    removeProgressListener = af.health.onInstallProgress((toolId: string, line: string) => {
      if (!statuses[toolId]) return;
      statuses[toolId] = {
        ...statuses[toolId],
        log: [...(statuses[toolId].log ?? []), line].slice(-30),
      };
      statuses = statuses;
    });

    await checkAll();
  });

  onDestroy(() => {
    removeProgressListener?.();
  });

  async function checkAll() {
    const health = await af.health.getStatus();
    for (const tool of TOOLS) {
      const toolStatus = health.tools[tool.id];
      statuses[tool.id] = {
        state: toolStatus?.available ? 'ok' : 'missing',
        version: toolStatus?.version,
        log: [],
      };
    }
    statuses = statuses;
    updateOverallDone();
  }

  function updateOverallDone() {
    const requiredTools = TOOLS.filter(t => t.required);
    overallDone = requiredTools.every(t => statuses[t.id]?.state === 'ok' || statuses[t.id]?.state === 'done');
    anyInstalling = TOOLS.some(t => statuses[t.id]?.state === 'installing');
  }

  async function installTool(toolId: string) {
    statuses[toolId] = { ...statuses[toolId], state: 'installing', log: [], error: undefined };
    statuses = statuses;
    anyInstalling = true;

    try {
      const result = await af.health.installTool(toolId);
      statuses[toolId] = {
        state: result?.available ? 'done' : 'error',
        version: result?.version,
        log: statuses[toolId].log,
        error: result?.available ? undefined : 'Installation completed but tool still not detected.',
      };
    } catch (e) {
      statuses[toolId] = {
        ...statuses[toolId],
        state: 'error',
        error: (e as Error).message,
      };
    }

    statuses = statuses;
    anyInstalling = false;
    updateOverallDone();
  }

  async function installAll() {
    const missing = TOOLS.filter(t => statuses[t.id]?.state === 'missing' || statuses[t.id]?.state === 'error');
    for (const tool of missing) {
      await installTool(tool.id);
    }
  }

  function handleDone() {
    af.settings.set('setupComplete', true);
    dispatch('done');
  }

  const STATE_ICON: Record<ToolState, string> = {
    checking: '…',
    ok: '✓',
    missing: '○',
    installing: '⟳',
    done: '✓',
    error: '✕',
  };
</script>

<div class="wizard-backdrop">
  <div class="wizard">
    <div class="wizard-header">
      <div class="logo">🎛 AudioForge</div>
      <h1>First-time setup</h1>
      <p class="subtitle">AudioForge needs a few command-line tools to power audio processing and analysis. We'll install them for you.</p>
    </div>

    <div class="tool-list">
      {#each TOOLS as tool}
        {@const s = statuses[tool.id]}
        <div class="tool-row" class:ok={s.state === 'ok' || s.state === 'done'} class:error={s.state === 'error'}>
          <div class="tool-indicator" class:spin={s.state === 'installing'}>
            {STATE_ICON[s.state]}
          </div>

          <div class="tool-info">
            <div class="tool-name">
              {tool.label}
              {#if tool.required}<span class="required-badge">required</span>{/if}
              {#if s.version}<span class="version">{s.version}</span>{/if}
            </div>
            <div class="tool-desc">{tool.description}</div>

            {#if s.state === 'installing' && s.log.length > 0}
              <pre class="install-log">{s.log.join('\n')}</pre>
            {/if}

            {#if s.state === 'error'}
              <div class="error-msg">{s.error}</div>
            {/if}
          </div>

          <div class="tool-action">
            {#if s.state === 'missing' || s.state === 'error'}
              <button class="install-btn" disabled={anyInstalling} on:click={() => installTool(tool.id)}>
                {s.state === 'error' ? 'Retry' : 'Install'}
              </button>
            {:else if s.state === 'installing'}
              <span class="installing-label">Installing…</span>
            {:else if s.state === 'ok' || s.state === 'done'}
              <span class="ok-label">Ready</span>
            {:else}
              <span class="checking-label">Checking…</span>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    <div class="wizard-footer">
      {#if TOOLS.some(t => statuses[t.id]?.state === 'missing' || statuses[t.id]?.state === 'error')}
        <button class="install-all-btn" disabled={anyInstalling} on:click={installAll}>
          {anyInstalling ? 'Installing…' : 'Install All Missing'}
        </button>
      {/if}

      <div class="footer-right">
        <button class="skip-btn" on:click={handleDone}>
          {overallDone ? 'Skip' : 'Skip for now'}
        </button>
        <button
          class="done-btn"
          disabled={!overallDone && TOOLS.filter(t => t.required).some(t => statuses[t.id]?.state === 'missing')}
          on:click={handleDone}
        >
          {overallDone ? 'Get started →' : 'Continue anyway →'}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .wizard-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0, 0, 0, 0.75);
    display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
  }

  .wizard {
    width: 560px; max-height: 90vh;
    background: #16162a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex; flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  }

  .wizard-header {
    padding: 2rem 2rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  .logo {
    font-size: 1.5rem; margin-bottom: 0.75rem;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: 1.3rem; font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.5);
    line-height: 1.5;
  }

  .tool-list {
    flex: 1; overflow-y: auto;
    padding: 0.75rem 0;
  }

  .tool-row {
    display: flex; align-items: flex-start; gap: 1rem;
    padding: 0.85rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    transition: background 0.15s;
  }

  .tool-row.ok { background: rgba(63, 185, 80, 0.04); }
  .tool-row.error { background: rgba(248, 81, 73, 0.05); }

  .tool-indicator {
    width: 24px; height: 24px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.9rem; font-weight: 700;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.4);
    margin-top: 1px;
  }

  .tool-row.ok .tool-indicator { background: rgba(63, 185, 80, 0.15); color: #3fb950; }
  .tool-row.error .tool-indicator { background: rgba(248, 81, 73, 0.15); color: #f85149; }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }

  .spin { animation: spin 1s linear infinite; }

  .tool-info { flex: 1; min-width: 0; }

  .tool-name {
    display: flex; align-items: center; gap: 0.5rem;
    font-size: 0.9rem; font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 0.2rem;
  }

  .required-badge {
    font-size: 0.65rem; font-weight: 700;
    background: rgba(100, 181, 246, 0.15);
    border: 1px solid rgba(100, 181, 246, 0.3);
    color: #64b5f6; border-radius: 3px;
    padding: 0 0.35rem; line-height: 1.6;
    text-transform: uppercase; letter-spacing: 0.04em;
  }

  .version {
    font-size: 0.72rem; font-family: monospace;
    color: rgba(255, 255, 255, 0.35);
    font-weight: 400;
  }

  .tool-desc {
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.4);
    line-height: 1.4;
  }

  .install-log {
    margin: 0.5rem 0 0;
    font-size: 0.68rem; font-family: monospace;
    color: rgba(255, 255, 255, 0.4);
    background: rgba(0, 0, 0, 0.3);
    border-radius: 4px; padding: 0.4rem 0.6rem;
    max-height: 80px; overflow-y: auto;
    white-space: pre-wrap; word-break: break-all;
  }

  .error-msg {
    margin-top: 0.3rem;
    font-size: 0.75rem; color: #f85149;
  }

  .tool-action {
    flex-shrink: 0;
    display: flex; align-items: center;
    padding-top: 1px;
  }

  .install-btn {
    padding: 0.3rem 0.8rem; font-size: 0.8rem;
    background: rgba(100, 181, 246, 0.15);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 5px; color: #64b5f6; cursor: pointer;
    transition: background 0.15s;
  }

  .install-btn:hover:not(:disabled) { background: rgba(100, 181, 246, 0.25); }
  .install-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .installing-label { font-size: 0.78rem; color: rgba(255, 255, 255, 0.4); }
  .ok-label { font-size: 0.78rem; color: #3fb950; }
  .checking-label { font-size: 0.78rem; color: rgba(255, 255, 255, 0.3); }

  .wizard-footer {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.25rem 2rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    gap: 1rem;
  }

  .footer-right {
    display: flex; align-items: center; gap: 0.75rem; margin-left: auto;
  }

  .install-all-btn {
    padding: 0.45rem 1.1rem; font-size: 0.82rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px; color: rgba(255, 255, 255, 0.7); cursor: pointer;
    transition: all 0.15s;
  }

  .install-all-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .install-all-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .skip-btn {
    padding: 0.45rem 1rem; font-size: 0.82rem;
    background: transparent; border: none;
    color: rgba(255, 255, 255, 0.35); cursor: pointer;
    transition: color 0.15s;
  }

  .skip-btn:hover { color: rgba(255, 255, 255, 0.6); }

  .done-btn {
    padding: 0.5rem 1.4rem; font-size: 0.85rem; font-weight: 600;
    background: #64b5f6; border: none;
    border-radius: 6px; color: #0d0d1a; cursor: pointer;
    transition: background 0.15s;
  }

  .done-btn:hover:not(:disabled) { background: #90caf9; }
  .done-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
