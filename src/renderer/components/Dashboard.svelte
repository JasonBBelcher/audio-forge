<script lang="ts">
  import { projectStore } from '../stores/projectStore';
  import type { Project } from '../stores/projectStore';
  import Button from './ui/Button.svelte';
  import NewProjectModal from './NewProjectModal.svelte';
  import Settings from './Settings.svelte';
  import HealthPanel from './HealthPanel.svelte';
  import JobsPanel from './JobsPanel.svelte';
  import { onMount } from 'svelte';

  let projects: Project[] = [];
  let searchQuery = '';
  let showNewProjectModal = false;
  let showSettings = false;

  onMount(() => {
    const unsubscribe = projectStore.subscribe((p) => {
      projects = p;
    });
    return unsubscribe;
  });

  function handleNewProject(e: CustomEvent<{ name: string; bpm: number; timeSignature: string; key: string }>) {
    const { name, bpm, timeSignature, key } = e.detail;
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name,
      bpm,
      timeSignature,
      key,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    projectStore.addProject(newProject);
    showNewProjectModal = false;
  }

  function handleOpenProject(project: Project) {
    projectStore.setCurrentProject(project);
  }

  function handleDeleteProject(id: string, e: MouseEvent) {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      projectStore.removeProject(id);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  $: filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
</script>

<div class="dashboard">
  <header class="dashboard-header">
    <div class="header-left">
      <h1>🎵 AudioForge</h1>
      <p>Unified Music Production Platform</p>
    </div>
    <button class="settings-btn" on:click={() => (showSettings = true)} title="Settings">⚙️ Settings</button>
  </header>

  <main class="dashboard-main">
    <div class="sidebar">
      <HealthPanel />
      <JobsPanel />
    </div>
    <section class="projects-section">
      <div class="section-header">
        <h2>Projects</h2>
        <Button on:click={() => (showNewProjectModal = true)} variant="primary">+ New Project</Button>
      </div>

      <div class="search-box">
        <input
          type="text"
          placeholder="Search projects..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>

      <div class="projects-grid">
        {#if filteredProjects.length === 0 && searchQuery}
          <div class="empty-state">
            <p>No projects match "{searchQuery}"</p>
          </div>
        {:else if filteredProjects.length === 0}
          <div class="empty-state">
            <div class="empty-icon">🎛️</div>
            <p>No projects yet.</p>
            <p class="empty-sub">Click <strong>+ New Project</strong> to get started.</p>
          </div>
        {:else}
          {#each filteredProjects as project (project.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="project-card" on:click={() => handleOpenProject(project)}>
              <div class="card-header">
                <h3>{project.name}</h3>
                <button
                  class="delete-btn"
                  on:click={(e) => handleDeleteProject(project.id, e)}
                  title="Delete project"
                >
                  ✕
                </button>
              </div>
              <div class="card-meta">
                <span class="meta-item">🎛️ {project.bpm} BPM</span>
                <span class="meta-item">⏱️ {project.timeSignature}</span>
                {#if project.key}
                  <span class="meta-item">🎵 {project.key}</span>
                {/if}
              </div>
              <div class="card-date">Modified {formatDate(project.updatedAt)}</div>
              <div class="open-hint">Click to open →</div>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  </main>
</div>

{#if showNewProjectModal}
  <NewProjectModal
    on:create={handleNewProject}
    on:close={() => (showNewProjectModal = false)}
  />
{/if}

{#if showSettings}
  <div class="settings-overlay">
    <div class="settings-panel">
      <Settings on:close={() => (showSettings = false)} />
    </div>
  </div>
{/if}

<style>
  .dashboard {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
    color: #e0e0e0;
  }

  .dashboard-header {
    padding: 2rem;
    background: rgba(0, 0, 0, 0.3);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .dashboard-header h1 {
    margin: 0;
    font-size: 2.5rem;
    background: linear-gradient(45deg, #6366f1, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .dashboard-header p {
    margin: 0.5rem 0 0 0;
    color: #a0a0a0;
    font-size: 1rem;
  }

  .dashboard-main {
    flex: 1;
    overflow-y: auto;
    padding: 2rem;
    display: flex;
    gap: 2rem;
    align-items: flex-start;
  }

  .sidebar {
    width: 280px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: sticky;
    top: 0;
  }

  .projects-section {
    flex: 1;
    min-width: 0;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.8rem;
  }

  .search-box {
    margin-bottom: 2rem;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    color: #e0e0e0;
    font-size: 1rem;
    transition: all 0.2s;
    box-sizing: border-box;
  }

  .search-input:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.1);
    border-color: #6366f1;
  }

  .search-input::placeholder {
    color: #707080;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .empty-state {
    grid-column: 1 / -1;
    padding: 4rem 2rem;
    text-align: center;
    color: #707080;
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0.25rem 0;
    font-size: 1.1rem;
  }

  .empty-sub {
    color: #505060;
    font-size: 0.95rem !important;
    margin-top: 0.5rem !important;
  }

  .project-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.2s;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .project-card:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(99, 102, 241, 0.5);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.2rem;
    flex: 1;
    word-break: break-word;
  }

  .delete-btn {
    background: none;
    border: none;
    color: #505060;
    font-size: 1rem;
    cursor: pointer;
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .delete-btn:hover {
    color: #ff6b6b;
    background: rgba(255, 107, 107, 0.1);
  }

  .card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.85rem;
    color: #a0a0a0;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .card-date {
    font-size: 0.8rem;
    color: #505060;
    margin-top: 0.25rem;
  }

  .open-hint {
    font-size: 0.8rem;
    color: #6366f1;
    text-align: right;
    margin-top: auto;
    padding-top: 0.5rem;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .project-card:hover .open-hint {
    opacity: 1;
  }

  .dashboard-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
    padding: 1.5rem 2rem;
  }

  .header-left h1 {
    margin: 0;
    font-size: 2rem;
    background: linear-gradient(45deg, #6366f1, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header-left p {
    margin: 0.25rem 0 0;
    color: #a0a0a0;
    font-size: 0.9rem;
  }

  .settings-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #a0a0a0;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .settings-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
  }

  .settings-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
    z-index: 100;
  }

  .settings-panel {
    width: 360px;
    max-width: 90vw;
    background: #1a1a2e;
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    overflow-y: auto;
  }
</style>
