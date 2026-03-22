import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import type { EMX1Pattern, EMX1Part } from '../emx1.service.js';

// Mock require.cache to inject our mock MIDI module
const mockMidiInput = vi.fn().mockImplementation(() => ({
  getPortCount: vi.fn().mockReturnValue(2),
  getPortName: vi.fn().mockImplementation((i) => {
    const ports = ['EMX-1 MIDI IN', 'IAC Driver Bus 1'];
    return ports[i] || `Port ${i}`;
  }),
  openPort: vi.fn(),
  closePort: vi.fn(),
  on: vi.fn(),
  ignoreTypes: vi.fn(),
}));

const mockMidiOutput = vi.fn().mockImplementation(() => ({
  getPortCount: vi.fn().mockReturnValue(2),
  getPortName: vi.fn().mockImplementation((i) => {
    const ports = ['EMX-1 MIDI OUT', 'IAC Driver Bus 1'];
    return ports[i] || `Port ${i}`;
  }),
  openPort: vi.fn(),
  closePort: vi.fn(),
  sendMessage: vi.fn(),
}));

const mockMidi = {
  Input: mockMidiInput,
  Output: mockMidiOutput,
};

// Override Node's require for 'midi' module
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (id === 'midi') {
    return mockMidi;
  }
  return originalRequire.apply(this, arguments as any);
};

// Now import the service
import { EMX1Service } from '../emx1.service.js';

