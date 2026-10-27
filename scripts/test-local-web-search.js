'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const server = require('../mcp/local-web-search-server');

const fixture = `<div class="result results_links results_links_deep web-result">
  <h2><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fdoc">Example &amp; Docs</a></h2>
  <a class="result__snippet">Useful <b>documentation</b>.</a>
</div>`;
const parsed = server.parseDuckDuckGo(fixture, 5);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].url, 'https://example.com/doc');
assert.equal(parsed[0].title, 'Example & Docs');
assert.equal(parsed[0].snippet, 'Useful documentation.');
const rss = '<?xml version="1.0"?><rss><channel><item><title>Example</title><link>https://example.com/doc?a=1&amp;b=2</link><description>Useful result.</description></item></channel></rss>';
const bing = server.parseBingRss(rss, 5);
assert.equal(bing.length, 1);
assert.equal(bing[0].url, 'https://example.com/doc?a=1&b=2');
assert.equal(server.isPublicIp('127.0.0.1'), false);
assert.equal(server.isPublicIp('10.1.2.3'), false);
assert.equal(server.isPublicIp('93.184.216.34'), true);
assert.match(server.htmlToMarkdown('<title>T</title><h1>Hello</h1><p>World</p>').content, /# Hello/);

const child = spawn(process.execPath, [path.resolve(__dirname, '../mcp/local-web-search-server.js')], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, LOCAL_SEARCH_PROVIDER: 'bing' }
});
let output = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', chunk => { output += chunk; });
child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25' } })}\n`);
child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })}\n`);
setTimeout(() => {
  child.kill();
  const messages = output.trim().split('\n').map(JSON.parse);
  assert.equal(messages[0].result.serverInfo.name, 'companion-local-web-search');
  assert.deepEqual(messages[1].result.tools.map(tool => tool.name), ['web_search', 'web_fetch']);
  console.log('Local web search tests passed.');
}, 300);

