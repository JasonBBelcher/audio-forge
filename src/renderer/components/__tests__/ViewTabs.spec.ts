// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ViewTabs from '../ViewTabs.svelte';

describe('ViewTabs Component', () => {
  describe('Rendering', () => {
    it('renders all 8 tabs', () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'arrange' } });
      const tabs = Array.from(container.querySelectorAll('button[data-tab]'));
      expect(tabs.length).toBe(8);
    });

    it('renders tabs with correct labels', () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'arrange' } });
      const tabs = Array.from(container.querySelectorAll('button[data-tab]'));
      const labels = tabs.map(t => t.textContent);
      expect(labels).toEqual(['Arrange', 'Mixer', 'Audio', 'Video', 'Sync', 'Platforms', 'Files', 'Koala']);
    });

    it('renders tabs with correct data-tab attributes', () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'arrange' } });
      const tabs = Array.from(container.querySelectorAll('button[data-tab]'));
      const ids = tabs.map(t => t.getAttribute('data-tab'));
      expect(ids).toEqual(['arrange', 'mixer', 'audio', 'video', 'sync', 'platforms', 'files', 'koala']);
    });

    it('marks active tab with active class', () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'mixer' } });
      const tabs = Array.from(container.querySelectorAll('button[data-tab]'));
      const mixerTab = tabs.find(t => t.getAttribute('data-tab') === 'mixer');
      expect(mixerTab?.classList.contains('active')).toBe(true);
    });

    it('does not mark non-active tabs with active class', () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'mixer' } });
      const tabs = Array.from(container.querySelectorAll('button[data-tab]'));
      const nonActiveTabs = tabs.filter(t => t.getAttribute('data-tab') !== 'mixer');
      nonActiveTabs.forEach(tab => {
        expect(tab.classList.contains('active')).toBe(false);
      });
    });

    it('each tab is a button element', () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'arrange' } });
      const tabs = Array.from(container.querySelectorAll('button[data-tab]'));
      tabs.forEach(tab => {
        expect(tab.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Interaction', () => {
    it('tab buttons are clickable', async () => {
      const { container } = render(ViewTabs, { props: { activeTab: 'arrange' } });

      const audioTab = Array.from(container.querySelectorAll('button[data-tab]')).find(
        t => t.getAttribute('data-tab') === 'audio'
      ) as HTMLButtonElement;

      expect(audioTab).toBeTruthy();
      await fireEvent.click(audioTab);
      // Should not throw
    });

    it('each tab button is clickable', async () => {
      const tabIds = ['arrange', 'mixer', 'audio', 'video', 'sync', 'platforms', 'files', 'koala'];

      for (const tabId of tabIds) {
        const { container } = render(ViewTabs, { props: { activeTab: 'arrange' } });

        const tab = Array.from(container.querySelectorAll('button[data-tab]')).find(
          t => t.getAttribute('data-tab') === tabId
        ) as HTMLButtonElement;

        expect(tab).toBeTruthy();
        await fireEvent.click(tab);
        // Should not throw
      }
    });

    it('works with different initial active tabs', () => {
      const tabs = ['arrange', 'mixer', 'audio', 'video', 'sync', 'platforms', 'files', 'koala'];

      tabs.forEach(tab => {
        const { container } = render(ViewTabs, { props: { activeTab: tab } });
        const activeTab = container.querySelector(`button[data-tab="${tab}"]`);
        expect(activeTab?.classList.contains('active')).toBe(true);
      });
    });
  });
});
