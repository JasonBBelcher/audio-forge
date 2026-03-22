#!/usr/bin/env node
/**
 * AudioForge post-install setup script.
 * Runs automatically after `npm install`.
 *
 * - Creates ~/.audioforge-venv with Python 3.12+ for basic-pitch
 * - Installs brew tools (ffmpeg, sox, aubio, yt-dlp) on macOS if missing
 * - Installs demucs via pipx on macOS/Linux
 * - Skips gracefully on Windows (tools require manual setup)
 * - Never fails the overall npm install — all errors are warnings only
 */

import { spawnSync, execSync } from 'child_process';
import { existsSync } from 'fs';
import os from 'os';
import path from 'path';

const platform = process.platform;
const VENV_PATH = path.join(os.homedir(), '.audioforge-venv');
const VENV_PYTHON = path.join(VENV_PATH, 'bin', 'python');
const VENV_PIP = path.join(VENV_PATH, 'bin', 'pip');

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    stdio: opts.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
    timeout: opts.timeout ?? 300_000,
    ...opts,
  });
  return result.status === 0;
}

function commandExists(cmd) {
  try {
    const result = spawnSync(cmd, ['--version'], {
      stdio: 'pipe',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: [
          '/opt/homebrew/bin',
          '/usr/local/bin',
          `${os.homedir()}/.local/bin`,
          process.env.PATH ?? '',
        ].join(':'),
      },
    });
    return result.status === 0;
  } catch {
    return false;
  }
}

function findPython3() {
  for (const py of ['python3.12', 'python3.11', 'python3.10', 'python3']) {
    if (commandExists(py)) return py;
  }
  return null;
}

function info(msg) { console.log(`\x1b[36m[AudioForge setup]\x1b[0m ${msg}`); }
function ok(msg)   { console.log(`\x1b[32m[AudioForge setup]\x1b[0m ✓ ${msg}`); }
function warn(msg) { console.warn(`\x1b[33m[AudioForge setup]\x1b[0m ⚠ ${msg}`); }

// ── Main ──────────────────────────────────────────────────────────────────────

info('Setting up AudioForge optional dependencies…');

// ── 1. Brew tools (macOS only) ────────────────────────────────────────────────
if (platform === 'darwin') {
  const brewTools = ['ffmpeg', 'sox', 'aubio', 'yt-dlp'];

  if (!commandExists('brew')) {
    warn('Homebrew not found. Install it from https://brew.sh then re-run npm install.');
  } else {
    for (const tool of brewTools) {
      if (commandExists(tool)) {
        ok(`${tool} already installed`);
      } else {
        info(`Installing ${tool} via brew…`);
        if (run('brew', ['install', tool])) {
          ok(`${tool} installed`);
        } else {
          warn(`Failed to install ${tool} — run: brew install ${tool}`);
        }
      }
    }
  }
}

// ── 2. pipx + demucs (macOS / Linux) ─────────────────────────────────────────
if (platform === 'darwin' || platform === 'linux') {
  // Ensure pipx
  if (!commandExists('pipx')) {
    info('Installing pipx…');
    if (platform === 'darwin') {
      run('brew', ['install', 'pipx'], { silent: true });
    } else {
      run('pip3', ['install', '--user', 'pipx'], { silent: true });
    }
  }

  if (commandExists('pipx')) {
    if (commandExists('demucs')) {
      ok('demucs already installed');
    } else {
      info('Installing demucs via pipx (this may take a minute)…');
      if (run('pipx', ['install', 'demucs'])) {
        ok('demucs installed');
      } else {
        warn('Failed to install demucs — run: pipx install demucs');
      }
    }
  } else {
    warn('pipx not available — demucs not installed. Run: brew install pipx && pipx install demucs');
  }
}

// ── 3. Python venv for basic-pitch ───────────────────────────────────────────
const python3 = findPython3();
if (!python3) {
  warn('Python 3 not found — basic-pitch (audio→MIDI) unavailable.');
  warn('Install Python 3.12: brew install python@3.12');
} else {
  if (existsSync(VENV_PYTHON)) {
    ok('AudioForge Python venv already exists');
  } else {
    info(`Creating Python venv at ${VENV_PATH} using ${python3}…`);
    if (run(python3, ['-m', 'venv', VENV_PATH])) {
      // Upgrade pip and setuptools first
      run(VENV_PIP, ['install', '--upgrade', 'pip', 'setuptools', 'wheel'], { silent: true });
      ok('Python venv created');
    } else {
      warn(`Failed to create Python venv — basic-pitch will be unavailable`);
    }
  }

  // Install basic-pitch into venv
  if (existsSync(VENV_PYTHON)) {
    const basicPitchBin = path.join(VENV_PATH, 'bin', 'basic-pitch');
    if (existsSync(basicPitchBin)) {
      ok('basic-pitch already installed');
    } else {
      info('Installing basic-pitch into Python venv (this may take a few minutes)…');
      if (run(VENV_PIP, ['install', 'basic-pitch'], { timeout: 600_000 })) {
        ok('basic-pitch installed');
      } else {
        warn('basic-pitch install failed — audio→MIDI conversion will be unavailable');
      }
    }
  }
}

info('Setup complete. Run `npm run dev` to start AudioForge.');
