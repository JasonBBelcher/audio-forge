import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginService } from '../../../../src/main/services/plugin.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('PluginService', () => {
  let plugin: PluginService;

  beforeEach(() => {
    plugin = new PluginService(':memory:');
    vi.clearAllMocks();
  });

  it('scans for available plugins', async () => {
    const plugins = await plugin.scanPlugins();

    expect(Array.isArray(plugins)).toBe(true);
  });

  it('discovers VST plugins', async () => {
    const vsts = await plugin.discoverVSTPlugins();

    expect(Array.isArray(vsts)).toBe(true);
  });

  it('discovers AU plugins (macOS)', async () => {
    const aus = await plugin.discoverAUPlugins();

    expect(Array.isArray(aus)).toBe(true);
  });

  it('loads a plugin', async () => {
    const pluginId = 'vst:com.example.plugin';
    const loaded = await plugin.loadPlugin(pluginId);

    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe(pluginId);
    expect(loaded?.status).toBe('loaded');
  });

  it('unloads a plugin', async () => {
    const pluginId = 'vst:com.example.plugin';
    await plugin.loadPlugin(pluginId);

    const unloaded = await plugin.unloadPlugin(pluginId);

    expect(unloaded).toBe(true);
  });

  it('gets plugin information', async () => {
    const pluginId = 'vst:com.example.synth';
    const info = await plugin.getPluginInfo(pluginId);

    expect(info).toBeDefined();
    expect(info?.id).toBe(pluginId);
    expect(info).toHaveProperty('name');
    expect(info).toHaveProperty('vendor');
    expect(info).toHaveProperty('category');
  });

  it('lists plugin parameters', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    const params = await plugin.getPluginParameters(pluginId);

    expect(Array.isArray(params)).toBe(true);
    if (params.length > 0) {
      expect(params[0]).toHaveProperty('id');
      expect(params[0]).toHaveProperty('name');
      expect(params[0]).toHaveProperty('min');
      expect(params[0]).toHaveProperty('max');
      expect(params[0]).toHaveProperty('defaultValue');
    }
  });

  it('sets plugin parameter value', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    const set = await plugin.setPluginParameter(pluginId, 'cutoff', 0.7);

    expect(set).toBe(true);
  });

  it('gets plugin parameter value', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    await plugin.setPluginParameter(pluginId, 'cutoff', 0.7);
    const value = await plugin.getPluginParameter(pluginId, 'cutoff');

    expect(typeof value).toBe('number');
    expect(value).toBeCloseTo(0.7, 1);
  });

  it('processes audio through plugin', async () => {
    const pluginId = 'vst:com.example.effect';
    await plugin.loadPlugin(pluginId);

    const inputBuffer = new Float32Array(512);
    const result = await plugin.processAudio(pluginId, inputBuffer);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(512);
  });

  it('manages plugin presets', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    await plugin.setPluginParameter(pluginId, 'cutoff', 0.7);
    await plugin.setPluginParameter(pluginId, 'resonance', 0.5);

    const presetId = await plugin.savePreset(pluginId, 'My Preset');

    expect(presetId).toBeDefined();
  });

  it('loads plugin preset', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    const presetId = await plugin.savePreset(pluginId, 'Test Preset');
    await plugin.loadPreset(pluginId, presetId);

    const cutoff = await plugin.getPluginParameter(pluginId, 'cutoff');
    const resonance = await plugin.getPluginParameter(pluginId, 'resonance');

    expect(typeof cutoff).toBe('number');
    expect(typeof resonance).toBe('number');
  });

  it('lists saved presets for plugin', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    await plugin.savePreset(pluginId, 'Preset 1');
    await plugin.savePreset(pluginId, 'Preset 2');

    const presets = await plugin.listPresets(pluginId);

    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThanOrEqual(2);
  });

  it('exports plugin preset', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    const presetId = await plugin.savePreset(pluginId, 'Export Me');
    const exported = await plugin.exportPreset(presetId, '/tmp/preset.fxp');

    expect(exported).toBe(true);
  });

  it('imports plugin preset', async () => {
    const pluginId = 'vst:com.example.synth';
    await plugin.loadPlugin(pluginId);

    const imported = await plugin.importPreset(pluginId, '/tmp/preset.fxp');

    expect(imported).toBeDefined();
    expect(imported?.id).toBeDefined();
  });

  it('validates plugin before loading', async () => {
    const valid = await plugin.validatePlugin('vst:com.example.valid');

    expect(typeof valid).toBe('boolean');
  });

  it('handles plugin crash gracefully', async () => {
    const badPlugin = 'vst:com.example.crasher';
    await plugin.loadPlugin(badPlugin);

    const recovered = await plugin.recoverFromCrash(badPlugin);

    expect(recovered).toBe(true);
  });

  it('manages plugin favorites', async () => {
    const pluginId = 'vst:com.example.favorite';

    const added = await plugin.addToFavorites(pluginId);

    expect(added).toBe(true);

    const favorites = await plugin.getFavorites();

    expect(favorites.some((p) => p === pluginId)).toBe(true);
  });

  it('removes plugin from favorites', async () => {
    const pluginId = 'vst:com.example.unfavorite';

    await plugin.addToFavorites(pluginId);
    await plugin.removeFromFavorites(pluginId);

    const favorites = await plugin.getFavorites();

    expect(favorites.some((p) => p === pluginId)).toBe(false);
  });
});
