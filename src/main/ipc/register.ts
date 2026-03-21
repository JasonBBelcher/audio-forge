import { ipcMain } from 'electron';

export function registerIPCHandler(
  channel: string,
  handler: (args: unknown) => Promise<unknown>
): void {
  ipcMain.handle(channel, async (_event, args) => {
    try {
      return await handler(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { error: message };
    }
  });
}
