import { describe, it, expect } from 'vitest';
import { IPCChannel, EventChannel } from '../../../src/shared/types.js';

describe('IPCChannel enum', () => {
  it('defines all YouTube channels', () => {
    expect(IPCChannel.YOUTUBE_GET_INFO).toBe('youtube:getInfo');
    expect(IPCChannel.YOUTUBE_DOWNLOAD).toBe('youtube:download');
    expect(IPCChannel.YOUTUBE_CANCEL).toBe('youtube:cancel');
    expect(IPCChannel.YOUTUBE_SEARCH).toBe('youtube:search');
  });

  it('defines all Audio channels', () => {
    expect(IPCChannel.AUDIO_ANALYZE).toBe('audio:analyze');
    expect(IPCChannel.AUDIO_CONVERT).toBe('audio:convert');
    expect(IPCChannel.AUDIO_STEMS).toBe('audio:stems');
    expect(IPCChannel.AUDIO_TRIM).toBe('audio:trim');
    expect(IPCChannel.AUDIO_NORMALIZE).toBe('audio:normalize');
  });

  it('defines all Video channels', () => {
    expect(IPCChannel.VIDEO_EXTRACT_AUDIO).toBe('video:extractAudio');
    expect(IPCChannel.VIDEO_REPLACE_AUDIO).toBe('video:replaceAudio');
    expect(IPCChannel.VIDEO_TRIM).toBe('video:trim');
    expect(IPCChannel.VIDEO_THUMBNAILS).toBe('video:thumbnails');
  });

  it('defines all Sync channels', () => {
    expect(IPCChannel.SYNC_FIND_OFFSET).toBe('sync:findOffset');
    expect(IPCChannel.SYNC_APPLY).toBe('sync:apply');
    expect(IPCChannel.SYNC_REPORT).toBe('sync:report');
    expect(IPCChannel.SYNC_MANUAL).toBe('sync:manual');
  });

  it('defines all Platform channels', () => {
    expect(IPCChannel.PLATFORM_CONNECT).toBe('platforms:connect');
    expect(IPCChannel.PLATFORM_DISCONNECT).toBe('platforms:disconnect');
    expect(IPCChannel.PLATFORM_UPLOAD).toBe('platforms:upload');
    expect(IPCChannel.PLATFORM_SEARCH).toBe('platforms:search');
  });

  it('defines all File channels', () => {
    expect(IPCChannel.FILES_LIST).toBe('files:list');
    expect(IPCChannel.FILES_SEARCH).toBe('files:search');
    expect(IPCChannel.FILES_DELETE).toBe('files:delete');
    expect(IPCChannel.FILES_RESTORE).toBe('files:restore');
    expect(IPCChannel.FILES_ORGANIZE).toBe('files:organize');
  });

  it('defines all Project channels', () => {
    expect(IPCChannel.PROJECTS_CREATE).toBe('projects:create');
    expect(IPCChannel.PROJECTS_GET).toBe('projects:get');
    expect(IPCChannel.PROJECTS_ADD_ASSET).toBe('projects:addAsset');
    expect(IPCChannel.PROJECTS_EXPORT).toBe('projects:export');
  });

  it('defines all Job channels', () => {
    expect(IPCChannel.JOBS_LIST).toBe('jobs:list');
    expect(IPCChannel.JOBS_CANCEL).toBe('jobs:cancel');
    expect(IPCChannel.JOBS_GET_STATUS).toBe('jobs:getStatus');
  });

  it('defines Settings and Health channels', () => {
    expect(IPCChannel.SETTINGS_GET).toBe('settings:get');
    expect(IPCChannel.SETTINGS_SET).toBe('settings:set');
    expect(IPCChannel.HEALTH_GET_STATUS).toBe('health:getStatus');
  });

  it('defines Hardware channels', () => {
    expect(IPCChannel.HARDWARE_LIST_ADAPTERS).toBe('hardware:listAdapters');
    expect(IPCChannel.HARDWARE_GET_STATUS).toBe('hardware:getAdapterStatus');
    expect(IPCChannel.HARDWARE_LIST_DEVICES).toBe('hardware:listDevices');
  });

  it('defines MIDI channels', () => {
    expect(IPCChannel.MIDI_LIST_DEVICES).toBe('midi:listDevices');
    expect(IPCChannel.MIDI_START_CAPTURE).toBe('midi:startCapture');
    expect(IPCChannel.MIDI_STOP_CAPTURE).toBe('midi:stopCapture');
    expect(IPCChannel.MIDI_SEND_SYSEX).toBe('midi:sendSysex');
  });

  it('uses colon-separated namespace:action format for all channels', () => {
    const values = Object.values(IPCChannel);
    for (const v of values) {
      expect(v).toMatch(/^[a-z]+:[a-zA-Z]+$/);
    }
  });

  it('has no duplicate channel values', () => {
    const values = Object.values(IPCChannel);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});

describe('EventChannel enum', () => {
  it('defines all event channels', () => {
    expect(EventChannel.JOB_PROGRESS).toBe('job:progress');
    expect(EventChannel.JOB_COMPLETE).toBe('job:complete');
    expect(EventChannel.JOB_FAILED).toBe('job:failed');
    expect(EventChannel.HEALTH_CHANGED).toBe('health:changed');
    expect(EventChannel.HARDWARE_DEVICE_CHANGED).toBe('hardware:deviceChanged');
    expect(EventChannel.HARDWARE_MIDI_MESSAGE).toBe('hardware:midiMessage');
    expect(EventChannel.UPDATE_AVAILABLE).toBe('update:available');
  });

  it('uses colon-separated format for all event channels', () => {
    const values = Object.values(EventChannel);
    for (const v of values) {
      expect(v).toMatch(/^[a-z]+:[a-zA-Z]+$/);
    }
  });

  it('has no duplicate event channel values', () => {
    const values = Object.values(EventChannel);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('does not overlap with IPCChannel values', () => {
    const ipcValues = new Set(Object.values(IPCChannel));
    const eventValues = Object.values(EventChannel);
    for (const v of eventValues) {
      expect(ipcValues.has(v as any)).toBe(false);
    }
  });
});
