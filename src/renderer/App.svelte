<script lang="ts">
  import { onMount } from 'svelte';
  import { projectStore } from './stores/projectStore';
  import Dashboard from './components/Dashboard.svelte';
  import ProjectEditor from './components/ProjectEditor.svelte';
  import type { Project } from './stores/projectStore';

  let currentProject: Project | null = null;

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
