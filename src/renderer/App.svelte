<script lang="ts">
  let count = $state(0);
</script>

<main>
  <div class="header">
    <h1>AudioForge</h1>
    <p class="subtitle">Unified Music Production Platform</p>
  </div>

  <div class="status">
    <p>Electron + Svelte 5 scaffold running.</p>
    <button onclick={() => count++}>
      Clicks: {count}
    </button>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 2rem;
  }

  .header {
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0;
    color: var(--color-primary);
  }

  .subtitle {
    color: var(--color-text-secondary);
    margin: 0.5rem 0 0;
  }

  .status {
    text-align: center;
  }

  button {
    padding: 0.5rem 1.5rem;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.15s;
  }

  button:hover {
    background: var(--color-primary);
    color: white;
    border-color: var(--color-primary);
  }
</style>
