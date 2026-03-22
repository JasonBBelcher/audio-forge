import { IpcMain } from 'electron';
import { AudioToMidiService, type AudioToMidiParams } from '../services/audio-to-midi.service.js';
import { MidiFilesService } from '../services/midi-files.service.js';
import { QueueService } from '../services/queue.service.js';

export function registerAudioToMidiHandlers(
  ipcMain: IpcMain,
  audioToMidiService: AudioToMidiService,
  midiFilesService: MidiFilesService,
  queueService: QueueService
): void {
  /**
   * Convert audio to MIDI and queue the job
   */
  ipcMain.handle('audioToMidi:convert', async (_e, params: AudioToMidiParams) => {
    const jobId = queueService.enqueue('audio-to-midi', params);
    return { jobId };
  });

  /**
   * Check if basic_pitch is installed
   */
  ipcMain.handle('audioToMidi:isInstalled', async () => {
    const installed = await audioToMidiService.isInstalled();
    return { installed };
  });

  /**
   * Install basic_pitch via pip
   */
  ipcMain.handle('audioToMidi:install', async () => {
    const jobId = queueService.enqueue('install-basic-pitch', {});
    return { jobId };
  });
}
