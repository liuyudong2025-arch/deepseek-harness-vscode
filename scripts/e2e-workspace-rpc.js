const { spawn } = require('child_process');
const { mkdtempSync, rmSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

const workspace = 'D:\\work\\matrix';
const home = mkdtempSync(path.join(tmpdir(), 'dsh-vscode-e2e-'));

function waitForUrl(child) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Timed out waiting for dsh URL')), 30000);
    const inspect = chunk => {
      buffer += chunk.toString();
      const match = buffer.match(/dsh web:\s+(https?:\/\/\S+)/i);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    };
    child.stdout.on('data', inspect);
    child.stderr.on('data', inspect);
    child.once('error', reject);
    child.once('exit', code => reject(new Error(`dsh exited early (${code})`)));
  });
}

function stopTree(pid) {
  return new Promise(resolve => {
    const child = spawn('taskkill.exe', ['/pid', String(pid), '/t', '/f'], { windowsHide: true });
    child.once('exit', resolve);
    child.once('error', resolve);
  });
}

(async () => {
  let dsh;
  try {
    dsh = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', 'dsh.cmd', 'web', '--host', '127.0.0.1', '--port', '0', '--no-open'], {
      cwd: workspace,
      env: { ...process.env, DSH_HOME: home },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const launchUrl = await waitForUrl(dsh);
    const auth = await fetch(launchUrl, { redirect: 'manual' });
    const cookie = auth.headers.get('set-cookie')?.split(';', 1)[0];
    if (!cookie) throw new Error(`Authentication returned ${auth.status} without a cookie`);
    const base = new URL('./', launchUrl).href;
    async function rpc(method, args) {
      const rpcId = `verify-${randomUUID()}`;
      const response = await fetch(`${base}api/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args } })
      });
      const message = await response.json();
      if (!response.ok || !message.result?.ok) throw new Error(`${method} failed: HTTP ${response.status} ${JSON.stringify(message)}`);
      return message.result.value;
    }
    const created = await rpc('workspace/create', { request: { path: workspace } });
    const session = await rpc('session/create', { request: { workspaceId: created.workspace.workspaceId } });
    const sessions = await rpc('session/list', { _request: {} });
    const summary = sessions.items.find(item => item.sessionId === session.sessionId);
    console.log(JSON.stringify({ workspace: created.workspace, session: summary }, null, 2));
    if (created.workspace.path.toLowerCase() !== workspace.toLowerCase()) process.exitCode = 2;
    if (summary?.cwd?.toLowerCase() !== workspace.toLowerCase()) process.exitCode = 3;
  } finally {
    if (dsh?.pid) await stopTree(dsh.pid);
    rmSync(home, { recursive: true, force: true });
  }
})().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
