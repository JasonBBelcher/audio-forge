import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProjectService, Project } from '../../../../src/main/services/project.service.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('ProjectService', () => {
  let project: ProjectService;
  let tmpDir: string;

  beforeEach(() => {
    project = new ProjectService(':memory:');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-project-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a new project', async () => {
    const projectData = {
      name: 'New Song',
      description: 'A great track',
      bpm: 120,
      timeSignature: '4/4',
    };

    const created = await project.createProject(projectData);

    expect(created).toHaveProperty('id');
    expect(created.name).toBe('New Song');
    expect(created.description).toBe('A great track');
    expect(created.bpm).toBe(120);
    expect(created.timeSignature).toBe('4/4');
    expect(created).toHaveProperty('created_at');
    expect(created).toHaveProperty('updated_at');
  });

  it('retrieves a project by ID', async () => {
    const projectData = { name: 'Test Project', bpm: 140 };
    const created = await project.createProject(projectData);

    const retrieved = await project.getProject(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.name).toBe('Test Project');
    expect(retrieved?.bpm).toBe(140);
  });

  it('lists all projects', async () => {
    await project.createProject({ name: 'Project 1', bpm: 120 });
    await project.createProject({ name: 'Project 2', bpm: 130 });
    await project.createProject({ name: 'Project 3', bpm: 140 });

    const projects = await project.listProjects();

    expect(projects.length).toBeGreaterThanOrEqual(3);
    expect(projects.some((p) => p.name === 'Project 1')).toBe(true);
    expect(projects.some((p) => p.name === 'Project 2')).toBe(true);
    expect(projects.some((p) => p.name === 'Project 3')).toBe(true);
  });

  it('updates a project', async () => {
    const created = await project.createProject({ name: 'Original', bpm: 120 });

    const updated = await project.updateProject(created.id, { name: 'Updated', bpm: 130 });

    expect(updated.name).toBe('Updated');
    expect(updated.bpm).toBe(130);
    expect(updated.id).toBe(created.id);
  });

  it('deletes a project', async () => {
    const created = await project.createProject({ name: 'To Delete', bpm: 120 });

    await project.deleteProject(created.id);

    const retrieved = await project.getProject(created.id);
    expect(retrieved).toBeUndefined();
  });

  it('saves project state', async () => {
    const created = await project.createProject({ name: 'Stateful', bpm: 120 });

    const state = { tracks: 8, selectedTrack: 2, zoom: 1.5 };
    await project.saveState(created.id, state);

    const retrieved = await project.getProject(created.id);
    expect(retrieved?.state).toBeDefined();
    expect(JSON.parse(retrieved?.state || '{}')).toEqual(state);
  });

  it('exports project to file', async () => {
    const created = await project.createProject({ name: 'Exportable', bpm: 120 });
    const exportPath = path.join(tmpDir, 'project.json');

    await project.exportProject(created.id, exportPath);

    expect(fs.existsSync(exportPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    expect(content.name).toBe('Exportable');
    expect(content.bpm).toBe(120);
  });

  it('imports project from file', async () => {
    const projectData = {
      name: 'Imported Project',
      bpm: 110,
      timeSignature: '3/4',
      description: 'Imported',
    };
    const importPath = path.join(tmpDir, 'import.json');
    fs.writeFileSync(importPath, JSON.stringify(projectData));

    const imported = await project.importProject(importPath);

    expect(imported.name).toBe('Imported Project');
    expect(imported.bpm).toBe(110);
    expect(imported.timeSignature).toBe('3/4');
  });

  it('filters projects by name', async () => {
    await project.createProject({ name: 'Alpha Project', bpm: 120 });
    await project.createProject({ name: 'Beta Song', bpm: 130 });
    await project.createProject({ name: 'Alpha Song', bpm: 140 });

    const results = await project.searchProjects('Alpha');

    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((p) => p.name.includes('Alpha'))).toBe(true);
  });

  it('returns undefined for non-existent project', async () => {
    const retrieved = await project.getProject('non-existent-id');
    expect(retrieved).toBeUndefined();
  });
});
