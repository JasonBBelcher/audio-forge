import { spawn } from 'child_process';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** Poll until the built output file exists. */
function waitForFile(filePath, { timeout = 30000, interval = 200 } = {}) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout;
    const check = () => {
      if (existsSync(filePath)) return resolve();
      if (Date.now() > deadline) return reject(new Error(`File not ready: ${filePath}`));
      setTimeout(check, interval);
    };
    check();
  });
}

async function startDev() {
  // 1. Start Vite dev server for the renderer
  const vite = await createServer({
    configFile: path.join(root, 'vite.config.ts'),
    server: { port: 5173 },
  });
  await vite.listen();
  console.log('Vite dev server running at http://localhost:5173');

  // 2. Build main process with tsup in watch mode
  const tsup = spawn(
    'npx',
    [
      'tsup',
      'src/main/main.ts',
      'src/main/preload.ts',
      '--outDir', 'dist/main',
      '--format', 'cjs',
      '--target', 'node20',
      '--external', 'electron',
      '--watch',
      '--onSuccess', 'echo "Main process built"',
    ],
    { cwd: root, stdio: 'inherit', shell: true }
  );

  // 3. Wait for the compiled main entry to actually exist
  // Note: vite.listen() already resolves when the server is bound, so no port polling needed.
  console.log('Waiting for main process build...');
  await waitForFile(path.join(root, 'dist/main/main.cjs'));
  console.log('Ready — launching Electron');

  // 4. Launch Electron
  const electron = spawn(
    'npx',
    ['electron', 'dist/main/main.cjs'],
    {
      cwd: root,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    }
  );

  electron.on('close', () => {
    tsup.kill();
    vite.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error('Dev startup failed:', err);
  process.exit(1);
});
