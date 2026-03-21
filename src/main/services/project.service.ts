import Database from 'better-sqlite3';
import { createDatabase, type DatabaseConnection } from '../database/connection.js';
import fs from 'fs';
import path from 'path';

export interface Project {
  id: string;
  name: string;
  description?: string;
  bpm?: number;
  timeSignature?: string;
  key?: string;
  state?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  bpm?: number;
  timeSignature?: string;
  key?: string;
}

export class ProjectService {
  private db: DatabaseConnection;
  private ownedDb: boolean;

  constructor(dbOrPath?: DatabaseConnection | string) {
    if (typeof dbOrPath === 'string' || dbOrPath === undefined) {
      // Create our own DB instance
      const path = dbOrPath || ':memory:';
      this.db = createDatabase(path);
      this.ownedDb = true;
      this.initializeSchema();
    } else {
      // Use provided DB instance (migrations manage schema)
      this.db = dbOrPath;
      this.ownedDb = false;
    }
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        bpm INTEGER,
        timeSignature TEXT,
        key TEXT,
        state TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    const id = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO projects (id, name, description, bpm, key, timeSignature, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.description || null,
      input.bpm || null,
      input.key || null,
      input.timeSignature || null,
      now,
      now
    );

    return {
      id,
      name: input.name,
      description: input.description,
      bpm: input.bpm,
      key: input.key,
      timeSignature: input.timeSignature,
      created_at: now,
      updated_at: now,
    };
  }

  async getProject(id: string): Promise<Project | undefined> {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    return stmt.get(id) as Project | undefined;
  }

  async listProjects(): Promise<Project[]> {
    const stmt = this.db.prepare('SELECT * FROM projects ORDER BY updated_at DESC');
    return stmt.all() as Project[];
  }

  async updateProject(id: string, updates: Partial<CreateProjectInput>): Promise<Project> {
    const now = new Date().toISOString();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.bpm !== undefined) {
      fields.push('bpm = ?');
      values.push(updates.bpm);
    }
    if (updates.timeSignature !== undefined) {
      fields.push('timeSignature = ?');
      values.push(updates.timeSignature);
    }
    if (updates.key !== undefined) {
      fields.push('key = ?');
      values.push(updates.key);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE projects
      SET ${fields.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    const result = await this.getProject(id);
    if (!result) {
      throw new Error(`Project ${id} not found`);
    }

    return result;
  }

  async deleteProject(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM projects WHERE id = ?');
    stmt.run(id);
  }

  async saveState(id: string, state: any): Promise<void> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare('UPDATE projects SET state = ?, updated_at = ? WHERE id = ?');
    stmt.run(JSON.stringify(state), now, id);
  }

  async exportProject(id: string, outputPath: string): Promise<void> {
    const project = await this.getProject(id);
    if (!project) {
      throw new Error(`Project ${id} not found`);
    }

    const exportData = {
      ...project,
      state: project.state ? JSON.parse(project.state) : undefined,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  }

  async importProject(filePath: string): Promise<Project> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    const { id, created_at, updated_at, state, ...input } = data;

    return this.createProject(input);
  }

  async searchProjects(query: string): Promise<Project[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM projects
      WHERE name LIKE ?
      ORDER BY updated_at DESC
    `);

    return stmt.all(`%${query}%`) as Project[];
  }
}
