import { contextBridge, ipcRenderer } from 'electron';

const api = {
  youtube: {
    getInfo: (url: string) => ipcRenderer.invoke('youtube:getInfo', url),
    download: (url: string, trackId: string, outputDir: string) =>
      ipcRenderer.invoke('youtube:download', url, trackId, outputDir),
  },
  audio: {
    analyzeBPM: (filePath: string) => ipcRenderer.invoke('audio:analyzeBPM', filePath),
    analyzeKey: (filePath: string) => ipcRenderer.invoke('audio:analyzeKey', filePath),
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
  video: {},
  sync: {},
  platforms: {},
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
  hardware: {},
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
