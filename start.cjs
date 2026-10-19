// PM2 wrapper — PM2 7.x runs ESM as eval, breaking import.meta.url.
// This CJS wrapper forks server.mjs as a proper child process.
const { fork } = require('child_process');
const path = require('path');

const child = fork(path.join(__dirname, 'server.mjs'), [], {
  cwd: __dirname,
  stdio: 'inherit',
});

child.on('exit', (code) => process.exit(code ?? 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
