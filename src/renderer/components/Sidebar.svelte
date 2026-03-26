<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface NavItem {
    id: string;
    label: string;
    icon: string;
  }

  interface NavGroup {
    label: string;
    items: NavItem[];
  }

  export let activeView: string = 'library';

  const dispatch = createEventDispatcher<{ navigate: { view: string } }>();

  const groups: NavGroup[] = [
    {
      label: 'LIBRARY',
      items: [
        { id: 'library', label: 'Library', icon: '🗂' },
        { id: 'midi', label: 'MIDI Library', icon: '🎵' },
        { id: 'import', label: 'Import', icon: '⬇' },
        { id: 'watch-folders', label: 'Watch Folders', icon: '👁' },
      ],
    },
    {
      label: 'ORGANIZE',
      items: [
        { id: 'collections', label: 'Collections', icon: '📁' },
      ],
    },
    {
      label: 'GENERATE',
      items: [
        { id: 'ai-generate', label: 'AI Generate', icon: '✨' },
      ],
    },
    {
      label: 'CREATE',
      items: [
        { id: 'audio-to-midi', label: 'Audio → MIDI', icon: '🎹' },
        { id: 'loop-detect', label: 'Loop Detect', icon: '🔁' },
        { id: 'mastering', label: 'Mastering', icon: '🎚' },
      ],
    },
    {
      label: 'HARDWARE',
      items: [
        { id: 'koala', label: 'Koala Kit', icon: '🐨' },
        { id: 'sp404', label: 'SP-404 MK2', icon: '🎛' },
        { id: 'sp404-companion', label: 'SP-404 Companion', icon: '🎚' },
        { id: 'emx1', label: 'EMX-1 Electribe', icon: '🎹' },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Settings', icon: '⚙' },
      ],
    },
  ];

  function navigate(id: string) {
    dispatch('navigate', { view: id });
  }
</script>

<aside class="sidebar">
  {#each groups as group (group.label)}
    <div class="nav-group">
      <div class="group-label">{group.label}</div>
      <div class="group-items">
        {#each group.items as item (item.id)}
          <button
            class="nav-item"
            class:active={activeView === item.id}
            data-view-id={item.id}
            onclick={() => navigate(item.id)}
            title={item.label}
          >
            <span class="icon">{item.icon}</span>
            <span class="label">{item.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/each}
</aside>

<style>
  .sidebar {
    width: 200px;
    background: #1a1a2e;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
    overflow-y: auto;
    padding: 16px 0;
  }

  .nav-group {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .nav-group:last-child {
    border-bottom: none;
  }

  .group-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.4);
    padding: 12px 16px 8px 16px;
  }

  .group-items {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.6);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: left;
    border-left: 3px solid transparent;
  }

  .nav-item:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.03);
  }

  .nav-item.active {
    color: rgba(255, 255, 255, 0.95);
    background: rgba(100, 181, 246, 0.1);
    border-left-color: #64b5f6;
  }

  .icon {
    font-size: 16px;
    flex-shrink: 0;
  }

  .label {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
