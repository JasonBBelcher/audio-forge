<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    close: void;
    connected: { portName: string };
  }>();

  const af = (window as any).audioforge;

  let ports: { inputs: string[]; outputs: string[] } = { inputs: [], outputs: [] };
  let selectedInput = '';
  let selectedOutput = '';
  let connecting = false;
  let error = '';
  let status: { connected: boolean; portName: string | null } = { connected: false, portName: null };

  function pickDefault(list: string[]): string {
    const preferred = list.find(p => /sp-?404|roland/i.test(p));
    return preferred ?? list[0] ?? '';
  }

  async function loadPorts() {
    try {
      ports = await af.sp404.midi.listPorts();
      // Only set defaults if not yet selected or current value not in list
      if (!selectedInput || !ports.inputs.includes(selectedInput)) {
        selectedInput = pickDefault(ports.inputs);
      }
      if (!selectedOutput || !ports.outputs.includes(selectedOutput)) {
        selectedOutput = pickDefault(ports.outputs);
      }
    } catch (e) {
      error = `Failed to list ports: ${(e as Error).message}`;
    }
  }

  onMount(async () => {
    await loadPorts();
    try {
      const s = await af.sp404.midi.getStatus();
      status = { connected: s.connected, portName: s.portName };
    } catch (_) {
      // non-fatal — status defaults to disconnected
    }
  });

  async function connect() {
    connecting = true;
    error = '';
    try {
      const result = await af.sp404.midi.connect(selectedInput, selectedOutput);
      if (result.ok) {
        status = { connected: true, portName: selectedInput };
        dispatch('connected', { portName: selectedInput });
      } else {
        error = result.error ?? 'Connection failed';
      }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      connecting = false;
    }
  }

  async function disconnect() {
    try {
      await af.sp404.midi.disconnect();
    } catch (_) {
      // best-effort
    }
    status = { connected: false, portName: null };
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      dispatch('close');
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="midi-backdrop" on:click={handleBackdropClick}>
  <div class="midi-modal" role="dialog" aria-modal="true" aria-labelledby="midi-title">
    <div class="modal-header">
      <h2 id="midi-title">SP-404 MIDI Connection</h2>
      <button class="close-btn" on:click={() => dispatch('close')} aria-label="Close">&#x2715;</button>
    </div>

    <p class="modal-desc">Select the MIDI ports for your SP-404 MK2</p>

    {#if status.connected}
      <div class="status-row status-row--connected">
        <span class="status-dot status-dot--green"></span>
        <span class="status-text">Connected to: <strong>{status.portName}</strong></span>
        <button class="action-btn action-btn--danger" on:click={disconnect}>Disconnect</button>
      </div>
    {:else}
      <div class="status-row">
        <span class="status-dot status-dot--red"></span>
        <span class="status-text">Not connected</span>
      </div>
    {/if}

    <div class="form-section">
      <div class="field-row">
        <label for="midi-input-port" class="field-label">Input Port</label>
        <div class="select-wrap">
          <select id="midi-input-port" bind:value={selectedInput} disabled={connecting}>
            {#if ports.inputs.length === 0}
              <option value="">No MIDI inputs found</option>
            {/if}
            {#each ports.inputs as port}
              <option value={port}>{port}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field-row">
        <label for="midi-output-port" class="field-label">Output Port</label>
        <div class="select-wrap">
          <select id="midi-output-port" bind:value={selectedOutput} disabled={connecting}>
            {#if ports.outputs.length === 0}
              <option value="">No MIDI outputs found</option>
            {/if}
            {#each ports.outputs as port}
              <option value={port}>{port}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="field-row field-row--actions">
        <button
          class="refresh-btn"
          on:click={loadPorts}
          disabled={connecting}
          aria-label="Refresh port list"
          title="Refresh port list"
        >&#8635; Refresh</button>
      </div>
    </div>

    {#if error}
      <p class="error-msg" role="alert">{error}</p>
    {/if}

    <div class="modal-footer">
      <button class="action-btn action-btn--ghost" on:click={() => dispatch('close')}>Cancel</button>
      <button
        class="action-btn action-btn--primary"
        disabled={connecting || !selectedInput || !selectedOutput}
        on:click={connect}
      >
        {connecting ? 'Connecting\u2026' : 'Connect'}
      </button>
    </div>
  </div>
</div>

<style>
  .midi-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .midi-modal {
    width: 440px;
    max-height: 90vh;
    background: #16162a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  }

  h2 {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.95);
  }

  .close-btn {
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.4);
    font-size: 1rem;
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
  }
  .close-btn:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.08);
  }

  .modal-desc {
    margin: 0.75rem 1.5rem 0;
    font-size: 0.82rem;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.5;
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin: 0.9rem 1.5rem 0;
    padding: 0.6rem 0.85rem;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    font-size: 0.82rem;
  }
  .status-row--connected {
    border-color: rgba(63, 185, 80, 0.3);
    background: rgba(63, 185, 80, 0.06);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-dot--green { background: #3fb950; }
  .status-dot--red   { background: #f85149; }

  .status-text {
    flex: 1;
    color: rgba(255, 255, 255, 0.7);
  }
  .status-text strong {
    color: rgba(255, 255, 255, 0.9);
  }

  .form-section {
    padding: 1rem 1.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
  }

  .field-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .field-label {
    width: 90px;
    flex-shrink: 0;
    font-size: 0.78rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .select-wrap {
    flex: 1;
  }

  select {
    width: 100%;
    padding: 0.35rem 0.6rem;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 5px;
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.82rem;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }
  select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  select option {
    background: #1e1e30;
    color: rgba(255, 255, 255, 0.85);
  }

  .field-row--actions {
    justify-content: flex-end;
  }

  .refresh-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.78rem;
    padding: 0.3rem 0.65rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .refresh-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.07);
    color: rgba(255, 255, 255, 0.75);
  }
  .refresh-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .error-msg {
    margin: 0.75rem 1.5rem 0;
    padding: 0.5rem 0.75rem;
    background: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.3);
    border-radius: 5px;
    color: #f85149;
    font-size: 0.8rem;
    line-height: 1.4;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 1.25rem 1.5rem;
    margin-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.07);
  }

  .action-btn {
    padding: 0.45rem 1rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.15s, opacity 0.15s;
    border: 1px solid transparent;
  }
  .action-btn--ghost {
    background: transparent;
    border-color: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.6);
  }
  .action-btn--ghost:hover {
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.85);
  }
  .action-btn--primary {
    background: #64b5f6;
    border-color: #64b5f6;
    color: #0d0d1a;
  }
  .action-btn--primary:hover:not(:disabled) {
    background: #82c4f8;
  }
  .action-btn--primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .action-btn--danger {
    background: transparent;
    border-color: rgba(248, 81, 73, 0.4);
    color: #f85149;
    font-size: 0.78rem;
    padding: 0.25rem 0.65rem;
  }
  .action-btn--danger:hover {
    background: rgba(248, 81, 73, 0.12);
  }
</style>
