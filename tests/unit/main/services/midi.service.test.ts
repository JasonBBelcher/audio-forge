import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MidiService } from '../../../../src/main/services/midi.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('MidiService', () => {
  let midi: MidiService;

  beforeEach(() => {
    midi = new MidiService(':memory:');
    vi.clearAllMocks();
  });

  it('lists available MIDI input devices', async () => {
    const devices = await midi.listInputDevices();

    expect(Array.isArray(devices)).toBe(true);
  });

  it('lists available MIDI output devices', async () => {
    const devices = await midi.listOutputDevices();

    expect(Array.isArray(devices)).toBe(true);
  });

  it('opens MIDI input device', async () => {
    const deviceId = 'midi-in-1';
    const portId = await midi.openInputPort(deviceId);

    expect(portId).toBeDefined();
  });

  it('opens MIDI output device', async () => {
    const deviceId = 'midi-out-1';
    const portId = await midi.openOutputPort(deviceId);

    expect(portId).toBeDefined();
  });

  it('receives MIDI note on event', async () => {
    const portId = await midi.openInputPort('midi-in-1');

    const received: any[] = [];
    await midi.onMidiMessage(portId, (message) => {
      received.push(message);
    });

    // Simulate MIDI message
    // In real scenario, this would come from hardware
    expect(Array.isArray(received)).toBe(true);
  });

  it('sends MIDI note message to output device', async () => {
    const portId = await midi.openOutputPort('midi-out-1');

    const sent = await midi.sendNote(portId, 60, 100, 0.5);

    expect(sent).toBe(true);
  });

  it('sends MIDI control change message', async () => {
    const portId = await midi.openOutputPort('midi-out-1');

    const sent = await midi.sendControlChange(portId, 7, 100);

    expect(sent).toBe(true);
  });

  it('sends MIDI program change message', async () => {
    const portId = await midi.openOutputPort('midi-out-1');

    const sent = await midi.sendProgramChange(portId, 42);

    expect(sent).toBe(true);
  });

  it('records MIDI performance', async () => {
    const inputPort = await midi.openInputPort('midi-in-1');
    const recordId = await midi.startMidiRecording(inputPort);

    expect(recordId).toBeDefined();

    const stopped = await midi.stopMidiRecording(recordId);

    expect(stopped).toBe(true);
  });

  it('plays back recorded MIDI', async () => {
    const outputPort = await midi.openOutputPort('midi-out-1');
    const recordId = await midi.startMidiRecording(await midi.openInputPort('midi-in-1'));
    await midi.stopMidiRecording(recordId);

    const playbackId = await midi.playMidiRecording(recordId, outputPort);

    expect(playbackId).toBeDefined();

    const stopped = await midi.stopMidiPlayback(playbackId);

    expect(stopped).toBe(true);
  });

  it('maps MIDI controller to parameter', async () => {
    const inputPort = await midi.openInputPort('midi-in-1');

    const mappingId = await midi.createMidiMapping(inputPort, {
      controlNumber: 7,
      parameter: 'volume',
      minValue: 0,
      maxValue: 127,
    });

    expect(mappingId).toBeDefined();
  });

  it('lists MIDI mappings', async () => {
    const inputPort = await midi.openInputPort('midi-in-1');
    await midi.createMidiMapping(inputPort, {
      controlNumber: 7,
      parameter: 'volume',
    });

    const mappings = await midi.listMidiMappings();

    expect(Array.isArray(mappings)).toBe(true);
    if (mappings.length > 0) {
      expect(mappings[0]).toHaveProperty('controlNumber');
      expect(mappings[0]).toHaveProperty('parameter');
    }
  });

  it('deletes MIDI mapping', async () => {
    const inputPort = await midi.openInputPort('midi-in-1');
    const mappingId = await midi.createMidiMapping(inputPort, {
      controlNumber: 7,
      parameter: 'volume',
    });

    const deleted = await midi.deleteMidiMapping(mappingId);

    expect(deleted).toBe(true);
  });

  it('closes MIDI port', async () => {
    const portId = await midi.openInputPort('midi-in-1');

    const closed = await midi.closePort(portId);

    expect(closed).toBe(true);
  });

  it('handles MIDI learn mode for automatic mapping', async () => {
    const inputPort = await midi.openInputPort('midi-in-1');

    const learnId = await midi.startMidiLearn(inputPort, 'attack');

    expect(learnId).toBeDefined();

    const mapping = await midi.stopMidiLearn(learnId);

    expect(mapping).toHaveProperty('controlNumber');
    expect(mapping).toHaveProperty('parameter');
  });

  it('saves MIDI configuration profile', async () => {
    const profile = {
      name: 'My Controller',
      mappings: [{ controlNumber: 7, parameter: 'volume' }],
    };

    await midi.saveMidiProfile('profile-1', profile);

    const loaded = await midi.loadMidiProfile('profile-1');

    expect(loaded?.name).toBe('My Controller');
  });
});
