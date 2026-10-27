const vscode = require('vscode');
const { spawn } = require('child_process');
const http = require('http');
const net = require('net');
const { randomBytes } = require('crypto');

const VIEW_ID = 'deepseekHarness.chat';
const SECRET_KEY = 'deepseekHarness.deepseekApiKey';
const NPX_CONSENT_KEY = 'deepseekHarness.npxConsent';

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

class HarnessProxy {
  constructor(targetPort, output, hidePreviewBadge = true) {
    this.targetPort = targetPort;
    this.output = output;
    this.cookie = '';
    this.currentSessionId = undefined;
    this.hidePreviewBadge = hidePreviewBadge;
    this.prefix = `/dsh-${randomBytes(18).toString('hex')}/`;
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.on('upgrade', (req, socket, head) => this.upgrade(req, socket, head));
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server.address();
        this.port = typeof address === 'object' && address ? address.port : 0;
        this.authority = `127.0.0.1:${this.port}`;
        this.baseUrl = `http://${this.authority}${this.prefix}`;
        resolve();
      });
    });
  }

  upstreamPath(url = '/') {
    if (!url.startsWith(this.prefix)) return undefined;
    const suffix = url.slice(this.prefix.length);
    return `/${suffix}`;
  }

  headers(headers) {
    const next = { ...headers, host: this.authority, 'accept-encoding': 'identity' };
    if (this.cookie) next.cookie = this.cookie;
    return next;
  }

  handle(req, res) {
    const path = this.upstreamPath(req.url);
    if (path === undefined) {
      res.writeHead(404).end();
      return;
    }
    if (path === '/__vscode_bridge.js') {
      res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'no-store' });
      res.end(this.bridgeScript());
      return;
    }
    const upstream = http.request({
      host: '127.0.0.1',
      port: this.targetPort,
      method: req.method,
      path,
      headers: this.headers(req.headers)
    }, response => {
      const setCookie = response.headers['set-cookie'];
      if (setCookie?.length) this.cookie = setCookie[0].split(';', 1)[0];
      const headers = { ...response.headers };
      delete headers['set-cookie'];
      const contentType = String(headers['content-type'] || '');
      if ((this.hidePreviewBadge || this.currentSessionId) && contentType.includes('text/html')) {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          let html = Buffer.concat(chunks).toString('utf8');
          // Run the bridge before Harness module scripts so its persisted
          // navigation store restores the VS Code workspace Session.
          const script = '<script src="./__vscode_bridge.js"></script>';
          html = html.includes('<head>')
            ? html.replace('<head>', `<head>${script}`)
            : `${script}${html}`;
          delete headers['content-length'];
          delete headers['content-encoding'];
          res.writeHead(response.statusCode || 502, headers);
          res.end(html);
        });
      } else {
        res.writeHead(response.statusCode || 502, headers);
        response.pipe(res);
      }
    });
    upstream.on('error', error => {
      this.output.appendLine(`[proxy] ${error.message}`);
      if (!res.headersSent) res.writeHead(502);
      res.end('Harness is starting…');
    });
    req.pipe(upstream);
  }

  bridgeScript() {
    const selection = this.currentSessionId
      ? `try { localStorage.setItem('dsh.sessions.current', ${JSON.stringify(JSON.stringify({ sessionId: this.currentSessionId }))}); } catch {}`
      : '';
    return `(() => {
      ${selection}
      const labels = new Set(['预览版', 'Preview']);
      const hide = () => {
        document.querySelectorAll('span, div').forEach((element) => {
          if (element.childElementCount === 0 && labels.has(element.textContent.trim())) {
            element.style.setProperty('display', 'none', 'important');
          }
        });
      };
      hide();
      new MutationObserver(hide).observe(document.documentElement, { childList: true, subtree: true });
    })();`;
  }

  upgrade(req, socket, head) {
    const path = this.upstreamPath(req.url);
    if (path === undefined) return socket.destroy();
    const upstream = net.connect(this.targetPort, '127.0.0.1', () => {
      const headers = this.headers(req.headers);
      const lines = [`${req.method} ${path} HTTP/${req.httpVersion}`];
      for (const [name, value] of Object.entries(headers)) {
        if (Array.isArray(value)) value.forEach(item => lines.push(`${name}: ${item}`));
        else if (value !== undefined) lines.push(`${name}: ${value}`);
      }
      upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
  }

  stop() {
    this.cookie = '';
    this.server.close();
  }

  request(url, options = {}, body) {
    return new Promise((resolve, reject) => {
      const request = http.request(url, options, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({
          statusCode: response.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8')
        }));
      });
      request.once('error', reject);
      if (body) request.write(body);
      request.end();
    });
  }

  async rpc(method, args) {
    const body = JSON.stringify({
      type: 'client-request',
      rpcId: `vscode-${randomBytes(8).toString('hex')}`,
      method,
      payload: { args }
    });
    const response = await this.request(`${this.baseUrl}api/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`${method} returned HTTP ${response.statusCode}`);
    }
    const message = JSON.parse(response.body);
    if (!message.result?.ok) throw new Error(`${method} failed: ${message.result?.error?.message || 'unknown error'}`);
    return message.result.value;
  }

  async authenticate(launchUrl) {
    const auth = await this.request(launchUrl);
    if (auth.statusCode !== 200 && (auth.statusCode < 300 || auth.statusCode >= 400)) {
      throw new Error(`Harness authentication returned HTTP ${auth.statusCode}`);
    }
    if (!this.cookie) throw new Error('Harness authentication did not issue a session cookie');
  }

  async selectWorkspace(launchUrl, workspacePath) {
    await this.authenticate(launchUrl);
    const created = await this.rpc('workspace/create', { request: { path: workspacePath } });
    const workspaceId = created?.workspace?.workspaceId;
    if (!workspaceId) throw new Error('workspace/create returned no workspaceId');
    const session = await this.rpc('session/create', { request: { workspaceId } });
    const sessionId = session?.sessionId;
    if (!sessionId) throw new Error('session/create returned no sessionId');
    this.currentSessionId = sessionId;
    return { workspace: created.workspace, sessionId };
  }
}

function currentWorkspacePath() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const activeFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (activeFolder) return activeFolder.uri.fsPath;
  }
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

class HarnessRuntime {
  constructor(context, output) {
    this.context = context;
    this.output = output;
    this.process = undefined;
    this.launchingProcess = undefined;
    this.proxy = undefined;
    this.url = undefined;
    this.starting = undefined;
    this.listeners = new Set();
  }

  onChange(listener) {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  emit(state, detail) {
    for (const listener of this.listeners) listener({ state, detail, url: this.url });
  }

  async start() {
    if (this.url) return this.url;
    if (this.starting) return this.starting;
    this.starting = this.launch().finally(() => { this.starting = undefined; });
    return this.starting;
  }

  async launch() {
    this.emit('starting', '正在启动官方 DeepSeek Harness…');
    const config = vscode.workspace.getConfiguration('deepseekHarness');
    const configured = config.get('binaryPath', '').trim();
    const apiKey = await this.context.secrets.get(SECRET_KEY);
    const dshHome = config.get('dshHome', '').trim();
    const cwd = currentWorkspacePath();
    this.workspacePath = cwd;
    this.output.appendLine(`[workspace] VS Code folder: ${cwd || '(none)'}`);
    const env = { ...process.env };
    if (apiKey) env.DEEPSEEK_API_KEY = apiKey;
    if (dshHome) env.DSH_HOME = dshHome;

    const targetPort = await freePort();
    const proxy = new HarnessProxy(targetPort, this.output, config.get('hidePreviewBadge', true));
    await proxy.start();
    this.proxy = proxy;
    const args = [
      'web', '--host', '127.0.0.1', '--port', String(targetPort), '--no-open',
      '--public-url', proxy.baseUrl, '--trusted-host', proxy.authority
    ];
    const candidates = configured
      ? [{ command: configured, args }]
      : [
          { command: process.platform === 'win32' ? 'dsh.cmd' : 'dsh', args },
          ...(config.get('launchWithNpx', true)
            ? [{ command: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['--yes', '@deepseek-ai/dsh', ...args], npx: true }]
            : [])
        ];

    let lastError;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      if (candidate.npx && !this.context.globalState.get(NPX_CONSENT_KEY, false)) {
        const choice = await vscode.window.showWarningMessage(
          '未找到 dsh，是否通过 npx 下载并运行官方 @deepseek-ai/dsh？',
          { modal: true, detail: 'Harness 可以访问当前工作区。也可以取消并在设置中指定已安装的 dsh。' },
          '下载并启动'
        );
        if (choice !== '下载并启动') {
          const error = new Error('已取消下载 Harness 运行时');
          this.emit('stopped', error.message);
          throw error;
        }
        await this.context.globalState.update(NPX_CONSENT_KEY, true);
        this.emit('starting', '正在下载并启动官方 Harness…');
      }
      try {
        return await this.spawnCandidate(candidate.command, candidate.args, { cwd, env }, candidate.npx ? 300000 : 30000);
      } catch (error) {
        lastError = error;
        this.output.appendLine(`[launcher] ${candidate.command} failed: ${error.message}`);
        // cmd.exe reports a missing .cmd shim as exit code 1 rather than
        // ENOENT, so an automatic launch should always try the next candidate.
        if (configured || index === candidates.length - 1) break;
      }
    }

    const message = `无法启动 DeepSeek Harness：${lastError?.message || '未找到 dsh'}`;
    proxy.stop();
    if (this.proxy === proxy) this.proxy = undefined;
    this.emit('error', message);
    const action = await vscode.window.showErrorMessage(message, '打开设置', '查看日志');
    if (action === '打开设置') vscode.commands.executeCommand('workbench.action.openSettings', 'deepseekHarness');
    if (action === '查看日志') this.output.show(true);
    throw lastError || new Error(message);
  }

  spawnCandidate(command, args, options, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      this.output.appendLine(`[launcher] ${command} ${args.join(' ')}`);
      // Windows cannot execute npm-generated .cmd shims directly through
      // CreateProcess; doing so fails with spawn EINVAL. Use cmd.exe only for
      // .cmd/.bat launchers while keeping native executables shell-free.
      const useCmd = process.platform === 'win32' && /\.(cmd|bat)$/i.test(command);
      const executable = useCmd ? (process.env.ComSpec || 'cmd.exe') : command;
      const spawnArgs = useCmd
        ? ['/d', '/c', command, ...args]
        : args;
      const child = spawn(executable, spawnArgs, {
        ...options,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      this.launchingProcess = child;
      let settled = false;
      let buffer = '';

      const fail = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      const inspect = (chunk, stream) => {
        const text = chunk.toString();
        this.output.append(text.replace(/([?&]token=)[^&\s]+/gi, '$1[redacted]'));
        buffer = (buffer + text).slice(-8192);
        const match = buffer.match(/dsh web:\s+(https?:\/\/[^\s]+)/i);
        if (match && !settled) {
          settled = true;
          this.process = child;
          this.launchingProcess = undefined;
          const launchUrl = match[1];
          this.url = this.proxy?.baseUrl || launchUrl;
          const prepare = this.proxy && this.workspacePath
            ? this.proxy.selectWorkspace(launchUrl, this.workspacePath)
            : this.proxy
              ? this.proxy.authenticate(launchUrl)
              : Promise.resolve();
          this.emit('starting', this.workspacePath ? '正在绑定当前 VS Code 工作区…' : '正在连接 Harness…');
          prepare.then(selection => {
            if (selection) this.output.appendLine(`[workspace] selected ${selection.workspace.path} (session ${selection.sessionId})`);
          }).catch(error => {
            this.output.appendLine(`[workspace] automatic selection failed: ${error.message}`);
            vscode.window.showWarningMessage(`Harness 已启动，但无法自动选择工作区：${error.message}`);
          }).finally(() => {
            this.emit('ready', this.workspacePath ? `已连接 · ${this.workspacePath}` : '已连接官方 Harness');
            resolve(this.url);
          });
        } else if (stream === 'stderr' && /requires Node\.js|unsupported.*node/i.test(text)) {
          this.emit('starting', '系统 Node.js 版本可能不满足 Harness 要求');
        }
      };

      child.stdout.on('data', chunk => inspect(chunk, 'stdout'));
      child.stderr.on('data', chunk => inspect(chunk, 'stderr'));
      child.once('error', fail);
      child.once('exit', (code, signal) => {
        if (this.launchingProcess === child) this.launchingProcess = undefined;
        const wasCurrent = this.process === child;
        if (!settled) fail(new Error(`进程提前退出（code=${code}, signal=${signal || 'none'}）`));
        if (wasCurrent) {
          this.process = undefined;
          this.url = undefined;
          this.proxy?.stop();
          this.proxy = undefined;
          this.emit('stopped', `Harness 已停止（code=${code ?? 'none'}）`);
        }
      });

      setTimeout(() => {
        if (!settled) {
          this.kill(child);
          fail(new Error(`启动超时：${Math.round(timeoutMs / 1000)} 秒内没有收到 dsh web URL`));
        }
      }, timeoutMs);
    });
  }

  stop() {
    const child = this.process;
    const launchingChild = this.launchingProcess;
    this.process = undefined;
    this.launchingProcess = undefined;
    this.url = undefined;
    this.proxy?.stop();
    this.proxy = undefined;
    this.kill(child);
    if (launchingChild !== child) this.kill(launchingChild);
    this.emit('stopped', 'Harness 已停止');
  }

  kill(child) {
    if (!child || child.killed) return;
    if (process.platform === 'win32' && child.pid) {
      spawn('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }

  async restart() {
    this.stop();
    return this.start();
  }

  dispose() {
    this.stop();
  }
}

class HarnessViewProvider {
  constructor(extensionUri, runtime) {
    this.extensionUri = extensionUri;
    this.runtime = runtime;
    this.view = undefined;
    this.runtime.onChange(event => this.post(event));
  }

  resolveWebviewView(view) {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage(async message => {
      if (message.type === 'start') {
        try { await this.runtime.start(); } catch (_) { /* surfaced by runtime */ }
      }
      if (message.type === 'restart') {
        try { await this.runtime.restart(); } catch (_) { /* surfaced by runtime */ }
      }
      if (message.type === 'openEditor') vscode.commands.executeCommand('deepseekHarness.openEditor');
      if (message.type === 'setApiKey') vscode.commands.executeCommand('deepseekHarness.setApiKey');
      if (message.type === 'showLogs') vscode.commands.executeCommand('deepseekHarness.showLogs');
    });
    if (this.runtime.url) this.post({ state: 'ready', url: this.runtime.url, detail: '已连接官方 Harness' });
  }

  post(message) {
    this.view?.webview.postMessage(message);
  }

  html(webview) {
    const nonce = Math.random().toString(36).slice(2);
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'view.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'view.css'));
    const icon = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'icon.png'));
    return `<!doctype html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; frame-src http://127.0.0.1:* http://localhost:*; img-src ${webview.cspSource} data:;">
<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${style}"></head>
<body><section id="welcome"><img class="brand" src="${icon}" alt=""><h2>DeepSeek Harness</h2><p id="status">点击启动本地 Harness。</p><div class="actions"><button id="start">启动</button><button id="key" class="secondary">API Key</button></div><button id="logs" class="link">查看日志</button><p class="fineprint">社区集成，非 DeepSeek 官方扩展。</p></section>
<section id="running" hidden><header><span id="ready">已连接</span><span class="spacer"></span><button id="editor" title="在编辑器中打开">↗</button><button id="restart" title="重启">↻</button></header><iframe id="harness" title="DeepSeek Harness"></iframe></section>
<script nonce="${nonce}" src="${script}"></script></body></html>`;
  }
}

function selectionAsContext() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) return undefined;
  const relative = vscode.workspace.asRelativePath(editor.document.uri, false).replace(/\\/g, '/');
  const start = editor.selection.start.line + 1;
  const end = editor.selection.end.line + 1;
  const language = editor.document.languageId;
  return `@${relative} L${start}-L${end}\n\n\`\`\`${language}\n${editor.document.getText(editor.selection)}\n\`\`\``;
}

async function activate(context) {
  const output = vscode.window.createOutputChannel('DeepSeek Harness');
  const runtime = new HarnessRuntime(context, output);
  const provider = new HarnessViewProvider(context.extensionUri, runtime);
  context.subscriptions.push(
    output,
    runtime,
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('deepseekHarness.start', () => runtime.start()),
    vscode.commands.registerCommand('deepseekHarness.stop', () => runtime.stop()),
    vscode.commands.registerCommand('deepseekHarness.restart', () => runtime.restart()),
    vscode.commands.registerCommand('deepseekHarness.showLogs', () => output.show(true)),
    vscode.commands.registerCommand('deepseekHarness.setApiKey', async () => {
      const value = await vscode.window.showInputBox({ prompt: '输入 DeepSeek API Key', password: true, ignoreFocusOut: true });
      if (value === undefined) return;
      if (value.trim()) await context.secrets.store(SECRET_KEY, value.trim());
      else await context.secrets.delete(SECRET_KEY);
      vscode.window.showInformationMessage(value.trim() ? 'DeepSeek API Key 已安全保存；重启 Harness 后生效。' : 'DeepSeek API Key 已清除。');
    }),
    vscode.commands.registerCommand('deepseekHarness.copySelection', async () => {
      const value = selectionAsContext();
      if (!value) return vscode.window.showInformationMessage('请先在编辑器中选择代码。');
      await vscode.env.clipboard.writeText(value);
      vscode.window.showInformationMessage('选区已复制为 Harness 上下文，请粘贴到对话框。');
    }),
    vscode.commands.registerCommand('deepseekHarness.openEditor', async () => {
      try {
        const url = await runtime.start();
        await vscode.commands.executeCommand('simpleBrowser.show', url);
      } catch (_) { /* surfaced by runtime */ }
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
