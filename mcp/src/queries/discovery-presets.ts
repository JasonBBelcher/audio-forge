import { getDb } from '../db.js';
import { z } from 'zod';

export const DiscoveryFiltersSchema = z.object({
  genres: z.array(z.string()).optional(),
  styles: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  yearMin: z.number().optional(),
  yearMax: z.number().optional(),
  bpmMin: z.number().optional(),
  bpmMax: z.number().optional(),
  key: z.string().optional(),
  maxViews: z.number().optional(),
  minViews: z.number().optional(),
  minDuration: z.number().optional(),
  maxDuration: z.number().optional(),
  excludeChannels: z.array(z.string()).optional(),
});

export type DiscoveryFilters = z.infer<typeof DiscoveryFiltersSchema>;

export interface Preset {
  id: number;
  name: string;
  filters_json: string;
  created_at: string;
}

export function savePreset(name: string, filters: DiscoveryFilters): number {
  const filtersJson = JSON.stringify(filters);
  const result = getDb()
    .prepare("INSERT INTO discovery_presets (name, filters_json, created_at) VALUES (?, ?, datetime('now'))")
    .run(name, filtersJson);

  return result.lastInsertRowid as number;
}

export function loadPreset(name: string): DiscoveryFilters | undefined {
  const preset = getDb().prepare('SELECT filters_json FROM discovery_presets WHERE name = ?').get(name) as { filters_json: string } | undefined;

  if (!preset) return undefined;

  try {
    return JSON.parse(preset.filters_json) as DiscoveryFilters;
  } catch {
    return undefined;
  }
}

export function listPresets(): Preset[] {
  return getDb().prepare('SELECT * FROM discovery_presets ORDER BY created_at DESC').all() as Preset[];
}

export function deletePreset(id: number): void {
  getDb().prepare('DELETE FROM discovery_presets WHERE id = ?').run(id);
}

export function updatePreset(id: number, name: string, filters: DiscoveryFilters): void {
  const filtersJson = JSON.stringify(filters);
  getDb().prepare('UPDATE discovery_presets SET name = ?, filters_json = ? WHERE id = ?').run(name, filtersJson, id);
}
