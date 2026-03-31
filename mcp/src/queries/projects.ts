import { getDb } from '../db.js';

export interface Project {
  id: number;
  name: string;
  description: string | null;
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  created_at: string;
}

export function listProjects(): Project[] {
  return getDb().prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as Project[];
}

export function getProjectById(id: number): Project | undefined {
  return getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
}

export function createProject(data: { name: string; bpm?: number; key?: string; description?: string }): number {
  const result = getDb().prepare(
    "INSERT INTO projects (name, description, bpm, key, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
  ).run(data.name, data.description ?? null, data.bpm ?? null, data.key ?? null);
  return result.lastInsertRowid as number;
}

export function updateProject(id: number, data: Partial<Project>): void {
  const fields: string[] = [];
  const params: (string | number | null)[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k !== 'id' && k !== 'created_at') { fields.push(`${k} = ?`); params.push(v as string | number | null); }
  }
  if (fields.length === 0) return;
  params.push(id);
  getDb().prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}
