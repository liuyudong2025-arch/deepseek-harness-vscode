const { spawn } = require('child_process');

const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'npx.cmd', '--version'], {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
child.once('error', error => {
  console.error(error);
  process.exitCode = 2;
});
child.once('exit', code => {
  process.exitCode = code ?? 1;
});
