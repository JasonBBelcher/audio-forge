// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlatformsView from '../PlatformsView.svelte';

describe('PlatformsView Component', () => {
  beforeEach(() => {
    (window as any).audioforge = undefined;
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(PlatformsView);
      expect(container).toBeTruthy();
    });

    it('shows "Platforms" heading', () => {
      const { getByText } = render(PlatformsView);
      expect(getByText(/Platforms/i)).toBeTruthy();
    });

    it('works without audioforge API', () => {
      const { container } = render(PlatformsView);
      expect(container.textContent).toContain('Platforms');
    });
  });

  describe('Platform List', () => {
    it('shows empty state when no integrations', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('No') || expect(container.textContent).toContain('none');
    });

    it('shows platform list when integrations exist', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([
            {
              id: 'platform1',
              name: 'YouTube',
              status: 'authorized',
            },
          ]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('YouTube');
    });

    it('shows platform name for each row', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([
            {
              id: 'platform1',
              name: 'Spotify',
              status: 'authorized',
            },
            {
              id: 'platform2',
              name: 'SoundCloud',
              status: 'unauthorized',
            },
          ]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      expect(container.textContent).toContain('Spotify');
      expect(container.textContent).toContain('SoundCloud');
    });
  });

  describe('Status Badges', () => {
    it('shows status badge for authorized', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([
            {
              id: 'platform1',
              name: 'YouTube',
              status: 'authorized',
            },
          ]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      const badge = container.querySelector('.status-authorized');
      expect(badge).toBeTruthy();
    });

    it('shows status badge for unauthorized', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([
            {
              id: 'platform1',
              name: 'YouTube',
              status: 'unauthorized',
            },
          ]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      const badge = container.querySelector('.status-unauthorized');
      expect(badge).toBeTruthy();
    });
  });

  describe('Connect Platform', () => {
    it('has a "Connect Platform" button', () => {
      const { getByText } = render(PlatformsView);
      expect(getByText(/Connect Platform/i)).toBeTruthy();
    });

    it('shows connect form with name input and Connect button', async () => {
      const { container } = render(PlatformsView);
      const button = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Connect Platform')
      );
      await fireEvent.click(button!);
      await new Promise(r => setTimeout(r, 10));

      const input = container.querySelector('input');
      expect(input).toBeTruthy();

      const submitBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Connect') && b !== button);
      expect(submitBtn).toBeTruthy();
    });

    it('form has inputs for platform name', async () => {
      const { container } = render(PlatformsView);
      const button = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('Connect Platform')
      );
      await fireEvent.click(button!);
      await new Promise(r => setTimeout(r, 10));

      const input = container.querySelector('input');
      expect(input).toBeTruthy();
      expect(input?.getAttribute('placeholder')).toContain('platform');
    });
  });

  describe('Publish History', () => {
    it('shows publish history button for authorized platforms', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([
            {
              id: 'platform1',
              name: 'YouTube',
              status: 'authorized',
            },
          ]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      const historyBtn = Array.from(container.querySelectorAll('button')).find(b =>
        b.textContent?.includes('History') || b.textContent?.includes('history')
      );
      expect(historyBtn).toBeTruthy();
    });

    it('does not show publish history button for unauthorized platforms', async () => {
      (window as any).audioforge = {
        platforms: {
          list: vi.fn().mockResolvedValue([
            {
              id: 'platform1',
              name: 'YouTube',
              status: 'unauthorized',
            },
          ]),
        },
      };

      const { container } = render(PlatformsView);
      await new Promise(r => setTimeout(r, 0));

      // Only the Connect Platform button should be present
      const buttons = Array.from(container.querySelectorAll('button'));
      const historyBtn = buttons.find(b =>
        b.textContent?.includes('History') && b.textContent?.includes('YouTube')
      );
      expect(historyBtn).toBeFalsy();
    });
  });
});
