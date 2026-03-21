import fs from 'fs';
import path from 'path';

export interface LoggerOptions {
  logDir: string;
  console?: boolean;
  namespace?: string;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  debug(message: string, data?: Record<string, unknown>): void;
  child(namespace: string): Logger;
}

function formatEntry(
  level: string,
  message: string,
  namespace: string | undefined,
  data?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const ns = namespace ? `[${namespace}] ` : '';
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `${timestamp} ${level} ${ns}${message}${dataStr}\n`;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getLogFilePath(logDir: string): string {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.join(logDir, `audioforge-${date}.log`);
}

export function createLogger(options: LoggerOptions): Logger {
  const { logDir, console: useConsole = true, namespace } = options;

  ensureDir(logDir);

  function write(level: string, message: string, data?: Record<string, unknown>): void {
    const entry = formatEntry(level, message, namespace, data);
    const filePath = getLogFilePath(logDir);
    fs.appendFileSync(filePath, entry);
    if (useConsole) {
      process.stdout.write(entry);
    }
  }

  return {
    info: (msg, data) => write('INFO', msg, data),
    warn: (msg, data) => write('WARN', msg, data),
    error: (msg, data) => write('ERROR', msg, data),
    debug: (msg, data) => write('DEBUG', msg, data),
    child: (ns) => createLogger({ ...options, namespace: ns }),
  };
}
