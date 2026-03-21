<script lang="ts">
  import { onMount } from 'svelte';

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
  let errorMsg = '';

  async function fetchHealth() {
    phase = 'loading';
    health = null;
    try {
      const af = (window as any).audioforge;
      if (!af?.health) {
        phase = 'loaded';
        return;
      }
      health = await af.health.getStatus();
      phase = 'loaded';
    } catch (e: any) {
      errorMsg = e?.message ?? 'Unknown error';
      phase = 'error';
    }
  }

  onMount(fetchHealth);

  function formatMemory(bytes: number): string {
    return `${(bytes / (1024 ** 3)).toFixed(1)} GB`;
  }

  $: toolEntries = health ? Object.entries(health.tools) : [];
  $: availableCount = toolEntries.filter(([, s]) => s.available).length;
</script>

<div class="health-panel">
  <div class="panel-header">
    <h3>System Health</h3>
    {#if phase === 'loaded'}
      <button class="refresh-btn" on:click={fetchHealth}>Refresh</button>
    {/if}
  </div>

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
          {:else}
            <span class="status-unavailable">✗ not found</span>
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
</div>

<style>
  .health-panel {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 1.25rem;
    color: #e0e0e0;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #c0c0d0;
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
    color: #8080a0;
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
    color: #c0c0d0;
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
