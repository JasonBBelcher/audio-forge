<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface ToolStatus {
    available: boolean;
    version?: string;
  }

  interface HealthStatus {
    tools: Record<string, ToolStatus>;
    system: {
      platform: string;
      arch: string;
      memory: number;
    };
  }

  type Phase = 'loading' | 'loaded' | 'error';

  let phase: Phase = 'loading';
  let health: HealthStatus | null = null;
  let refreshing = false;
  let errorMsg = '';
  let unsubscribeUpdate: (() => void) | null = null;
  let collapsed = localStorage.getItem('health-panel-collapsed') === 'true';
  let installing: Record<string, boolean> = {};
  let installError: Record<string, string> = {};

  function toggleCollapsed() {
    collapsed = !collapsed;
    localStorage.setItem('health-panel-collapsed', String(collapsed));
  }

  async function installTool(name: string) {
    const af = (window as any).audioforge;
    installing = { ...installing, [name]: true };
    installError = { ...installError, [name]: '' };
    try {
      const freshStatus = await af.health.installTool(name);
      if (health) {
        health = { ...health, tools: { ...health.tools, [name]: freshStatus } };
      }
    } catch (e: any) {
      installError = { ...installError, [name]: e?.message ?? 'Installation failed' };
    } finally {
      installing = { ...installing, [name]: false };
    }
  }

  async function fetchHealth() {
    phase = 'loading';
    health = null;
    const af = (window as any).audioforge;
    try {
      if (!af?.health) {
        phase = 'loaded';
        return;
      }
      health = await af.health.getStatus();
      phase = 'loaded';
      // If a background refresh is running, show subtle indicator
      refreshing = true;
    } catch (e: any) {
      errorMsg = e?.message ?? 'Unknown error';
      phase = 'error';
    }
  }

  onMount(() => {
    fetchHealth();
    const af = (window as any).audioforge;
    if (af?.on) {
      unsubscribeUpdate = af.on('health:statusUpdate', (freshStatus: HealthStatus) => {
        health = freshStatus;
        refreshing = false;
      });
    }
  });

  onDestroy(() => {
    unsubscribeUpdate?.();
  });

  function formatMemory(bytes: number): string {
    return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
  }

  $: toolEntries = health ? Object.entries(health.tools) : [];
  $: availableCount = toolEntries.filter(([, s]) => s.available).length;
</script>

<div class="health-panel" class:collapsed>
  <div class="panel-header">
    <button class="collapse-btn" on:click={toggleCollapsed} aria-label={collapsed ? 'Expand' : 'Collapse'}>
      <span class="chevron" class:open={!collapsed}>›</span>
      <h3>System Health</h3>
      {#if phase === 'loaded' && !collapsed && refreshing}
        <span class="refreshing-dot" title="Refreshing…"></span>
      {/if}
    </button>
    {#if !collapsed && phase === 'loaded'}
      <button class="refresh-btn" on:click={fetchHealth}>Refresh</button>
    {/if}
  </div>

  {#if !collapsed}
    {#if phase === 'loading'}
      <div class="loading">
        <span class="spinner"></span>
        <span>Checking tools…</span>
      </div>
    {:else if phase === 'error'}
      <div class="error-state">
        <p class="error-msg">Health check error: {errorMsg}</p>
        <button class="retry-btn" on:click={fetchHealth}>Retry</button>
      </div>
    {:else if health}
      <div class="summary">
        <span class="summary-text">{availableCount} / {toolEntries.length} tools available</span>
      </div>

      <ul class="tool-list">
        {#each toolEntries as [name, status]}
          <li class="tool-row">
            <span class="tool-name">{name}</span>
            {#if status.available}
              <span class="status-available">✓</span>
              {#if status.version}
                <span class="tool-version">{status.version}</span>
              {/if}
            {:else if installing[name]}
              <span class="status-installing">Installing…</span>
            {:else}
              <span class="status-unavailable">✗ not found</span>
              <button class="install-btn" on:click={() => installTool(name)}>Install</button>
            {/if}
            {#if installError[name]}
              <span class="install-error" title={installError[name]}>⚠</span>
            {/if}
          </li>
        {/each}
      </ul>

      <div class="system-info">
        <span class="sys-item">Platform: <strong>{health.system.platform}</strong></span>
        <span class="sys-item">Arch: <strong>{health.system.arch}</strong></span>
        <span class="sys-item">RAM: <strong>{formatMemory(health.system.memory)}</strong></span>
      </div>
    {/if}
  {/if}
</div>

<style>
  .health-panel {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 1.25rem;
    color: var(--text-primary);
  }

  .health-panel.collapsed {
    padding-bottom: 0.25rem;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .health-panel.collapsed .panel-header {
    margin-bottom: 0;
  }

  .collapse-btn {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    flex: 1;
    text-align: left;
  }

  .chevron {
    display: inline-block;
    font-size: 1.1rem;
    color: #6060a0;
    transform: rotate(90deg);
    transition: transform 0.2s ease;
    line-height: 1;
    flex-shrink: 0;
  }

  .chevron.open {
    transform: rotate(-90deg);
  }

  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .refreshing-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #6366f1;
    opacity: 0.7;
    animation: pulse 1.2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.3; }
    50% { opacity: 0.9; }
  }

  .refresh-btn,
  .retry-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #a0a0b0;
    padding: 0.3rem 0.8rem;
    border-radius: 5px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .refresh-btn:hover,
  .retry-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .loading {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: #8080a0;
    font-size: 0.9rem;
    padding: 0.5rem 0;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.1);
    border-top-color: #6366f1;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-state {
    padding: 0.5rem 0;
  }

  .error-msg {
    color: #ff6b6b;
    font-size: 0.85rem;
    margin: 0 0 0.75rem;
  }

  .summary {
    margin-bottom: 0.75rem;
  }

  .summary-text {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .tool-list {
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .tool-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.85rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .tool-name {
    font-family: monospace;
    min-width: 90px;
    color: var(--text-primary);
  }

  .status-available {
    color: #4ade80;
    font-weight: bold;
    flex-shrink: 0;
  }

  .status-unavailable {
    color: #f87171;
    font-size: 0.8rem;
  }

  .status-installing {
    color: #a78bfa;
    font-size: 0.8rem;
    font-style: italic;
  }

  .install-btn {
    margin-left: auto;
    padding: 0.15rem 0.55rem;
    font-size: 0.75rem;
    background: rgba(99, 102, 241, 0.15);
    border: 1px solid rgba(99, 102, 241, 0.4);
    border-radius: 4px;
    color: #a5b4fc;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .install-btn:hover {
    background: rgba(99, 102, 241, 0.3);
    border-color: rgba(99, 102, 241, 0.7);
    color: #c7d2fe;
  }

  .install-error {
    color: #f87171;
    font-size: 0.85rem;
    cursor: help;
    flex-shrink: 0;
  }

  .tool-version {
    color: #6060a0;
    font-size: 0.78rem;
    font-family: monospace;
  }

  .system-info {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .sys-item {
    font-size: 0.8rem;
    color: #6060a0;
  }

  .sys-item strong {
    color: #9090b0;
  }
</style>
