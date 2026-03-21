<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title: string = '';
  export let width: string = '480px';

  const dispatch = createEventDispatcher();

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) dispatch('close');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') dispatch('close');
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_interactive_supports_focus -->
<div class="backdrop" on:click={handleBackdropClick} role="dialog" aria-modal="true" aria-label={title} tabindex="-1">
  <div class="modal" style={`max-width: ${width}`}>
    <div class="modal-header">
      <h2>{title}</h2>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">✕</button>
    </div>
    <div class="modal-body">
      <slot />
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: #1e1e2e;
    border: 1px solid rgba(99, 102, 241, 0.3);
    border-radius: 16px;
    width: 100%;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    animation: slide-in 0.18s ease-out;
  }

  @keyframes slide-in {
    from { opacity: 0; transform: translateY(-16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 1.5rem 0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.25rem;
    color: #e0e0f0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #888;
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0f0;
  }

  .modal-body {
    padding: 1.5rem;
  }
</style>
