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
    list: () => ipcRenderer.invoke('files:list'),
    search: (query: string) => ipcRenderer.invoke('files:search', query),
    delete: (assetId: number) => ipcRenderer.invoke('files:delete', assetId),
    import: (filePaths: string[]) => ipcRenderer.invoke('files:import', filePaths),
    analyzeAll: () => ipcRenderer.invoke('files:analyzeAll'),
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
    installTool: (tool: string) => ipcRenderer.invoke('health:installTool', tool),
    onInstallProgress: (cb: (tool: string, line: string) => void) => {
      const handler = (_: unknown, data: { tool: string; line: string }) => cb(data.tool, data.line);
      ipcRenderer.on('health:installProgress', handler);
      return () => ipcRenderer.removeListener('health:installProgress', handler);
    },
  },
  hardware: {
    list: () => ipcRenderer.invoke('hardware:list'),
    getStatus: (id: string) => ipcRenderer.invoke('hardware:getStatus', id),
    initialize: (id: string) => ipcRenderer.invoke('hardware:initialize', id),
    teardown: (id: string) => ipcRenderer.invoke('hardware:teardown', id),
  },
  koala: {
    exportKit: (kit: object, exportFolder: string) =>
      ipcRenderer.invoke('koala:exportKit', kit, exportFolder),
    listKits: (exportFolder: string) =>
      ipcRenderer.invoke('koala:listKits', exportFolder),
    deleteKit: (kitName: string, exportFolder: string) =>
      ipcRenderer.invoke('koala:deleteKit', kitName, exportFolder),
    openInFinder: (folderPath: string) =>
      ipcRenderer.invoke('koala:openInFinder', folderPath),
  },
  sp404: {
    exportKit: (kit: object, sdCardPath: string) =>
      ipcRenderer.invoke('sp404:exportKit', kit, sdCardPath),
    listBanks: (sdCardPath: string) =>
      ipcRenderer.invoke('sp404:listBanks', sdCardPath),
    detectSDCards: () =>
      ipcRenderer.invoke('sp404:detectSDCards'),
    companion: {
      getState: (padRef: string) => ipcRenderer.invoke('sp404:companion:getState', padRef),
      setState: (padRef: string, state: object) => ipcRenderer.invoke('sp404:companion:setState', padRef, state),
      getChops: (assetId: number) => ipcRenderer.invoke('sp404:companion:getChops', assetId),
      setChops: (assetId: number, chops: object[]) => ipcRenderer.invoke('sp404:companion:setChops', assetId, chops),
    },
    waveform: {
      load: (padRef: string, filePath: string) => ipcRenderer.invoke('sp404:waveform:load', padRef, filePath),
      analyze: (filePath: string, durationSec: number) => ipcRenderer.invoke('sp404:waveform:analyze', filePath, durationSec),
    },
    chop: {
      detect: (filePath: string, mode: string, options: object) => ipcRenderer.invoke('sp404:chop:detect', filePath, mode, options),
      export: (assetId: number, sdCardPath: string) => ipcRenderer.invoke('sp404:chop:export', assetId, sdCardPath),
    },
    pattern: {
      load: (patternRef: string) => ipcRenderer.invoke('sp404:pattern:load', patternRef),
      save: (data: object) => ipcRenderer.invoke('sp404:pattern:save', data),
      setStep: (patternRef: string, partIndex: number, stepIndex: number, values: object) =>
        ipcRenderer.invoke('sp404:pattern:setStep', patternRef, partIndex, stepIndex, values),
      setVelocity: (patternRef: string, partIndex: number, stepIndex: number, velocity: number) =>
        ipcRenderer.invoke('sp404:pattern:setVelocity', patternRef, partIndex, stepIndex, velocity),
    },
    transport: {
      play: () => ipcRenderer.invoke('sp404:transport:play'),
      stop: () => ipcRenderer.invoke('sp404:transport:stop'),
      setBpm: (bpm: number) => ipcRenderer.invoke('sp404:transport:setBpm', bpm),
      onState: (cb: (state: object) => void) => {
        const handler = (_: unknown, state: object) => cb(state);
        ipcRenderer.on('sp404:transport:state', handler);
        return () => ipcRenderer.removeListener('sp404:transport:state', handler);
      },
      onPlayhead: (cb: (pos: object) => void) => {
        const handler = (_: unknown, pos: object) => cb(pos);
        ipcRenderer.on('sp404:pattern:playhead', handler);
        return () => ipcRenderer.removeListener('sp404:pattern:playhead', handler);
      },
    },
    midi: {
      listPorts: () => ipcRenderer.invoke('sp404:midi:listPorts'),
      connect: (inputPort: string, outputPort: string) =>
        ipcRenderer.invoke('sp404:midi:connect', inputPort, outputPort),
      disconnect: () => ipcRenderer.invoke('sp404:midi:disconnect'),
      getStatus: () => ipcRenderer.invoke('sp404:midi:getStatus'),
      onStatus: (cb: (status: { connected: boolean; portName: string | null }) => void) => {
        const handler = (_: unknown, status: { connected: boolean; portName: string | null }) => cb(status);
        ipcRenderer.on('sp404:midi:status', handler);
        return () => ipcRenderer.removeListener('sp404:midi:status', handler);
      },
      onBpm: (cb: (evt: { bpm: number }) => void) => {
        const handler = (_: unknown, evt: { bpm: number }) => cb(evt);
        ipcRenderer.on('sp404:midi:bpm', handler);
        return () => ipcRenderer.removeListener('sp404:midi:bpm', handler);
      },
    },
    pad: {
      onTrigger: (cb: (evt: { note: number; padLabel: string | null; velocity: number; on: boolean }) => void) => {
        const handler = (_: unknown, evt: { note: number; padLabel: string | null; velocity: number; on: boolean }) => cb(evt);
        ipcRenderer.on('sp404:pad:trigger', handler);
        return () => ipcRenderer.removeListener('sp404:pad:trigger', handler);
      },
    },
  },
  emx1: {
    listPorts: () =>
      ipcRenderer.invoke('emx1:listPorts'),
    connect: (inputPort: string | number, outputPort: string | number) =>
      ipcRenderer.invoke('emx1:connect', inputPort, outputPort),
    disconnect: () =>
      ipcRenderer.invoke('emx1:disconnect'),
    requestDump: () =>
      ipcRenderer.invoke('emx1:requestDump'),
    parseDump: (sysexBytes: number[]) =>
      ipcRenderer.invoke('emx1:parseDump', sysexBytes),
    selectPattern: (patternNumber: number) =>
      ipcRenderer.invoke('emx1:selectPattern', patternNumber),
    exportMidi: (pattern: object, outputPath: string) =>
      ipcRenderer.invoke('emx1:exportMidi', pattern, outputPath),
    sendStart: () =>
      ipcRenderer.invoke('emx1:sendStart'),
    sendStop: () =>
      ipcRenderer.invoke('emx1:sendStop'),
    isConnected: () =>
      ipcRenderer.invoke('emx1:isConnected'),
  },
  collections: {
    list: () =>
      ipcRenderer.invoke('collections:list'),
    create: (name: string, description?: string) =>
      ipcRenderer.invoke('collections:create', name, description),
    delete: (id: number) =>
      ipcRenderer.invoke('collections:delete', id),
    rename: (id: number, name: string) =>
      ipcRenderer.invoke('collections:rename', id, name),
    addAsset: (collectionId: number, assetId: number) =>
      ipcRenderer.invoke('collections:addAsset', collectionId, assetId),
    removeAsset: (collectionId: number, assetId: number) =>
      ipcRenderer.invoke('collections:removeAsset', collectionId, assetId),
    listAssets: (collectionId: number) =>
      ipcRenderer.invoke('collections:listAssets', collectionId),
    exportZip: (collectionId: number, outputPath: string) =>
      ipcRenderer.invoke('collections:exportZip', collectionId, outputPath),
  },
  watcher: {
    watchFolder: (path: string) => ipcRenderer.invoke('watcher:watchFolder', path),
    unwatchFolder: (path: string) => ipcRenderer.invoke('watcher:unwatchFolder', path),
    getWatchedFolders: () => ipcRenderer.invoke('watcher:getWatchedFolders'),
  },
  midi: {
    import: (filePaths: string[]) =>
      ipcRenderer.invoke('midi:import', filePaths),
    list: () =>
      ipcRenderer.invoke('midi:list'),
    delete: (id: number) =>
      ipcRenderer.invoke('midi:delete', id),
    linkToAsset: (midiId: number, assetId: number) =>
      ipcRenderer.invoke('midi:linkToAsset', midiId, assetId),
    unlinkFromAsset: (midiId: number, assetId: number) =>
      ipcRenderer.invoke('midi:unlinkFromAsset', midiId, assetId),
    getForAsset: (assetId: number) =>
      ipcRenderer.invoke('midi:getForAsset', assetId),
    getAssetsForMidi: (midiId: number) =>
      ipcRenderer.invoke('midi:getAssetsForMidi', midiId),
    updateTags: (midiId: number, tags: string[]) =>
      ipcRenderer.invoke('midi:updateTags', midiId, tags),
    showImportDialog: () =>
      ipcRenderer.invoke('midi:showImportDialog'),
  },
  generation: {
    listModels: () =>
      ipcRenderer.invoke('generation:listModels'),
    isInstalled: (modelId: string) =>
      ipcRenderer.invoke('generation:isInstalled', modelId),
    install: (modelId: string) =>
      ipcRenderer.invoke('generation:install', modelId),
    generate: (params: { modelId: string; prompt: string; durationSec: number; seed?: number; steps?: number; guidance?: number; outputDir: string }) =>
      ipcRenderer.invoke('generation:generate', params),
  },
  audioToMidi: {
    convert: (params: object) =>
      ipcRenderer.invoke('audioToMidi:convert', params),
    isInstalled: () =>
      ipcRenderer.invoke('audioToMidi:isInstalled'),
    install: () =>
      ipcRenderer.invoke('audioToMidi:install'),
  },
  harmonic: {
    getCompatibleKeys: (key: string) =>
      ipcRenderer.invoke('harmonic:getCompatibleKeys', key),
    findCompatibleAssets: (key: string, assets: any[]) =>
      ipcRenderer.invoke('harmonic:findCompatibleAssets', key, assets),
    getCode: (key: string) =>
      ipcRenderer.invoke('harmonic:getCode', key),
  },
  loop: {
    detect: (filePath: string, bpm?: number) =>
      ipcRenderer.invoke('loop:detect', filePath, bpm),
    extract: (filePath: string, loop: any, outputPath?: string) =>
      ipcRenderer.invoke('loop:extract', filePath, loop, outputPath),
  },
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
