const vscode = acquireVsCodeApi();
const welcome = document.getElementById('welcome');
const running = document.getElementById('running');
const status = document.getElementById('status');
const frame = document.getElementById('harness');
const start = document.getElementById('start');

start.addEventListener('click', () => {
  start.disabled = true;
  status.textContent = '正在启动…首次使用可能需要下载官方运行时。';
  vscode.postMessage({ type: 'start' });
});
document.getElementById('key').addEventListener('click', () => vscode.postMessage({ type: 'setApiKey' }));
document.getElementById('logs').addEventListener('click', () => vscode.postMessage({ type: 'showLogs' }));
document.getElementById('editor').addEventListener('click', () => vscode.postMessage({ type: 'openEditor' }));
document.getElementById('restart').addEventListener('click', () => vscode.postMessage({ type: 'restart' }));

window.addEventListener('message', ({ data }) => {
  status.textContent = data.detail || '';
  if (data.state === 'ready' && data.url) {
    frame.src = data.url;
    welcome.hidden = true;
    running.hidden = false;
    start.disabled = false;
  } else if (data.state === 'error' || data.state === 'stopped') {
    frame.src = 'about:blank';
    welcome.hidden = false;
    running.hidden = true;
    start.disabled = false;
  }
});
