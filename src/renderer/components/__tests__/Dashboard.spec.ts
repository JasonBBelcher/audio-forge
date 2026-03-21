// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Dashboard from '../Dashboard.svelte';
import { projectStore } from '../../stores/projectStore';

// Mock modals to avoid deep render
vi.mock('../NewProjectModal.svelte', () => ({ default: { render: () => '' } }));
vi.mock('../Settings.svelte', () => ({ default: { render: () => '' } }));

describe('Dashboard Component', () => {
  describe('Rendering', () => {
    it('renders dashboard header with title', () => {
      const { container } = render(Dashboard);
      expect(container.querySelector('.dashboard-header')).toBeTruthy();
      expect(container.querySelector('.dashboard-header')?.textContent).toContain('AudioForge');
    });

    it('renders the projects section heading', () => {
      const { getByText } = render(Dashboard);
      expect(getByText('Projects')).toBeTruthy();
    });

    it('renders the new project button', () => {
      const { container } = render(Dashboard);
      const btn = container.querySelector('button');
      expect(btn).toBeTruthy();
    });

    it('renders search input', () => {
      const { container } = render(Dashboard);
      const input = container.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
    });

    it('renders project cards when projects exist', () => {
      const { container } = render(Dashboard);
      // Sample project is loaded by default
      const cards = container.querySelectorAll('.project-card');
      expect(cards.length).toBeGreaterThan(0);
    });

    it('shows project name on card', () => {
      const { container } = render(Dashboard);
      const card = container.querySelector('.project-card');
      expect(card?.textContent).toContain('Sample Project');
    });

    it('shows BPM metadata on card', () => {
      const { container } = render(Dashboard);
      const card = container.querySelector('.project-card');
      expect(card?.textContent).toContain('120');
    });

    it('shows time signature on card', () => {
      const { container } = render(Dashboard);
      const card = container.querySelector('.project-card');
      expect(card?.textContent).toContain('4/4');
    });

    it('shows subtitle text', () => {
      const { container } = render(Dashboard);
      expect(container.textContent).toContain('Music Production Platform');
    });

    it('renders settings button', () => {
      const { container } = render(Dashboard);
      const buttons = Array.from(container.querySelectorAll('button'));
      expect(buttons.some(b => b.textContent?.includes('Settings'))).toBe(true);
    });
  });

  describe('Search', () => {
    it('filters projects by search query', async () => {
      // Add a second project
      projectStore.addProject({
        id: 'filter-test',
        name: 'Filter Test Track',
        bpm: 100,
        timeSignature: '3/4',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const { container } = render(Dashboard);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;

      await fireEvent.input(input, { target: { value: 'Filter Test' } });

      const cards = container.querySelectorAll('.project-card');
      const names = Array.from(cards).map(c => c.textContent ?? '');
      expect(names.some(n => n.includes('Filter Test Track'))).toBe(true);
    });
  });
});