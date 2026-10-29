import { spawn } from 'node:child_process';
import { cp } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const next = fileURLToPath(new URL('../../../node_modules/next/dist/bin/next', import.meta.url));
const build = spawn(process.execPath, [next, 'build'], { stdio: 'inherit' });
const active = { child: build };
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => active.child.kill(signal));
}
const exitCode = await new Promise((resolve, reject) => {
  build.once('error', reject);
  build.once('exit', (code) => resolve(code ?? 1));
});
if (exitCode !== 0) process.exit(exitCode);

await cp('.next/static', '.next/standalone/.next/static', { recursive: true });
await cp('public', '.next/standalone/public', { recursive: true });
const server = spawn(process.execPath, ['.next/standalone/server.js'], {
  stdio: 'inherit',
  env: { ...process.env, HOSTNAME: '127.0.0.1' },
});
active.child = server;
server.once('error', (error) => {
  console.error('No se pudo arrancar el servidor de pruebas:', error.message);
  process.exitCode = 1;
});
server.once('exit', (code) => {
  process.exitCode = code ?? 0;
});
