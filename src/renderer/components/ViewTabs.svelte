<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    activeTab: string;
  }

  let { activeTab }: Props = $props();

  const dispatch = createEventDispatcher<{ tabchange: string }>();

  const tabs = [
    { id: 'arrange', label: 'Arrange' },
    { id: 'mixer', label: 'Mixer' },
    { id: 'wave-editor', label: 'Editor' },
    { id: 'audio', label: 'Audio' },
    { id: 'video', label: 'Video' },
    { id: 'sync', label: 'Sync' },
    { id: 'platforms', label: 'Platforms' },
    { id: 'files', label: 'Files' },
    { id: 'koala', label: 'Koala' },
  ];

  function handleTabClick(tabId: string) {
    dispatch('tabchange', tabId);
  }
</script>

<div class="view-tabs">
  {#each tabs as tab (tab.id)}
    <button
      data-tab={tab.id}
      class:active={activeTab === tab.id}
      onclick={() => handleTabClick(tab.id)}
    >
      {tab.label}
    </button>
  {/each}
</div>

<style>
  .view-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  button {
    flex: 1;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  button:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.04);
  }

  button.active {
    color: rgba(255, 255, 255, 1);
    border-bottom-color: #64b5f6;
  }
</style>
