// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Sidebar from '../Sidebar.svelte';

describe('Sidebar Component', () => {
  describe('Rendering', () => {
    it('renders sidebar container', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      expect(container.querySelector('.sidebar')).toBeTruthy();
    });

    it('renders all navigation groups', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const groups = container.querySelectorAll('.nav-group');
      expect(groups.length).toBe(4);
    });

    it('renders LIBRARY group', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const libraryGroup = Array.from(container.querySelectorAll('.group-label')).find(
        el => el.textContent?.includes('LIBRARY')
      );
      expect(libraryGroup).toBeTruthy();
    });

    it('renders ORGANIZE group', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const organizeGroup = Array.from(container.querySelectorAll('.group-label')).find(
        el => el.textContent?.includes('ORGANIZE')
      );
      expect(organizeGroup).toBeTruthy();
    });

    it('renders HARDWARE group', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const hardwareGroup = Array.from(container.querySelectorAll('.group-label')).find(
        el => el.textContent?.includes('HARDWARE')
      );
      expect(hardwareGroup).toBeTruthy();
    });

    it('renders SYSTEM group', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const systemGroup = Array.from(container.querySelectorAll('.group-label')).find(
        el => el.textContent?.includes('SYSTEM')
      );
      expect(systemGroup).toBeTruthy();
    });

    it('renders Library nav item', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const libraryItem = items.find(el => el.textContent?.includes('Library'));
      expect(libraryItem).toBeTruthy();
    });

    it('renders Import nav item', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const importItem = items.find(el => el.textContent?.includes('Import'));
      expect(importItem).toBeTruthy();
    });

    it('renders Collections nav item', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const collectionsItem = items.find(el => el.textContent?.includes('Collections'));
      expect(collectionsItem).toBeTruthy();
    });

    it('renders Koala Kit nav item', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const koalaItem = items.find(el => el.textContent?.includes('Koala'));
      expect(koalaItem).toBeTruthy();
    });

    it('renders Settings nav item', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const settingsItem = items.find(el => el.textContent?.includes('Settings'));
      expect(settingsItem).toBeTruthy();
    });

    it('marks activeView item as active', () => {
      const { container } = render(Sidebar, { props: { activeView: 'koala' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const koalaItem = items.find(el => el.textContent?.includes('Koala'));
      expect(koalaItem?.classList.contains('active')).toBe(true);
    });

    it('does not mark non-active items as active', () => {
      const { container } = render(Sidebar, { props: { activeView: 'koala' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const libraryItem = items.find(el => el.textContent?.includes('Library'));
      expect(libraryItem?.classList.contains('active')).toBe(false);
    });

    it('nav items are buttons', () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      items.forEach(item => {
        expect(item.tagName).toBe('BUTTON');
      });
    });
  });

  describe('Interaction', () => {
    it('nav item buttons are clickable', async () => {
      const { container } = render(Sidebar, { props: { activeView: 'library' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const importItem = items.find(el => el.textContent?.includes('Import')) as HTMLButtonElement;

      expect(importItem).toBeTruthy();
      await fireEvent.click(importItem);
      // Should not throw
    });

    it('can click Library item', async () => {
      const { container } = render(Sidebar, { props: { activeView: 'import' } });
      const items = Array.from(container.querySelectorAll('.nav-item'));
      const libraryItem = items.find(el => el.textContent?.includes('Library')) as HTMLButtonElement;

      expect(libraryItem).toBeTruthy();
      await fireEvent.click(libraryItem);
      // Should not throw
    });

    it('can click each nav item', async () => {
      const viewIds = ['library', 'import', 'collections', 'koala', 'settings'];

      for (const viewId of viewIds) {
        const { container } = render(Sidebar, { props: { activeView: 'library' } });
        const navItem = container.querySelector(`[data-view-id="${viewId}"]`) as HTMLButtonElement;

        expect(navItem).toBeTruthy();
        await fireEvent.click(navItem);
        // Should not throw
      }
    });

    it('works with different initial active views', () => {
      const viewIds = ['library', 'import', 'collections', 'koala', 'settings'];

      viewIds.forEach(viewId => {
        const { container } = render(Sidebar, { props: { activeView: viewId } });
        const activeItem = container.querySelector(`[data-view-id="${viewId}"]`);
        expect(activeItem?.classList.contains('active')).toBe(true);
      });
    });
  });
});
