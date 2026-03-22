import type { IpcMain, WebContents } from 'electron';
import type { SP404CompanionService } from '../services/sp404-companion.service.js';
import type { AudioService } from '../services/audio.service.js';
import type { SP404Service } from '../services/sp404.service.js';
import type { SP404MidiService } from '../services/sp404-midi.service.js';
import * as fs from 'fs';
import * as path from 'path';

export function registerSP404CompanionHandlers(
  ipcMain: IpcMain,
  companionService: SP404CompanionService,
  audioService: AudioService,
  sp404Service: SP404Service,
  getWebContents?: () => WebContents | undefined,
  midiService?: SP404MidiService
): void {
  // Companion state
  ipcMain.handle('sp404:companion:getState', (_e, padRef: string) => companionService.getState(padRef));
  ipcMain.handle('sp404:companion:setState', (_e, padRef: string, state: object) => companionService.setState(padRef, state as any));

  // Chops
  ipcMain.handle('sp404:companion:getChops', (_e, assetId: number) => companionService.getChops(assetId));
  ipcMain.handle('sp404:companion:setChops', (_e, assetId: number, chops: object[]) => companionService.setChops(assetId, chops as any));

  // Waveform
  ipcMain.handle('sp404:waveform:load', async (_e, padRef: string, filePath: string) => {
    const [waveform] = await Promise.allSettled([
      audioService.analyzeWaveform(filePath),
      Promise.resolve(companionService.getChops(0)),
    ]);
    return {
      peaks: waveform.status === 'fulfilled' ? waveform.value : [],
      padRef,
    };
  });

  ipcMain.handle('sp404:waveform:analyze', async (_e, filePath: string, durationSec: number) => {
    return companionService.getBeatGrid(filePath, durationSec);
  });

  // Chop operations
  ipcMain.handle('sp404:chop:detect', async (_e, filePath: string, mode: string, options: object) => {
    return companionService.autoChop(filePath, mode as any, options as any);
  });

  ipcMain.handle('sp404:chop:export', async (_e, assetId: number, sdCardPath: string, filePath?: string) => {
    const chops = companionService.getChops(assetId);

    if (chops.length === 0) {
      return { exported: 0, skipped: 0 };
    }

    if (!filePath) {
      return { exported: 0, skipped: 0, error: 'No file path provided for chop export' };
    }

    // Determine the actual file duration so we can convert normalized offsets to seconds
    let durationSec: number;
    try {
      durationSec = await audioService.getDuration(filePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { exported: 0, skipped: 0, error: `Could not read file duration: ${message}` };
    }

    const importDir = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'IMPORT');
    fs.mkdirSync(importDir, { recursive: true });

    let exported = 0;
    let skipped = 0;

    for (let i = 0; i < chops.length; i++) {
      const chop = chops[i];
      const padIndex = String(i + 1).padStart(3, '0');
      const outPath = path.join(importDir, `${padIndex}.WAV`);

      const startSec = chop.startOffset * durationSec;
      const endSec = chop.endOffset * durationSec;

      let trimmedPath: string | null = null;
      let convertedPath: string | null = null;

      try {
        // Step 1: trim to chop boundaries — AudioService generates the output path
        trimmedPath = await audioService.trim(filePath, startSec, endSec);

        // Step 2: re-encode to SP-404 MK2 spec (48 kHz, stereo, WAV)
        // convertFormat generates its own output path based on the format extension
        convertedPath = await audioService.convertFormat(trimmedPath, 'wav', {
          sampleRate: 48000,
          channels: 2,
        });

        // Step 3: move the converted file to the final destination
        fs.renameSync(convertedPath, outPath);
        convertedPath = null; // consumed by rename

        exported++;
      } catch (err) {
        console.error(`[SP404] Failed to export chop ${i}:`, err);
        skipped++;
      } finally {
        // Clean up intermediate files that were not moved to outPath
        if (trimmedPath) {
          try { fs.unlinkSync(trimmedPath); } catch { /* ignore */ }
        }
        if (convertedPath) {
          try { fs.unlinkSync(convertedPath); } catch { /* ignore */ }
        }
      }
    }

    return { exported, skipped, importDir };
  });

  // Pattern
  ipcMain.handle('sp404:pattern:load', (_e, patternRef: string) => {
    const pattern = companionService.getPattern(patternRef);
    if (pattern) return pattern;
    const defaultParts = Array.from({ length: 8 }, (_, i) => ({
      padRef: `A${String(i + 1).padStart(2, '0')}`,
      label: `Part ${i + 1}`,
      color: ['#e53935','#8e24aa','#1e88e5','#00acc1','#43a047','#fb8c00','#fdd835','#6d4c41'][i],
      steps: Array.from({ length: 16 }, () => ({ active: false, velocity: 100, substep: 'none', pitchOffset: 0 })),
      muted: false,
      volume: 1,
    }));
    return { patternRef, bpm: 120, bars: 1, parts: defaultParts };
  });

  ipcMain.handle('sp404:pattern:save', (_e, data: object) => {
    companionService.savePattern(data as any);
  });

  ipcMain.handle('sp404:pattern:setStep', (_e, patternRef: string, partIndex: number, stepIndex: number, values: object) => {
    const pattern = companionService.getPattern(patternRef);
    if (!pattern) return null;
    if (pattern.parts[partIndex]?.steps[stepIndex]) {
      Object.assign(pattern.parts[partIndex].steps[stepIndex], values);
      companionService.savePattern(pattern);
    }
    return pattern;
  });

  ipcMain.handle('sp404:pattern:setVelocity', (_e, patternRef: string, partIndex: number, stepIndex: number, velocity: number) => {
    const pattern = companionService.getPattern(patternRef);
    if (!pattern) return null;
    if (pattern.parts[partIndex]?.steps[stepIndex]) {
      pattern.parts[partIndex].steps[stepIndex].velocity = velocity;
      companionService.savePattern(pattern);
    }
    return pattern;
  });

  // Transport — delegates to MIDI service when connected, otherwise software-only no-op
  ipcMain.handle('sp404:transport:play', () => {
    if (midiService?.isConnected()) {
      midiService.sendStart();
    }
    return { ok: true };
  });

  ipcMain.handle('sp404:transport:stop', () => {
    if (midiService?.isConnected()) {
      midiService.sendStop();
    }
    return { ok: true };
  });

  ipcMain.handle('sp404:transport:setBpm', (_e, bpm: number) => {
    midiService?.setBpm(bpm);
    return { bpm };
  });
}
