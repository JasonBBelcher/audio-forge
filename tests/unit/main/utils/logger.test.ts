import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createLogger, Logger } from '../../../../src/main/utils/logger.js';

describe('Logger', () => {
  let logger: Logger;
  let logDir: string;

  beforeEach(() => {
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-log-test-'));
    logger = createLogger({ logDir, console: false });
  });

  afterEach(() => {
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  it('creates a logger with info, warn, error, debug methods', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('writes log entries to a file', () => {
    logger.info('test message');

    const files = fs.readdirSync(logDir);
    expect(files.length).toBeGreaterThan(0);

    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    expect(content).toContain('test message');
  });

  it('includes log level in entries', () => {
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    expect(content).toContain('INFO');
    expect(content).toContain('WARN');
    expect(content).toContain('ERROR');
  });

  it('includes timestamp in entries', () => {
    logger.info('timestamped');

    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    // Should contain ISO-like timestamp
    expect(content).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('supports structured data as second argument', () => {
    logger.info('structured', { key: 'value', count: 42 });

    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    expect(content).toContain('key');
    expect(content).toContain('value');
  });

  it('creates log directory if it does not exist', () => {
    const newDir = path.join(logDir, 'nested', 'logs');
    const nestedLogger = createLogger({ logDir: newDir, console: false });
    nestedLogger.info('nested log');

    expect(fs.existsSync(newDir)).toBe(true);
  });

  it('supports namespaced loggers via child()', () => {
    const childLogger = logger.child('myService');
    childLogger.info('child message');

    const files = fs.readdirSync(logDir);
    const content = fs.readFileSync(path.join(logDir, files[0]), 'utf-8');
    expect(content).toContain('myService');
    expect(content).toContain('child message');
  });
});
