// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Settings from '../Settings.svelte';
import { settingsStore } from '../../stores/settingsStore';

describe('Settings Component', () => {
  beforeEach(() => {
    settingsStore.reset();
  });

  it('renders settings panel', () => {
    const { container } = render(Settings);
    expect(container.querySelector('.settings')).toBeTruthy();
  });

  it('shows Settings heading', () => {
    const { container } = render(Settings);
    expect(container.textContent).toContain('Settings');
  });

  it('renders default BPM value', () => {
    const { container } = render(Settings);
    const bpmInput = container.querySelector('#default-bpm') as HTMLInputElement;
    expect(bpmInput).toBeTruthy();
    expect(bpmInput.value).toBe('120');
  });

  it('updates defaultBpm in store when changed', async () => {
    const { container } = render(Settings);
    const bpmInput = container.querySelector('#default-bpm') as HTMLInputElement;
    await fireEvent.input(bpmInput, { target: { value: '140' } });
    expect((get(settingsStore) as any).defaultBpm).toBe(140);
  });

  it('renders theme selector', () => {
    const { container } = render(Settings);
    const themeSelect = container.querySelector('#theme') as HTMLSelectElement;
    expect(themeSelect).toBeTruthy();
  });

  it('updates theme in store when changed', async () => {
    const { container } = render(Settings);
    const themeSelect = container.querySelector('#theme') as HTMLSelectElement;
    await fireEvent.change(themeSelect, { target: { value: 'light' } });
    expect((get(settingsStore) as any).theme).toBe('light');
  });

  it('renders audio quality selector', () => {
    const { container } = render(Settings);
    const qualitySelect = container.querySelector('#audio-quality') as HTMLSelectElement;
    expect(qualitySelect).toBeTruthy();
  });

  it('renders metronome volume slider', () => {
    const { container } = render(Settings);
    const slider = container.querySelector('#metronome-volume') as HTMLInputElement;
    expect(slider).toBeTruthy();
  });

  it('renders auto-detect BPM toggle', () => {
    const { container } = render(Settings);
    const toggle = container.querySelector('#auto-detect-bpm') as HTMLInputElement;
    expect(toggle).toBeTruthy();
    expect(toggle.type).toBe('checkbox');
  });

  it('renders auto-detect key toggle', () => {
    const { container } = render(Settings);
    const toggle = container.querySelector('#auto-detect-key') as HTMLInputElement;
    expect(toggle).toBeTruthy();
    expect(toggle.type).toBe('checkbox');
  });

  it('renders reset button', () => {
    const { container } = render(Settings);
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent?.toLowerCase().includes('reset'))).toBe(true);
  });

  it('resets to defaults when reset button clicked', async () => {
    settingsStore.update({ defaultBpm: 180, theme: 'light' as any });
    const { container } = render(Settings);
    const resetBtn = Array.from(container.querySelectorAll('button')).find(
      b => b.textContent?.toLowerCase().includes('reset')
    ) as HTMLButtonElement;
    await fireEvent.click(resetBtn);
    expect((get(settingsStore) as any).defaultBpm).toBe(120);
    expect((get(settingsStore) as any).theme).toBe('dark');
  });

  it('has a close button', () => {
    const { container } = render(Settings);
    const closeBtn = container.querySelector('.close-btn') as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    expect(closeBtn.disabled).toBe(false);
  });
});
