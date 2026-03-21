<script lang="ts">
</script>

<div class="import-view">
  <div class="header">
    <h2>Import</h2>
  </div>

  <div class="content">
    <p>Paste a YouTube/SoundCloud URL or drag audio files here to import them into your library.</p>
    <!-- URL input + import button coming in next iteration -->
  </div>
</div>

<style>
  .import-view {
    padding: 16px;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    margin-bottom: 20px;
  }

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  p {
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    margin: 0;
    text-align: center;
  }
</style>
