import type { IpcMain } from 'electron';
import type { ProjectService } from '../services/project.service.js';

export function registerProjectHandlers(ipcMain: IpcMain, projectService: ProjectService): void {
  ipcMain.handle('projects:getAll', async () => {
    return projectService.listProjects();
  });

  ipcMain.handle('projects:create', async (_event, data) => {
    return projectService.createProject(data);
  });

  ipcMain.handle('projects:update', async (_event, id: string, updates) => {
    return projectService.updateProject(id, updates);
  });

  ipcMain.handle('projects:delete', async (_event, id: string) => {
    return projectService.deleteProject(id);
  });

  ipcMain.handle('projects:saveState', async (_event, id: string, state: any) => {
    return projectService.saveState(id, state);
  });
}
