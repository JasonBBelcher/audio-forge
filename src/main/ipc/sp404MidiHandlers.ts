import type { IpcMain, WebContents } from 'electron';
import type { SP404MidiService } from '../services/sp404-midi.service.js';

/**
 * Registers IPC handlers for SP-404 MK2 MIDI connectivity.
 *
 * Service events are forwarded to the renderer via WebContents.send so the
 * UI can react to hardware clock, pad triggers, and connection state changes
 * in real time without polling.
 */
export function registerSP404MidiHandlers(
  ipcMain: IpcMain,
  midiService: SP404MidiService,
  getWebContents: () => WebContents | undefined
): void {
  // ─── Forward service events to renderer ───────────────────────────────────

  midiService.on('transport', (state) => {
    getWebContents()?.send('sp404:transport:state', state);
  });

  midiService.on('playhead', (pos) => {
    getWebContents()?.send('sp404:pattern:playhead', pos);
  });

  midiService.on('padTrigger', (evt) => {
    getWebContents()?.send('sp404:pad:trigger', evt);
  });

  midiService.on('status', (status) => {
    getWebContents()?.send('sp404:midi:status', status);
  });

  midiService.on('bpm', (evt) => {
    getWebContents()?.send('sp404:midi:bpm', evt);
  });

  // ─── IPC request handlers ─────────────────────────────────────────────────

  ipcMain.handle('sp404:midi:listPorts', () => midiService.listPorts());

  ipcMain.handle(
    'sp404:midi:connect',
    (_e, inputPort: string, outputPort: string) => midiService.connect(inputPort, outputPort)
  );

  ipcMain.handle('sp404:midi:disconnect', () => {
    midiService.disconnect();
    return { ok: true };
  });

  ipcMain.handle('sp404:midi:getStatus', () => midiService.getStatus());
}
