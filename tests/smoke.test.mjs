// Smoke tests for the extension itself: node --test tests/*.test.mjs
// Runs the real background.js and content.js in a vm with a minimal chrome/DOM stand-in
// and the recorded API responses from site/fixtures/. No network, no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const fx = (f) => JSON.parse(read(`site/fixtures/${f}`));
const tick = () => new Promise((r) => setTimeout(r, 0));

function loadBackground(responses) {
  const listeners = {}, sent = [], fetched = [];
  const on = (k) => ({ addListener: (fn) => { listeners[k] = fn; } });
  const chrome = {
    runtime: { onInstalled: on('installed'), onMessage: on('message') },
    contextMenus: { create: (o) => { listeners.menu = o; }, onClicked: on('clicked') },
    scripting: { insertCSS: async () => {}, executeScript: async () => {} },
    tabs: { sendMessage: async (id, msg) => { sent.push(msg); } },
  };
  const fetch = async (url) => {
    fetched.push(url);
    const [status, body] = responses(url);
    return { ok: status < 400, status, json: async () => body };
  };
  vm.runInNewContext(read('background.js'), { chrome, fetch, console: { log() {}, error() {} } });
  return { listeners, sent, fetched };
}

function loadContent() {
  const els = {}, docListeners = {};
  const el = (id) => ({ id, style: {}, innerText: '', listeners: {}, addEventListener(t, fn) { this.listeners[t] = fn; }, remove() { delete els[this.id]; } });
  const document = {
    addEventListener: (t, fn) => { (docListeners[t] ??= []).push(fn); },
    getElementById: (id) => els[id] ?? (els['word-me-popup']?.innerHTML?.includes(`id="${id}"`) ? (els[id] = el(id)) : null),
    createElement: () => el(null),
    body: { appendChild: (e) => { els[e.id] = e; } },
  };
  let onMessage;
  const chrome = { runtime: { onMessage: { addListener: (fn) => { onMessage = fn; } }, sendMessage: () => {} } };
  const window = {};
  vm.runInNewContext(read('content.js'), { window, document, chrome, console: { debug() {} }, Audio: function () {} });
  return { send: (msg) => onMessage(msg), els, docListeners };
}

test('background.js registers the context menu and fetches both APIs for a selection', async () => {
  const bg = loadBackground((url) => url.includes('dictionaryapi')
    ? [200, fx('serendipity.dictionary.json')] : [200, fx('serendipity.es.translation.json')]);
  bg.listeners.installed();
  assert.equal(bg.listeners.menu.id, 'wordMeLookup');
  await bg.listeners.clicked({ menuItemId: 'wordMeLookup', selectionText: ' serendipity ' }, { id: 7, url: 'https://example.com/' });
  await tick(); await tick();
  assert.deepEqual(bg.fetched, [
    'https://api.dictionaryapi.dev/api/v2/entries/en/serendipity',
    'https://api.mymemory.translated.net/get?q=serendipity&langpair=en|es',
  ]);
  assert.equal(bg.sent[0].action, 'loading');
  assert.equal(bg.sent[1].action, 'result');
  assert.equal(bg.sent[1].data.dictionary[0].word, 'serendipity');
});

test('background.js still sends a result when the dictionary 404s', async () => {
  const bg = loadBackground((url) => url.includes('dictionaryapi')
    ? [404, fx('wordmeqzx.dictionary.json')] : [200, fx('serendipity.es.translation.json')]);
  await bg.listeners.clicked({ menuItemId: 'wordMeLookup', selectionText: 'wordmeqzx' }, { id: 1, url: 'https://example.com/' });
  await tick(); await tick();
  const result = bg.sent.find((m) => m.action === 'result');
  assert.equal(result.data.dictionary, null);
  assert.ok(result.data.translation);
});

test('background.js ignores other context-menu items', async () => {
  const bg = loadBackground(() => [200, {}]);
  await bg.listeners.clicked({ menuItemId: 'other', selectionText: 'x' }, { id: 1, url: 'https://a/' });
  assert.equal(bg.fetched.length, 0);
  assert.equal(bg.sent.length, 0);
});

test('content.js renders the recorded result into the popup', () => {
  const c = loadContent();
  c.send({ action: 'loading' });
  assert.equal(c.els['word-me-popup'].innerText, 'Loading...');
  c.send({ action: 'result', data: { dictionary: fx('serendipity.dictionary.json'), translation: fx('serendipity.es.translation.json') } });
  const html = c.els['word-me-popup'].innerHTML;
  assert.match(html, /<strong>serendipity<\/strong>/);
  assert.match(html, /A combination of events/);
  assert.match(html, /"Serendipia"/);
  assert.match(html, /id="wm-play-audio"/);
  assert.equal((html.match(/<option /g) || []).length, 8);
});

test('content.js shows the fallbacks when both APIs fail', () => {
  const c = loadContent();
  c.send({ action: 'result', data: { dictionary: null, translation: null } });
  const html = c.els['word-me-popup'].innerHTML;
  assert.match(html, /No definition found\./);
  assert.match(html, /No translation\./);
});

test('manifest.json is valid MV3 and its referenced scripts exist', () => {
  const m = JSON.parse(read('manifest.json'));
  assert.equal(m.manifest_version, 3);
  for (const f of [m.background.service_worker, ...m.web_accessible_resources.flatMap((w) => w.resources)]) assert.ok(fs.existsSync(new URL(f, root)), f);
});

// Known defects, recorded as todo so the suite stays green until the Owner approves the fixes.
test('manifest icon paths match the tracked file name (case-sensitive)', { todo: 'manifest says icon.png, file is Icon.png' }, () => {
  const files = fs.readdirSync(root);
  for (const i of Object.values(JSON.parse(read('manifest.json')).icons)) assert.ok(files.includes(i), i);
});

test('selections with & are sent intact', { todo: 'background.js does not encodeURIComponent the selection' }, async () => {
  const bg = loadBackground(() => [200, fx('serendipity.es.translation.json')]);
  await bg.listeners.clicked({ menuItemId: 'wordMeLookup', selectionText: 'rock & roll' }, { id: 1, url: 'https://a/' });
  assert.equal(new URL(bg.fetched[1].replace(/ /g, '%20')).searchParams.get('q'), 'rock & roll');
});

test('malformed dictionary data does not throw', { todo: 'content.js reads entry.meanings[0].definitions[0] unguarded' }, () => {
  const c = loadContent();
  c.send({ action: 'result', data: { dictionary: [{ word: 'x', meanings: [] }], translation: null } });
});
