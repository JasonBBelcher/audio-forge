import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HardwareService } from '../../../../src/main/services/hardware.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('HardwareService', () => {
  let hardware: HardwareService;

  beforeEach(() => {
    hardware = new HardwareService(':memory:');
    vi.clearAllMocks();
  });

  it('detects connected audio interfaces', async () => {
    const devices = await hardware.listAudioDevices();

    expect(Array.isArray(devices)).toBe(true);
    if (devices.length > 0) {
      expect(devices[0]).toHaveProperty('id');
      expect(devices[0]).toHaveProperty('name');
      expect(devices[0]).toHaveProperty('channels');
    }
  });

  it('gets audio device properties', async () => {
    const devices = await hardware.listAudioDevices();
    if (devices.length === 0) {
      // Skip if no devices
      return;
    }

    const device = await hardware.getDeviceInfo(devices[0].id);

    expect(device).toBeDefined();
    expect(device?.id).toBe(devices[0].id);
    expect(device).toHaveProperty('sampleRate');
    expect(device).toHaveProperty('bufferSize');
  });

  it('configures audio device as input', async () => {
    const configured = await hardware.configureInputDevice('device-123', {
      sampleRate: 48000,
      bufferSize: 256,
      channels: 2,
    });

    expect(configured).toBe(true);
  });

  it('configures audio device as output', async () => {
    const configured = await hardware.configureOutputDevice('device-456', {
      sampleRate: 48000,
      bufferSize: 256,
      channels: 2,
    });

    expect(configured).toBe(true);
  });

  it('monitors audio levels from input device', async () => {
    const monitorId = await hardware.startLevelMonitor('device-123');

    expect(monitorId).toBeDefined();

    const levels = await hardware.getLevels(monitorId);

    expect(levels).toHaveProperty('left');
    expect(levels).toHaveProperty('right');
    expect(typeof levels.left).toBe('number');
    expect(typeof levels.right).toBe('number');
  });

  it('stops monitoring audio levels', async () => {
    const monitorId = await hardware.startLevelMonitor('device-123');
    const stopped = await hardware.stopLevelMonitor(monitorId);

    expect(stopped).toBe(true);
  });

  it('routes audio between devices', async () => {
    const routeId = await hardware.createAudioRoute('input-device', 'output-device');

    expect(routeId).toBeDefined();
  });

  it('records audio from input device', async () => {
    const recordId = await hardware.startRecording('input-device', '/tmp/recording.wav');

    expect(recordId).toBeDefined();

    const stopped = await hardware.stopRecording(recordId);

    expect(stopped).toBe(true);
  });

  it('detects sample rate and latency', async () => {
    const specs = await hardware.detectDeviceSpecs('device-123');

    expect(specs).toHaveProperty('sampleRate');
    expect(specs).toHaveProperty('latency');
    expect(specs).toHaveProperty('bufferSize');
  });

  it('saves hardware configuration', async () => {
    const config = {
      inputDevice: 'device-123',
      outputDevice: 'device-456',
      sampleRate: 48000,
      bufferSize: 256,
    };

    await hardware.saveConfiguration('profile-1', config);

    const loaded = await hardware.loadConfiguration('profile-1');

    expect(loaded).toEqual(config);
  });

  it('lists saved hardware profiles', async () => {
    await hardware.saveConfiguration('profile-1', { inputDevice: 'dev-1', sampleRate: 44100 });
    await hardware.saveConfiguration('profile-2', { inputDevice: 'dev-2', sampleRate: 48000 });

    const profiles = await hardware.listConfigurations();

    expect(profiles.length).toBeGreaterThanOrEqual(2);
    expect(profiles.some((p) => p === 'profile-1')).toBe(true);
    expect(profiles.some((p) => p === 'profile-2')).toBe(true);
  });

  it('detects CPU usage of audio processing', async () => {
    const usage = await hardware.getAudioCPUUsage();

    expect(typeof usage).toBe('number');
    expect(usage).toBeGreaterThanOrEqual(0);
    expect(usage).toBeLessThanOrEqual(100);
  });

  it('monitors and reports hardware health', async () => {
    const health = await hardware.checkHardwareHealth();

    expect(health).toHaveProperty('status');
    expect(health).toHaveProperty('devices');
    expect(Array.isArray(health.devices)).toBe(true);
  });

  it('deletes hardware configuration', async () => {
    await hardware.saveConfiguration('to-delete', { inputDevice: 'dev-1', sampleRate: 44100 });

    await hardware.deleteConfiguration('to-delete');

    const profiles = await hardware.listConfigurations();
    expect(profiles.some((p) => p === 'to-delete')).toBe(false);
  });
});
