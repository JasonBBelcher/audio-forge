<script lang="ts">
  import { onMount } from 'svelte';
  import { projectStore } from './stores/projectStore';
  import { settingsStore } from './stores/settingsStore';
  import Dashboard from './components/Dashboard.svelte';
  import ProjectEditor from './components/ProjectEditor.svelte';
  import JobToasts from './components/JobToasts.svelte';
  import type { Project } from './stores/projectStore';

  let currentProject: Project | null = null;

  // Apply theme to document root whenever it changes
  $: document.documentElement.setAttribute('data-theme', $settingsStore.theme);

  onMount(() => {
    const unsubscribe = projectStore.getCurrentProject().subscribe((project) => {
      currentProject = project;
    });

    return unsubscribe;
  });
</script>

{#if currentProject}
  <ProjectEditor />
{:else}
  <Dashboard />
{/if}

<JobToasts />
