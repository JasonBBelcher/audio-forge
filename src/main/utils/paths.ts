import { app } from 'electron';
import path from 'path';

export interface AppPaths {
  userData: string;
  media: string;
  database: string;
  logs: string;
  temp: string;
  resources: string;
  bin: string;
}

export function getAppPaths(): AppPaths {
  const userData = app.getPath('userData');
  return {
    userData,
    media: path.join(userData, 'media'),
    database: path.join(userData, 'audioforge.db'),
    logs: path.join(userData, 'logs'),
    temp: path.join(userData, 'temp'),
    resources: process.resourcesPath ?? path.join(__dirname, '../../resources'),
    bin: path.join(process.resourcesPath ?? path.join(__dirname, '../../resources'), 'bin'),
  };
}
