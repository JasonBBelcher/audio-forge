// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Fader from '../Fader.svelte';

describe('Fader Component', () => {
  describe('Props and Rendering', () => {
    it('renders the fader name', () => {
      const { getByText } = render(Fader, { props: { name: 'Track 1', value: 0.5 } });
      expect(getByText('Track 1')).toBeTruthy();
    });

    it('displays value as dB', () => {
      const { container } = render(Fader, { props: { name: 'Test', value: 0.5 } });
      const valueEl = container.querySelector('.fader-value');
      expect(valueEl?.textContent).toMatch(/-\d+\.\d+ dB/);
    });

    it('shows 0.0 dB at value 1.0', () => {
      const { container } = render(Fader, { props: { name: 'Test', value: 1.0 } });
      const valueEl = container.querySelector('.fader-value');
      expect(valueEl?.textContent).toContain('0.0 dB');
    });

    it('applies muted class to slider when muted', () => {
      const { container } = render(Fader, { props: { name: 'Test', value: 0.5, muted: true } });
      expect(container.querySelector('.fader-slider.muted')).toBeTruthy();
    });

    it('applies is-master class when isMaster is true', () => {
      const { container } = render(Fader, { props: { name: 'Master', value: 1.0, isMaster: true } });
      expect(container.querySelector('.fader-container.is-master')).toBeTruthy();
    });

    it('hides mute/solo buttons for master fader', () => {
      const { container } = render(Fader, { props: { name: 'Master', value: 1.0, isMaster: true } });
      expect(container.querySelectorAll('.control-btn').length).toBe(0);
    });

    it('shows mute/solo buttons for track fader', () => {
      const { container } = render(Fader, { props: { name: 'Track 1', value: 0.5, isMaster: false } });
      expect(container.querySelectorAll('.control-btn').length).toBe(2);
    });
  });

  describe('Slider Attributes', () => {
    it('clamps value range to 0-1', () => {
      const { container } = render(Fader, { props: { name: 'Test', value: 0.5 } });
      const slider = container.querySelector('.fader-slider') as HTMLInputElement;
      expect(parseFloat(slider.min)).toBe(0);
      expect(parseFloat(slider.max)).toBe(1);
    });

    it('uses 0.01 step', () => {
      const { container } = render(Fader, { props: { name: 'Test', value: 0.5 } });
      const slider = container.querySelector('.fader-slider') as HTMLInputElement;
      expect(parseFloat(slider.step)).toBe(0.01);
    });
  });

  describe('Control Buttons', () => {
    it('mute button has active class when muted', () => {
      const { container } = render(Fader, { props: { name: 'T', value: 0.5, muted: true } });
      expect(container.querySelector('.control-btn.mute.active')).toBeTruthy();
    });

    it('mute button does not have active class when not muted', () => {
      const { container } = render(Fader, { props: { name: 'T', value: 0.5, muted: false } });
      expect(container.querySelector('.control-btn.mute.active')).toBeNull();
    });

    it('solo button has active class when solo', () => {
      const { container } = render(Fader, { props: { name: 'T', value: 0.5, solo: true } });
      expect(container.querySelector('.control-btn.solo.active')).toBeTruthy();
    });

    it('control buttons have correct text', () => {
      const { container } = render(Fader, { props: { name: 'T', value: 0.5 } });
      const btns = container.querySelectorAll('.control-btn');
      expect(btns[0].textContent?.trim()).toBe('M');
      expect(btns[1].textContent?.trim()).toBe('S');
    });

    it('mute button has title attribute', () => {
      const { container } = render(Fader, { props: { name: 'T', value: 0.5 } });
      expect(container.querySelector('.control-btn.mute')?.getAttribute('title')).toBe('Mute');
    });

    it('solo button has title attribute', () => {
      const { container } = render(Fader, { props: { name: 'T', value: 0.5 } });
      expect(container.querySelector('.control-btn.solo')?.getAttribute('title')).toBe('Solo');
    });
  });

  describe('Default Props', () => {
    it('defaults to not muted', () => {
      const { container } = render(Fader, { props: { name: 'Test' } });
      expect(container.querySelector('.fader-slider.muted')).toBeNull();
    });

    it('defaults to not master', () => {
      const { container } = render(Fader, { props: { name: 'Test' } });
      expect(container.querySelector('.fader-container.is-master')).toBeNull();
    });
  });
});