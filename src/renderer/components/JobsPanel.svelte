<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Job {
    id: string;
    type: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    payload: Record<string, unknown>;
    error?: string;
    createdAt: string;
  }

  const POLL_INTERVAL = 3000;

  let jobs: Job[] = [];
  let loading = true;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function fetchJobs() {
    const af = (window as any).audioforge;
    if (!af?.jobs) {
      loading = false;
      return;
    }
    try {
      jobs = await af.jobs.list();
    } catch {
      // silently keep stale list on poll errors
    } finally {
      loading = false;
    }
  }

  async function cancelJob(id: string) {
    const af = (window as any).audioforge;
    if (!af?.jobs) return;
    await af.jobs.cancel(id);
    await fetchJobs();
  }

  onMount(() => {
    fetchJobs();
    pollTimer = setInterval(fetchJobs, POLL_INTERVAL);
  });

  onDestroy(() => {
    if (pollTimer !== null) clearInterval(pollTimer);
  });

  function isCancellable(status: Job['status']): boolean {
    return status === 'pending' || status === 'running';
  }

  function statusClass(status: Job['status']): string {
    const map: Record<Job['status'], string> = {
      pending: 'status-pending',
      running: 'status-running',
      completed: 'status-completed',
      failed: 'status-failed',
      cancelled: 'status-cancelled',
    };
    return map[status] ?? '';
  }

  $: activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'pending');
  $: finishedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');
</script>

<div class="jobs-panel">
  <div class="panel-header">
    <h3>Jobs</h3>
    {#if jobs.length > 0}
      <span class="job-count">{activeJobs.length} active</span>
    {/if}
  </div>

  {#if loading}
    <div class="loading">
      <span class="spinner"></span>
    </div>
  {:else if jobs.length === 0}
    <p class="empty-state">No active jobs</p>
  {:else}
    <ul class="job-list">
      {#each jobs as job (job.id)}
        <li class="job-row">
          <div class="job-header">
            <span class="job-type">{job.type}</span>
            <span class="job-status {statusClass(job.status)}">{job.status}</span>
            {#if isCancellable(job.status)}
              <button class="cancel-btn" on:click={() => cancelJob(job.id)}>Cancel</button>
            {/if}
          </div>

          {#if job.status === 'running' || job.status === 'pending'}
            <div class="progress-track">
              <div class="progress-bar" style="width: {job.progress}%"></div>
            </div>
            <span class="progress-text">{job.progress}%</span>
          {/if}

          {#if job.status === 'failed' && job.error}
            <p class="job-error">{job.error}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .jobs-panel {
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

  .job-count {
    font-size: 0.8rem;
    color: #6366f1;
    background: rgba(99, 102, 241, 0.1);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .loading {
    display: flex;
    justify-content: center;
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
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .empty-state {
    color: #505060;
    font-size: 0.85rem;
    margin: 0;
    padding: 0.5rem 0;
  }

  .job-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .job-row {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 7px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .job-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .job-type {
    font-family: monospace;
    font-size: 0.85rem;
    color: #c0c0d0;
    flex: 1;
  }

  .job-status {
    font-size: 0.78rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    text-transform: capitalize;
  }

  .status-running {
    background: rgba(99, 102, 241, 0.15);
    color: #818cf8;
  }

  .status-pending {
    background: rgba(250, 204, 21, 0.1);
    color: #fbbf24;
  }

  .status-completed {
    background: rgba(74, 222, 128, 0.1);
    color: #4ade80;
  }

  .status-failed {
    background: rgba(248, 113, 113, 0.1);
    color: #f87171;
  }

  .status-cancelled {
    background: rgba(100, 100, 120, 0.1);
    color: #707080;
  }

  .cancel-btn {
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.2);
    color: #f87171;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .cancel-btn:hover {
    background: rgba(248, 113, 113, 0.18);
  }

  .progress-track {
    height: 4px;
    background: rgba(255, 255, 255, 0.07);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #6366f1, #8b5cf6);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .progress-text {
    font-size: 0.78rem;
    color: #6060a0;
  }

  .job-error {
    margin: 0;
    font-size: 0.8rem;
    color: #f87171;
    font-family: monospace;
  }
</style>
