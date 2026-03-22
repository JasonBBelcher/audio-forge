<script lang="ts">
  import { onMount } from 'svelte';
  import Button from './ui/Button.svelte';
  import type { EMX1Pattern } from '../../main/services/emx1.service.js';

  const af = (window as any).audioforge;

  let inputPorts: string[] = [];
  let outputPorts: string[] = [];
  let selectedInputPort: string | null = null;
  let selectedOutputPort: string | null = null;
  let connected = false;
  let isConnecting = false;
  let error: string | null = null;
  let patterns: EMX1Pattern[] = [];
  let selectedPatternNumber = 0;
  let bpm = 120;

  onMount(async () => {
    // Load available MIDI ports on mount
    try {
      const ports = await af.emx1.listPorts();
      inputPorts = ports.inputs;
      outputPorts = ports.outputs;

      // Select first ports by default
      if (inputPorts.length > 0) selectedInputPort = inputPorts[0];
      if (outputPorts.length > 0) selectedOutputPort = outputPorts[0];

      // Check initial connection status
      connected = await af.emx1.isConnected();

      // Poll connection status every 2 seconds
      const pollInterval = setInterval(async () => {
        connected = await af.emx1.isConnected();
      }, 2000);

      return () => clearInterval(pollInterval);
    } catch (err) {
      error = `Failed to load MIDI ports: ${(err as Error).message}`;
    }
  });

  async function handleConnect(): Promise<void> {
    if (!selectedInputPort || !selectedOutputPort) {
      error = 'Please select both input and output ports';
      return;
    }

    isConnecting = true;
    error = null;

    try {
      await af.emx1.connect(selectedInputPort, selectedOutputPort);
      connected = true;
    } catch (err) {
      error = `Connection failed: ${(err as Error).message}`;
      connected = false;
    } finally {
      isConnecting = false;
    }
  }

  async function handleDisconnect(): Promise<void> {
    try {
      await af.emx1.disconnect();
      connected = false;
      error = null;
    } catch (err) {
      error = `Disconnection failed: ${(err as Error).message}`;
    }
  }

  async function handleDumpPatterns(): Promise<void> {
    if (!connected) {
      error = 'Not connected to EMX-1';
      return;
    }

    error = null;

    try {
      const sysexBytes = await af.emx1.requestDump();
      patterns = await af.emx1.parseDump(sysexBytes);
    } catch (err) {
      error = `Pattern dump failed: ${(err as Error).message}`;
    }
  }

  async function handleSelectPattern(): Promise<void> {
    if (!connected) {
      error = 'Not connected to EMX-1';
      return;
    }

    error = null;

    try {
      await af.emx1.selectPattern(selectedPatternNumber);
    } catch (err) {
      error = `Pattern selection failed: ${(err as Error).message}`;
    }
  }

  async function handleExportPattern(pattern: EMX1Pattern): Promise<void> {
    error = null;

    try {
      // In a real app, would open a save dialog
      const outputPath = `/tmp/pattern-${pattern.patternNumber}.mid`;
      await af.emx1.exportMidi(pattern, outputPath);
      // Could show a success message or save dialog here
    } catch (err) {
      error = `Export failed: ${(err as Error).message}`;
    }
  }

  async function handleStart(): Promise<void> {
    if (!connected) {
      error = 'Not connected to EMX-1';
      return;
    }

    error = null;

    try {
      await af.emx1.sendStart();
    } catch (err) {
      error = `Start failed: ${(err as Error).message}`;
    }
  }

  async function handleStop(): Promise<void> {
    if (!connected) {
      error = 'Not connected to EMX-1';
      return;
    }

    error = null;

    try {
      await af.emx1.sendStop();
    } catch (err) {
      error = `Stop failed: ${(err as Error).message}`;
    }
  }

  function getStepPreview(pattern: EMX1Pattern): string {
    if (pattern.parts.length === 0) return '─────────';
    const firstPart = pattern.parts[0];
    return firstPart.steps.slice(0, 16).map((active) => (active ? '█' : '░')).join('');
  }
</script>

