import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockHandle = vi.fn();
const mockOn = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle,
    on: mockOn,
  },
  app: {
    getPath: vi.fn(() => '/mock/userData'),
  },
}));

describe('IPC Registration', () => {
  beforeEach(() => {
    mockHandle.mockClear();
    mockOn.mockClear();
    vi.resetModules();
  });

  it('registerIPCHandler registers a handle-style IPC channel', async () => {
    const { registerIPCHandler } = await import('../../../../src/main/ipc/register.js');

    const handler = vi.fn().mockResolvedValue('result');
    registerIPCHandler('test:channel', handler);

    expect(mockHandle).toHaveBeenCalledWith('test:channel', expect.any(Function));
  });

  it('registerIPCHandler wraps handler to extract args from event', async () => {
    const { registerIPCHandler } = await import('../../../../src/main/ipc/register.js');

    const handler = vi.fn().mockResolvedValue('result');
    registerIPCHandler('test:channel', handler);

    // Get the wrapper that was registered
    const wrapper = mockHandle.mock.calls[0][1];
    const fakeEvent = {};
    await wrapper(fakeEvent, { key: 'value' });

    expect(handler).toHaveBeenCalledWith({ key: 'value' });
  });

  it('registerIPCHandler wrapper catches errors and returns structured error', async () => {
    const { registerIPCHandler } = await import('../../../../src/main/ipc/register.js');

    const handler = vi.fn().mockRejectedValue(new Error('something failed'));
    registerIPCHandler('test:error', handler);

    const wrapper = mockHandle.mock.calls[0][1];
    const result = await wrapper({}, {});

    expect(result).toHaveProperty('error');
    expect(result.error).toContain('something failed');
  });
});
