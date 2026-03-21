import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('../../services/exportService', () => ({
  exportService: {
    exportProject: vi.fn().mockResolvedValue({ success: true, canceled: false, filePath: '/tmp/mix.wav' }),
  },
}));

vi.mock('../../services/audioEngine', () => ({
  audioEngine: {
    getTrackBuffer: vi.fn().mockReturnValue(null),
  },
}));

import ExportModal from '../ExportModal.svelte';
import { exportService as mockExportService } from '../../services/exportService';

const defaultProps = {
  projectName: 'My Mix',
  tracks: [
    { id: 't1', name: 'Drums', volume: 1, muted: false },
    { id: 't2', name: 'Bass', volume: 0.8, muted: true },
  ],
  duration: 10,
};

describe('ExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the modal', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    expect(container.querySelector('.export-modal')).toBeTruthy();
  });

  it('shows Export Mix heading', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    expect(container.textContent).toContain('Export Mix');
  });

  it('shows the project name in the heading or subheading', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    expect(container.textContent).toContain('My Mix');
  });

  it('shows a list of tracks', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    expect(container.textContent).toContain('Drums');
    expect(container.textContent).toContain('Bass');
  });

  it('shows muted status for muted tracks', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    const muteIndicators = container.querySelectorAll('.muted');
    expect(muteIndicators.length).toBeGreaterThan(0);
  });

  it('has an Export button', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const exportBtn = buttons.find(b => b.textContent?.includes('Export'));
    expect(exportBtn).toBeTruthy();
  });

  it('has a Cancel button', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const cancelBtn = buttons.find(b => b.textContent?.toLowerCase().includes('cancel'));
    expect(cancelBtn).toBeTruthy();
  });

  it('calls exportService.exportProject when Export is clicked', async () => {
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const exportBtn = buttons.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
    await fireEvent.click(exportBtn);
    expect(mockExportService.exportProject).toHaveBeenCalledOnce();
  });

  it('passes projectName and duration to exportProject', async () => {
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const exportBtn = buttons.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
    await fireEvent.click(exportBtn);
    const call = mockExportService.exportProject.mock.calls[0][0];
    expect(call.projectName).toBe('My Mix');
    expect(call.duration).toBe(10);
  });

  it('shows a success message after export completes', async () => {
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const exportBtn = buttons.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
    await fireEvent.click(exportBtn);
    // Wait for async to settle
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('success');
  });

  it('shows error state when export fails', async () => {
    mockExportService.exportProject.mockResolvedValueOnce({
      success: false,
      canceled: false,
      error: 'Write failed',
    });
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const exportBtn = buttons.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
    await fireEvent.click(exportBtn);
    await new Promise(r => setTimeout(r, 0));
    expect(container.textContent).toContain('Write failed');
  });

  it('does not show status message before export is clicked', () => {
    const { container } = render(ExportModal, { props: defaultProps });
    expect(container.querySelector('.export-status')).toBeNull();
  });

  it('disables Export button while exporting', async () => {
    let resolveExport!: (v: any) => void;
    mockExportService.exportProject.mockReturnValueOnce(
      new Promise(resolve => { resolveExport = resolve; })
    );
    const { container } = render(ExportModal, { props: defaultProps });
    const buttons = Array.from(container.querySelectorAll('button'));
    const exportBtn = buttons.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
    await fireEvent.click(exportBtn);
    expect(exportBtn.disabled).toBe(true);
    resolveExport({ success: true, canceled: false, filePath: '/tmp/mix.wav' });
  });
});
