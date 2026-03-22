/**
 * Regression test: prevent duplicate IPC handler registrations.
 *
 * Electron crashes on startup with:
 *   "Attempted to register a second handler for '<channel>'"
 *
 * This test statically scans all TypeScript source files in src/main/
 * and asserts that no ipcMain.handle() channel name appears more than once.
 *
 * History: files:getMediaDir and files:readAsArrayBuffer were registered in
 * both main.ts and fileHandlers.ts, crashing the app on npm run dev.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_MAIN = join(__dirname, '../../../../src/main');

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...getAllTsFiles(full));
    } else if (extname(full) === '.ts' && !full.includes('.spec.') && !full.includes('.test.')) {
      files.push(full);
    }
  }
  return files;
}

function extractHandlerChannels(filePath: string): string[] {
  const src = readFileSync(filePath, 'utf-8');
  const channels: string[] = [];
  // Match: ipcMain.handle('channel-name', ...) or ipcMain.handle("channel-name", ...)
  const re = /ipcMain\.handle\(\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    channels.push(m[1]);
  }
  return channels;
}

describe('IPC handler registration', () => {
  it('has no duplicate ipcMain.handle() channel registrations across all src/main files', () => {
    const files = getAllTsFiles(SRC_MAIN);
    const seen = new Map<string, string[]>(); // channel → [file1, file2, ...]

    for (const file of files) {
      const channels = extractHandlerChannels(file);
      for (const channel of channels) {
        if (!seen.has(channel)) seen.set(channel, []);
        seen.get(channel)!.push(file.replace(SRC_MAIN + '/', ''));
      }
    }

    const duplicates = [...seen.entries()].filter(([, files]) => files.length > 1);

    if (duplicates.length > 0) {
      const report = duplicates
        .map(([ch, files]) => `  '${ch}' registered in:\n${files.map(f => `    - ${f}`).join('\n')}`)
        .join('\n');
      expect.fail(`Duplicate IPC handlers found (Electron will crash):\n${report}`);
    }

    expect(duplicates).toHaveLength(0);
  });
});
