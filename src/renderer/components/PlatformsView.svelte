<script lang="ts">
  import { onMount } from 'svelte';

  interface Platform {
    id: string;
    name: string;
    status: 'authorized' | 'unauthorized';
  }

  let platforms: Platform[] = [];
  let isLoading: boolean = true;
  let showConnectForm: boolean = false;
  let newPlatformName: string = '';

  onMount(async () => {
    isLoading = true;
    try {
      if ((window as any).audioforge?.platforms?.list) {
        platforms = await (window as any).audioforge.platforms.list();
      } else {
        platforms = [];
      }
    } catch (error) {
      console.error('Failed to list platforms:', error);
      platforms = [];
    } finally {
      isLoading = false;
    }
  });

  function handleConnectClick() {
    showConnectForm = true;
  }

  async function handleConnectSubmit() {
    if (!newPlatformName.trim()) return;

    try {
      if ((window as any).audioforge?.platforms?.register) {
        await (window as any).audioforge.platforms.register({ name: newPlatformName });
        // Refresh platforms list
        if ((window as any).audioforge?.platforms?.list) {
          platforms = await (window as any).audioforge.platforms.list();
        }
      }
      showConnectForm = false;
      newPlatformName = '';
    } catch (error) {
      console.error('Failed to register platform:', error);
    }
  }

  function getStatusClass(status: string): string {
    return `status-${status}`;
  }

  function handlePublishHistory(platformId: string) {
    if ((window as any).audioforge?.platforms?.getHistory) {
      (window as any).audioforge.platforms.getHistory(platformId);
    }
  }
</script>

<div class="platforms-view">
  <h2>Platforms</h2>

  {#if isLoading}
    <div class="loading">Loading platforms...</div>
  {:else if platforms.length === 0}
    <div class="empty-state">
      <p>No platform integrations configured</p>
    </div>
  {:else}
    <div class="platforms-list">
      {#each platforms as platform (platform.id)}
        <div class="platform-item">
          <div class="platform-header">
            <span class="name">{platform.name}</span>
            <span class={`badge ${getStatusClass(platform.status)}`}>{platform.status}</span>
          </div>
          {#if platform.status === 'authorized'}
            <button class="history-btn" onclick={() => handlePublishHistory(platform.id)}>
              Publish History
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="connect-section">
    {#if !showConnectForm}
      <button onclick={handleConnectClick}>Connect Platform</button>
    {:else}
      <div class="connect-form">
        <div class="form-group">
          <label for="platform-name">Platform Name:</label>
          <input
            id="platform-name"
            type="text"
            bind:value={newPlatformName}
            placeholder="Enter platform name"
          />
        </div>
        <div class="form-actions">
          <button onclick={handleConnectSubmit}>Connect</button>
          <button
            onclick={() => {
              showConnectForm = false;
              newPlatformName = '';
            }}
            class="cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .platforms-view {
    padding: 16px;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  h2 {
    margin: 0 0 20px 0;
    font-size: 16px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .loading {
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    padding: 12px;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
  }

  .empty-state p {
    margin: 0;
  }

  .platforms-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 20px;
  }

  .platform-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
  }

  .platform-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .name {
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
  }

  .badge {
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 3px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .status-authorized {
    background: rgba(76, 175, 80, 0.2);
    color: #4caf50;
  }

  .status-unauthorized {
    background: rgba(244, 67, 54, 0.2);
    color: #f44336;
  }

  .history-btn {
    width: 100%;
    padding: 6px 8px;
    background: rgba(100, 181, 246, 0.2);
    border: 1px solid rgba(100, 181, 246, 0.4);
    border-radius: 3px;
    color: #64b5f6;
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .history-btn:hover {
    background: rgba(100, 181, 246, 0.3);
    border-color: rgba(100, 181, 246, 0.6);
  }

  .connect-section {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
  }

  .connect-section > button {
    width: 100%;
    padding: 8px 12px;
    background: #64b5f6;
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .connect-section > button:hover {
    background: #42a5f5;
  }

  .connect-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  label {
    font-size: 11px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  input {
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
  }

  input:focus {
    outline: none;
    border-color: #64b5f6;
    background: rgba(255, 255, 255, 0.08);
  }

  .form-actions {
    display: flex;
    gap: 8px;
  }

  .form-actions button {
    flex: 1;
    padding: 6px 8px;
    background: #64b5f6;
    border: none;
    border-radius: 4px;
    color: #000;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .form-actions button:hover {
    background: #42a5f5;
  }

  .form-actions .cancel {
    background: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.9);
  }

  .form-actions .cancel:hover {
    background: rgba(255, 255, 255, 0.15);
  }
</style>
