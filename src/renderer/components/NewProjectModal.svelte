<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Modal from './ui/Modal.svelte';
  import Button from './ui/Button.svelte';

  const dispatch = createEventDispatcher<{
    create: { name: string; bpm: number; timeSignature: string; key: string };
    close: void;
  }>();

  let name = '';
  let bpm = 120;
  let timeSignature = '4/4';
  let key = 'C major';
  let nameError = '';

  const timeSignatures = ['4/4', '3/4', '6/8', '7/8', '5/4', '2/4', '12/8'];
  const keys = [
    'C major', 'G major', 'D major', 'A major', 'E major', 'B major',
    'F# major', 'Db major', 'Ab major', 'Eb major', 'Bb major', 'F major',
    'A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor',
    'Eb minor', 'Bb minor', 'F minor', 'C minor', 'G minor', 'D minor',
  ];

  function validate(): boolean {
    if (!name.trim()) {
      nameError = 'Project name is required';
      return false;
    }
    if (name.trim().length < 2) {
      nameError = 'Name must be at least 2 characters';
      return false;
    }
    nameError = '';
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    dispatch('create', {
      name: name.trim(),
      bpm,
      timeSignature,
      key,
    });
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
  }
</script>

<!-- svelte-ignore a11y_autofocus -->
<Modal title="New Project" on:close={() => dispatch('close')}>
  <form on:submit|preventDefault={handleSubmit} class="form">
    <div class="field">
      <label for="proj-name">Project Name</label>
      <input
        id="proj-name"
        type="text"
        bind:value={name}
        on:keydown={handleKeydown}
        placeholder="My New Track"
        class={nameError ? 'error' : ''}
        autofocus
      />
      {#if nameError}
        <span class="error-msg">{nameError}</span>
      {/if}
    </div>

    <div class="row">
      <div class="field">
        <label for="proj-bpm">BPM</label>
        <div class="bpm-control">
          <button type="button" class="adj" on:click={() => bpm = Math.max(20, bpm - 1)}>−</button>
          <input
            id="proj-bpm"
            type="number"
            bind:value={bpm}
            min="20"
            max="300"
          />
          <button type="button" class="adj" on:click={() => bpm = Math.min(300, bpm + 1)}>+</button>
        </div>
      </div>

      <div class="field">
        <label for="proj-ts">Time Signature</label>
        <select id="proj-ts" bind:value={timeSignature}>
          {#each timeSignatures as ts}
            <option value={ts}>{ts}</option>
          {/each}
        </select>
      </div>
    </div>

    <div class="field">
      <label for="proj-key">Key</label>
      <select id="proj-key" bind:value={key}>
        {#each keys as k}
          <option value={k}>{k}</option>
        {/each}
      </select>
    </div>

    <div class="actions">
      <Button variant="secondary" on:click={() => dispatch('close')}>Cancel</Button>
      <Button variant="primary" on:click={handleSubmit}>Create Project</Button>
    </div>
  </form>
</Modal>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  label {
    font-size: 0.85rem;
    color: #a0a0b8;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  input[type='text'],
  input[type='number'],
  select {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #e0e0f0;
    padding: 0.65rem 0.9rem;
    font-size: 0.95rem;
    transition: border-color 0.15s;
    width: 100%;
    box-sizing: border-box;
  }

  input[type='text']:focus,
  input[type='number']:focus,
  select:focus {
    outline: none;
    border-color: rgba(99, 102, 241, 0.6);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  }

  input.error {
    border-color: rgba(239, 68, 68, 0.6);
  }

  .error-msg {
    font-size: 0.8rem;
    color: #ef4444;
  }

  .bpm-control {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .bpm-control input {
    text-align: center;
    border-radius: 0;
    border-left: none;
    border-right: none;
    width: 70px;
    flex-shrink: 0;
  }

  .adj {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.15);
    color: #e0e0f0;
    padding: 0.65rem 0.75rem;
    font-size: 1.1rem;
    cursor: pointer;
    transition: background 0.15s;
    line-height: 1;
  }

  .adj:first-child {
    border-radius: 8px 0 0 8px;
  }

  .adj:last-child {
    border-radius: 0 8px 8px 0;
  }

  .adj:hover {
    background: rgba(99, 102, 241, 0.3);
  }

  select option {
    background: #1e1e2e;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 0.5rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
