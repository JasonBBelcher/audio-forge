import { contextBridge, ipcRenderer } from 'electron';

const api = {
  mediaSync: {
    findOffset: (refPath: string, targetPath: string) =>
      ipcRenderer.invoke('media-sync:findOffset', refPath, targetPath),
    syncAudioWithVideo: (videoPath: string, audioPath: string, offsetSec: number, outputPath: string) =>
      ipcRenderer.invoke('media-sync:syncAudioWithVideo', videoPath, audioPath, offsetSec, outputPath),
    alignRecordings: (refPath: string, targetPaths: string[], outputDir: string) =>
      ipcRenderer.invoke('media-sync:alignRecordings', refPath, targetPaths, outputDir),
    autoSync: (videoPath: string, audioPath: string, outputPath: string) =>
      ipcRenderer.invoke('media-sync:autoSync', videoPath, audioPath, outputPath),
  },
  youtube: {
    getInfo: (url: string) => ipcRenderer.invoke('youtube:getInfo', url),
    download: (url: string, trackId: string, outputDir: string) =>
      ipcRenderer.invoke('youtube:download', url, trackId, outputDir),
  },
  audio: {
    analyzeBPM: (filePath: string) => ipcRenderer.invoke('audio:analyzeBPM', filePath),
    analyzeKey: (filePath: string) => ipcRenderer.invoke('audio:analyzeKey', filePath),
    convertFormat: (filePath: string, outputPath: string, options?: object) =>
      ipcRenderer.invoke('audio:convertFormat', filePath, outputPath, options),
    trim: (filePath: string, outputPath: string, startSec: number, endSec: number) =>
      ipcRenderer.invoke('audio:trim', filePath, outputPath, startSec, endSec),
    normalize: (filePath: string, outputPath: string, options?: object) =>
      ipcRenderer.invoke('audio:normalize', filePath, outputPath, options),
    separateStems: (filePath: string, options?: object) =>
      ipcRenderer.invoke('audio:separateStems', filePath, options),
    fullAnalysis: (filePath: string) => ipcRenderer.invoke('audio:fullAnalysis', filePath),
    getMetadata: (filePath: string) => ipcRenderer.invoke('audio:getMetadata', filePath),
    analyzeWaveform: (filePath: string) => ipcRenderer.invoke('audio:analyzeWaveform', filePath),
    fadeIn: (filePath: string, durationSec: number, outputPath?: string) =>
      ipcRenderer.invoke('audio:fadeIn', filePath, durationSec, outputPath),
    fadeOut: (filePath: string, durationSec: number, outputPath?: string) =>
      ipcRenderer.invoke('audio:fadeOut', filePath, durationSec, outputPath),
    reverse: (filePath: string, outputPath?: string) =>
      ipcRenderer.invoke('audio:reverse', filePath, outputPath),
    pitchShift: (filePath: string, semitones: number, outputPath?: string) =>
      ipcRenderer.invoke('audio:pitchShift', filePath, semitones, outputPath),
    timeStretch: (filePath: string, factor: number, outputPath?: string) =>
      ipcRenderer.invoke('audio:timeStretch', filePath, factor, outputPath),
    silenceRemove: (filePath: string, thresholdDb?: number, outputPath?: string) =>
      ipcRenderer.invoke('audio:silenceRemove', filePath, thresholdDb, outputPath),
    getDuration: (filePath: string) => ipcRenderer.invoke('audio:getDuration', filePath),
  },
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    create: (data: object) => ipcRenderer.invoke('projects:create', data),
    update: (id: string, data: object) => ipcRenderer.invoke('projects:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('projects:delete', id),
  },
  files: {
    showOpenDialog: (options: object) => ipcRenderer.invoke('files:showOpenDialog', options),
    showSaveDialog: (options: object) => ipcRenderer.invoke('files:showSaveDialog', options),
    writeFile: (filePath: string, data: Uint8Array) => ipcRenderer.invoke('files:writeFile', filePath, data),
    getMediaDir: () => ipcRenderer.invoke('files:getMediaDir'),
    readAsArrayBuffer: (filePath: string) => ipcRenderer.invoke('files:readAsArrayBuffer', filePath),
  },
  video: {
    getMetadata: (filePath: string) => ipcRenderer.invoke('video:getMetadata', filePath),
    extractAudio: (filePath: string, options?: object) => ipcRenderer.invoke('video:extractAudio', filePath, options),
  },
  sync: {
    listSessions: (projectId: string) => ipcRenderer.invoke('sync:listSessions', projectId),
    initializeSync: (projectId: string, backend: string) => ipcRenderer.invoke('sync:initialize', projectId, backend),
    getStatus: (projectId: string) => ipcRenderer.invoke('sync:getStatus', projectId),
  },
  platforms: {
    list: () => ipcRenderer.invoke('platforms:list'),
    register: (config: object) => ipcRenderer.invoke('platforms:register', config),
    getHistory: (platformId: string) => ipcRenderer.invoke('platforms:getHistory', platformId),
    soundcloud: {
      connect: () => ipcRenderer.invoke('platforms:soundcloud:connect'),
    },
  },
  assets: {
    list: () => ipcRenderer.invoke('assets:list'),
    search: (query: string) => ipcRenderer.invoke('assets:search', query),
    delete: (id: number) => ipcRenderer.invoke('assets:delete', id),
    import: (filePath: string) => ipcRenderer.invoke('assets:import', filePath),
  },
  jobs: {
    list: (status?: string) => ipcRenderer.invoke('jobs:list', status),
    getStatus: (id: string) => ipcRenderer.invoke('jobs:getStatus', id),
    cancel: (id: string) => ipcRenderer.invoke('jobs:cancel', id),
  },
  settings: {
    get: (key: string, defaultValue?: unknown) => ipcRenderer.invoke('settings:get', key, defaultValue),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
  },
  health: {
    getStatus: () => ipcRenderer.invoke('health:getStatus'),
  },
  hardware: {
    list: () => ipcRenderer.invoke('hardware:list'),
    getStatus: (id: string) => ipcRenderer.invoke('hardware:getStatus', id),
    initialize: (id: string) => ipcRenderer.invoke('hardware:initialize', id),
    teardown: (id: string) => ipcRenderer.invoke('hardware:teardown', id),
  },
  koala: {
    exportKit: (kit: object, syncFolder: string) =>
      ipcRenderer.invoke('koala:exportKit', kit, syncFolder),
    listKits: (syncFolder: string) =>
      ipcRenderer.invoke('koala:listKits', syncFolder),
    deleteKit: (kitName: string, syncFolder: string) =>
      ipcRenderer.invoke('koala:deleteKit', kitName, syncFolder),
  },
  midi: {},
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
  off: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcRenderer.removeListener(channel, cb as never);
  },
};

contextBridge.exposeInMainWorld('audioforge', api);

// Type declaration for TypeScript in renderer
export type AudioForgeAPI = typeof api;