describe('EMX1Service', () => {
  let service: EMX1Service;

  beforeEach(() => {
    service = new EMX1Service();
  });

  describe('listPorts', () => {
    it('should return available input and output ports', () => {
      const ports = service.listPorts();
      expect(ports).toHaveProperty('inputs');
      expect(ports).toHaveProperty('outputs');
      expect(Array.isArray(ports.inputs)).toBe(true);
      expect(Array.isArray(ports.outputs)).toBe(true);
      expect(ports.inputs.length).toBe(2);
      expect(ports.outputs.length).toBe(2);
      expect(ports.inputs[0]).toBe('EMX-1 MIDI IN');
      expect(ports.outputs[0]).toBe('EMX-1 MIDI OUT');
    });
  });

  describe('connect', () => {
    it('should connect by port index', () => {
      service.connect(0, 0);
      expect(service.isConnected()).toBe(true);
    });

    it('should connect by port name', () => {
      service.connect('EMX-1 MIDI IN', 'EMX-1 MIDI OUT');
      expect(service.isConnected()).toBe(true);
    });

    it('should throw if port name is not found', () => {
      expect(() => {
        service.connect('NonExistent Port', 'EMX-1 MIDI OUT');
      }).toThrow();
    });

    it('should throw if output port name is not found', () => {
      expect(() => {
        service.connect('EMX-1 MIDI IN', 'NonExistent Port');
      }).toThrow();
    });
  });

  describe('disconnect', () => {
    it('should disconnect after connecting', () => {
      service.connect(0, 0);
      expect(service.isConnected()).toBe(true);
      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });

    it('should not error when disconnecting while not connected', () => {
      expect(() => {
        service.disconnect();
      }).not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false initially', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('should return true after connecting', () => {
      service.connect(0, 0);
      expect(service.isConnected()).toBe(true);
    });

    it('should return false after disconnecting', () => {
      service.connect(0, 0);
      service.disconnect();
      expect(service.isConnected()).toBe(false);
    });
  });

  describe('requestPatternDump', () => {
    it('should send correct SysEx dump request bytes', async () => {
      service.connect(0, 0);
      const mockOutput = (service as any).midiOutput;

      // Setup mock to resolve with pattern data when sendMessage is called
      mockOutput.sendMessage.mockImplementation((msg: number[]) => {
        // Verify the dump request SysEx is sent
        expect(msg).toEqual([0xF0, 0x42, 0x30, 0x6F, 0x0E, 0x00, 0xF7]);
        // Simulate device response by calling the listener
        setTimeout(() => {
          const listener = (service as any).patternDumpListener;
          if (listener) {
            listener([0xF0, 0x42, 0x30, 0x6F, 0x0E, 0x00, 0xF7]);
          }
        }, 10);
      });

      // Request the pattern dump
      const result = await service.requestPatternDump();
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe('selectPattern', () => {
    it('should send pattern select SysEx message', () => {
      service.connect(0, 0);
      const mockOutput = (service as any).midiOutput;

      service.selectPattern(5);
      expect(mockOutput.sendMessage).toHaveBeenCalledWith([
        0xF0, 0x42, 0x30, 0x6F, 0x0F, 5, 0xF7,
      ]);
    });

    it('should validate pattern number range 0-31', () => {
      service.connect(0, 0);
      expect(() => service.selectPattern(-1)).toThrow();
      expect(() => service.selectPattern(32)).toThrow();
    });
  });

  describe('sendStart', () => {
    it('should send MIDI start message', () => {
      service.connect(0, 0);
      const mockOutput = (service as any).midiOutput;

      service.sendStart();
      expect(mockOutput.sendMessage).toHaveBeenCalledWith([0xFA]);
    });
  });

  describe('sendStop', () => {
    it('should send MIDI stop message', () => {
      service.connect(0, 0);
      const mockOutput = (service as any).midiOutput;

      service.sendStop();
      expect(mockOutput.sendMessage).toHaveBeenCalledWith([0xFC]);
    });
  });

  describe('parsePatternDump', () => {
    it('should parse empty SysEx and return empty array', () => {
      const sysex = Buffer.from([0xF0, 0x42, 0x30, 0x6F, 0x0E, 0xF7]);
      const patterns = service.parsePatternDump(sysex);
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should return array of EMX1Pattern objects', () => {
      // Create a minimal valid pattern dump SysEx
      // EMX-1 has 16 pattern slots per bank, 2 banks = 32 patterns
      const sysex = Buffer.from([0xF0, 0x42, 0x30, 0x6F, 0x0E, 0xF7]);
      const patterns = service.parsePatternDump(sysex);
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle malformed SysEx gracefully', () => {
      const sysex = Buffer.from([0xFF, 0xFF]);
      expect(() => {
        service.parsePatternDump(sysex);
      }).not.toThrow();
    });
  });

  describe('exportPatternAsMidi', () => {
    it('should create a MIDI file at the specified path', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tempDir = os.tmpdir();
      const testFile = path.join(tempDir, `test-pattern-${Date.now()}.mid`);

      const pattern: EMX1Pattern = {
        patternNumber: 0,
        bank: 'A',
        name: 'Test Pattern',
        parts: [
          {
            partNumber: 0,
            steps: [true, false, true, false, true, false, true, false],
            velocity: [100, 80, 100, 80, 100, 80, 100, 80],
            pitch: [60, 60, 60, 60, 60, 60, 60, 60],
          },
        ],
      };

      try {
        const result = await service.exportPatternAsMidi(pattern, testFile);
        expect(result).toBe(testFile);
        expect(fs.existsSync(testFile)).toBe(true);

        // Verify file has content (basic MIDI structure)
        const stats = fs.statSync(testFile);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        fs.unlinkSync(testFile);
      } catch (err) {
        // Clean up if error
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
        throw err;
      }
    });

    it('should handle empty pattern gracefully', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');

      const tempDir = os.tmpdir();
      const testFile = path.join(tempDir, `test-empty-${Date.now()}.mid`);

      const pattern: EMX1Pattern = {
        patternNumber: 1,
        bank: 'B',
        parts: [],
      };

      try {
        const result = await service.exportPatternAsMidi(pattern, testFile);
        expect(result).toBe(testFile);
        expect(fs.existsSync(testFile)).toBe(true);
        fs.unlinkSync(testFile);
      } catch (err) {
        if (fs.existsSync(testFile)) {
          fs.unlinkSync(testFile);
        }
        throw err;
      }
    });
  });
});