<div class="emx1-view">
  <div class="header">
    <h1>EMX-1 Electribe</h1>
    <div class="status">
      <span class="indicator" class:connected>
        {#if connected}
          ● Connected
        {:else}
          ○ Disconnected
        {/if}
      </span>
    </div>
  </div>

  {#if error}
    <div class="error-banner">
      {error}
      <button class="close-btn" onclick={() => (error = null)}>×</button>
    </div>
  {/if}

  <div class="section">
    <h2>MIDI Ports</h2>
    <div class="port-controls">
      <div class="port-group">
        <label>Input:</label>
        <select bind:value={selectedInputPort} disabled={connected}>
          {#each inputPorts as port}
            <option value={port}>{port}</option>
          {/each}
        </select>
      </div>

      <div class="port-group">
        <label>Output:</label>
        <select bind:value={selectedOutputPort} disabled={connected}>
          {#each outputPorts as port}
            <option value={port}>{port}</option>
          {/each}
        </select>
      </div>

      <div class="port-actions">
        {#if !connected}
          <Button onclick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        {:else}
          <Button onclick={handleDisconnect} variant="secondary">
            Disconnect
          </Button>
        {/if}
      </div>
    </div>
  </div>

  {#if connected}
    <div class="section">
      <h2>Pattern Management</h2>
      <div class="pattern-actions">
        <Button onclick={handleDumpPatterns}>Dump All Patterns</Button>
      </div>

      {#if patterns.length > 0}
        <div class="patterns-list">
          {#each patterns as pattern (pattern.patternNumber)}
            <div class="pattern-item">
              <div class="pattern-header">
                <span class="pattern-name">
                  Pattern {pattern.patternNumber + 1} ({pattern.bank})
                </span>
                <span class="pattern-preview">{getStepPreview(pattern)}</span>
              </div>
              <div class="pattern-actions-inline">
                <Button
                  size="small"
                  onclick={() => {
                    selectedPatternNumber = pattern.patternNumber;
                    handleSelectPattern();
                  }}
                >
                  Select
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  onclick={() => handleExportPattern(pattern)}
                >
                  Export MIDI
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <div class="section">
      <h2>MIDI Clock</h2>
      <div class="clock-controls">
        <div class="bpm-control">
          <label>BPM:</label>
          <input type="number" bind:value={bpm} min="20" max="300" />
        </div>
        <div class="clock-actions">
          <Button onclick={handleStart}>▶ Start</Button>
          <Button onclick={handleStop} variant="secondary">⏹ Stop</Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .emx1-view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 24px;
    background: #0d1117;
    color: #c9d1d9;
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 16px;
  }

  .header h1 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
    color: #c9d1d9;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .indicator {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #8b949e;
  }

  .indicator.connected {
    color: #3fb950;
    background: rgba(63, 185, 80, 0.1);
  }

  .error-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(248, 81, 73, 0.1);
    border: 1px solid rgba(248, 81, 73, 0.3);
    border-radius: 6px;
    color: #f85149;
    font-size: 13px;
  }

  .close-btn {
    background: none;
    border: none;
    color: #f85149;
    cursor: pointer;
    font-size: 18px;
    padding: 0 4px;
  }

  .close-btn:hover {
    opacity: 0.8;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section h2 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    color: #8b949e;
    letter-spacing: 0.5px;
  }

  .port-controls {
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .port-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
  }

  .port-group label {
    font-size: 12px;
    font-weight: 500;
    color: #8b949e;
  }

  .port-group select {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 13px;
  }

  .port-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .port-actions {
    display: flex;
    gap: 8px;
  }

  .pattern-actions {
    display: flex;
    gap: 8px;
  }

  .patterns-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .pattern-item {
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .pattern-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .pattern-name {
    font-size: 13px;
    font-weight: 500;
    min-width: 120px;
  }

  .pattern-preview {
    font-family: monospace;
    font-size: 12px;
    letter-spacing: 2px;
    color: #58a6ff;
    flex: 1;
    text-align: right;
  }

  .pattern-actions-inline {
    display: flex;
    gap: 8px;
  }

  .clock-controls {
    display: flex;
    gap: 16px;
    align-items: flex-end;
  }

  .bpm-control {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .bpm-control label {
    font-size: 12px;
    font-weight: 500;
    color: #8b949e;
  }

  .bpm-control input {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    color: #c9d1d9;
    font-size: 13px;
    width: 80px;
  }

  .clock-actions {
    display: flex;
    gap: 8px;
  }
</style>
