import { spawn } from 'child_process';
import { createServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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

  // Wait for initial build
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // 3. Launch Electron
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
