<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from './ui/Button.svelte';

  const dispatch = createEventDispatcher();

  let urlInput = '';
  let isProcessing = false;
  let errorMessage = '';
  let successMessage = '';

  function isValidYouTubeUrl(url: string): boolean {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|youtube\.com\/watch|youtu\.be\/)\S+/i;
    return youtubeRegex.test(url.trim());
  }

  function parseUrls(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  async function handleImport() {
    errorMessage = '';
    successMessage = '';

    if (!urlInput.trim()) {
      errorMessage = 'Please paste at least one YouTube URL';
      return;
    }

    const urls = parseUrls(urlInput);
    const validUrls = urls.filter((url) => isValidYouTubeUrl(url));

    if (validUrls.length === 0) {
      errorMessage = 'No valid YouTube URLs found. Please check your input.';
      return;
    }

    if (validUrls.length < urls.length) {
      const skipped = urls.length - validUrls.length;
      errorMessage = `Skipped ${skipped} invalid URL(s). Processing ${validUrls.length} valid URL(s).`;
    }

    isProcessing = true;

    try {
      dispatch('import', { urls: validUrls });
      successMessage = `Processing ${validUrls.length} URL(s)...`;
      urlInput = '';

      // Clear messages after 3 seconds
      setTimeout(() => {
        successMessage = '';
        isProcessing = false;
      }, 3000);
    } catch (err) {
      errorMessage = `Error: ${err}`;
      isProcessing = false;
    }
  }

  function handleClear() {
    urlInput = '';
    errorMessage = '';
    successMessage = '';
  }

  function countUrls(): number {
    if (!urlInput.trim()) return 0;
    return parseUrls(urlInput).filter((url) => isValidYouTubeUrl(url)).length;
  }
</script>

<div class="batch-import-panel">
  <div class="panel-header">
    <h3>Batch Import URLs</h3>
    <p class="subtitle">Paste YouTube URLs (one per line)</p>
  </div>

  <div class="input-section">
    <textarea
      bind:value={urlInput}
      placeholder="https://www.youtube.com/watch?v=..."
      disabled={isProcessing}
    />

    <div class="url-counter">
      <span>
        {countUrls()} valid URL{countUrls() !== 1 ? 's' : ''} detected
      </span>
    </div>
  </div>

  {#if errorMessage}
    <div class="error-message">
      <span>⚠️</span>
      <p>{errorMessage}</p>
    </div>
  {/if}

  {#if successMessage}
    <div class="success-message">
      <span>✓</span>
      <p>{successMessage}</p>
    </div>
  {/if}

  <div class="button-group">
    <Button
      variant="primary"
      on:click={handleImport}
      disabled={isProcessing || countUrls() === 0}
    >
      {isProcessing ? 'Processing...' : `Import ${countUrls()} URL${countUrls() !== 1 ? 's' : ''}`}
    </Button>

    <Button variant="secondary" on:click={handleClear} disabled={isProcessing || !urlInput.trim()}>
      Clear
    </Button>
  </div>

  <div class="help-text">
    <p>✓ Supports: youtube.com, youtu.be, youtube.com/watch?v=...</p>
    <p>✓ Invalid URLs will be skipped automatically</p>
    <p>✓ You can import any number of URLs at once</p>
  </div>
</div>

<style>
  .batch-import-panel {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .panel-header {
    margin: 0;
  }

  .panel-header h3 {
    margin: 0 0 0.3rem 0;
    font-size: 1.1rem;
  }

  .subtitle {
    margin: 0;
    font-size: 0.85rem;
    color: #999;
  }

  .input-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  textarea {
    padding: 0.8rem;
    border-radius: 6px;
    border: 1px solid #444;
    background: #1a1a2e;
    color: #eee;
    font-family: monospace;
    font-size: 0.85rem;
    min-height: 120px;
    resize: vertical;
    max-height: 300px;
  }

  textarea:focus {
    outline: none;
    border-color: #6496ff;
    box-shadow: 0 0 8px rgba(100, 150, 255, 0.2);
  }

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .url-counter {
    font-size: 0.8rem;
    color: #999;
    padding: 0 0.5rem;
  }

  .error-message,
  .success-message {
    display: flex;
    gap: 0.8rem;
    padding: 0.8rem;
    border-radius: 6px;
    align-items: flex-start;
  }

  .error-message {
    background: rgba(255, 100, 100, 0.15);
    border: 1px solid rgba(255, 100, 100, 0.3);
    color: #ff9999;
  }

  .error-message span,
  .success-message span {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 0.1rem;
  }

  .error-message p,
  .success-message p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .success-message {
    background: rgba(100, 200, 100, 0.15);
    border: 1px solid rgba(100, 200, 100, 0.3);
    color: #9f9;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .help-text {
    background: rgba(100, 150, 255, 0.1);
    border-left: 3px solid rgba(100, 150, 255, 0.3);
    padding: 0.8rem;
    border-radius: 4px;
    font-size: 0.8rem;
    color: #aaa;
  }

  .help-text p {
    margin: 0.3rem 0;
  }

  .help-text p:first-child {
    margin-top: 0;
  }

  .help-text p:last-child {
    margin-bottom: 0;
  }
</style>
