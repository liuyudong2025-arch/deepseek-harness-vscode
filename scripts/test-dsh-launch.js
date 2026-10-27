const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const child = spawn(process.env.ComSpec || 'cmd.exe', [
  '/d', '/c', 'dsh.cmd', 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'
], {
  cwd: process.cwd(),
  env: { ...process.env, DSH_HOME: path.join(os.tmpdir(), 'dsh-vscode-launch-test') },
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe']
});

let found = false;
let timer;
const inspect = data => {
  const text = data.toString();
  process.stdout.write(text);
  if (!found && /dsh web:\s+https?:\/\/\S+/i.test(text)) {
    found = true;
    clearTimeout(timer);
    spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
  }
};
child.stdout.on('data', inspect);
child.stderr.on('data', inspect);
child.on('error', error => { console.error(error); process.exitCode = 2; });
timer = setTimeout(() => {
  if (!found) {
    console.error('TEST_TIMEOUT');
    spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    process.exitCode = 1;
  }
}, 120000);
