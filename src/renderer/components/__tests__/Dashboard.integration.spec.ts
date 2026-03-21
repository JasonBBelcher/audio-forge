// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Dashboard from '../Dashboard.svelte';
import { projectStore } from '../../stores/projectStore';

vi.mock('../NewProjectModal.svelte', () => ({ default: { render: () => '' } }));

describe('Dashboard Integration', () => {
  it('clicking a project card opens the project', async () => {
    const { container } = render(Dashboard);
    projectStore.setCurrentProject(null);
    const card = container.querySelector('.project-card') as HTMLElement;
    await fireEvent.click(card);
    expect(get(projectStore.getCurrentProject())).not.toBeNull();
  });

  it('delete button removes project after confirm', async () => {
    projectStore.addProject({
      id: 'del-integration',
      name: 'Delete Me',
      bpm: 120,
      timeSignature: '4/4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const { container } = render(Dashboard);
    const countBefore = container.querySelectorAll('.project-card').length;

    const cards = Array.from(container.querySelectorAll('.project-card'));
    const target = cards.find(c => c.textContent?.includes('Delete Me'));
    const deleteBtn = target?.querySelector('.delete-btn') as HTMLElement;

    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await fireEvent.click(deleteBtn);

    expect(container.querySelectorAll('.project-card').length).toBeLessThan(countBefore);
  });

  it('new project button exists and is clickable', () => {
    const { container } = render(Dashboard);
    const buttons = Array.from(container.querySelectorAll('button'));
    const newBtn = buttons.find(b => b.textContent?.includes('New Project')) as HTMLButtonElement;
    expect(newBtn).toBeTruthy();
    expect(newBtn.disabled).toBe(false);
  });
});