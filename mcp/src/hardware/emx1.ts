import { MEDIA_DIR } from '../constants.js';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';

export interface EMX1Pattern {
  name: string;
  bpm: number;
  steps: { part: number; step: number; velocity: number }[];
}

export function exportEmx1ToMidi(pattern: EMX1Pattern): string {
  const outputPath = join(MEDIA_DIR, 'emx1', `${pattern.name}.mid`);

  const header = Buffer.from([
    0x4D, 0x54, 0x68, 0x64, // MThd
    0x00, 0x00, 0x00, 0x06, // length 6
    0x00, 0x00,             // format 0
    0x00, 0x01,             // 1 track
    0x00, 0x60,             // 96 ticks per beat
  ]);

  const events: number[] = [];
  const ticksPerStep = 24;

  for (const step of pattern.steps.sort((a, b) => a.step - b.step)) {
    const noteNum = 36 + step.part;
    const delta = step.step * ticksPerStep;
    events.push(delta, 0x99, noteNum, step.velocity);
    events.push(1, 0x89, noteNum, 0);
  }

  events.push(0, 0xFF, 0x2F, 0x00);

  const trackData = Buffer.from(events);
  const trackHeader = Buffer.from([
    0x4D, 0x54, 0x72, 0x6B, // MTrk
    ...[(trackData.length >> 24) & 0xFF, (trackData.length >> 16) & 0xFF,
        (trackData.length >> 8) & 0xFF, trackData.length & 0xFF],
  ]);

  mkdirSync(join(MEDIA_DIR, 'emx1'), { recursive: true });
  writeFileSync(outputPath, Buffer.concat([header, trackHeader, trackData]));

  return outputPath;
}
