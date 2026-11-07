// Known-answer self-check, run by `npm run build` before vite: node src/check.mjs
// Reproduces every computed number on the page from the repo files and the recorded fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { lineCount, parseLangOptions, parseEntry, parseTranslation, buildUrls, receivedQuery, findLine, popupTemplate, fillTemplate, FLOW, audit } from './parse.js';

const root = new URL('../../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
const fx = (f) => JSON.parse(read(`site/fixtures/${f}`));
const background = read('background.js'), content = read('content.js'), css = read('styles.css');
const manifest = JSON.parse(read('manifest.json'));
const history = JSON.parse(read('site/src/history.json'));

// Hero stats: counted independently with a byte scan, then compared with lineCount().
const nl = (s) => [...s].filter((c) => c === '\n').length + (s.endsWith('\n') ? 0 : 1);
for (const s of [background, content, css]) assert.equal(lineCount(s), nl(s));
assert.equal(manifest.version, '1.4');
assert.equal(manifest.permissions.length, 3);
assert.equal(history.commits.length, 9);
assert.equal(history.head, '0d7946f');

// Languages: content.js offers exactly these 8 targets, and every one has a recorded fixture.
const langs = parseLangOptions(content);
assert.deepEqual(langs.map((l) => l.code), ['es', 'bn', 'fr', 'de', 'hi', 'it', 'ja', 'ru']);
for (const { code } of langs) assert.equal(parseTranslation(fx(`serendipity.${code}.translation.json`)).status, 200);
assert.equal(parseTranslation(fx('serendipity.hi.translation.json')).match, 0.97);

// Dictionary parse mirrors formatAndDisplay on the recorded responses.
const s = parseEntry(fx('serendipity.dictionary.json'));
assert.equal(s.word, 'serendipity');
assert.equal(s.phonetic, '/ˌsɛ.ɹən.ˈdɪ.pɪ.ti/');
assert.match(s.audioUrl, /serendipity-au\.mp3$/);
assert.match(s.definition, /^A combination of events/);
const run = parseEntry(fx('run.dictionary.json'));
assert.equal(run.phonetic, ''); // no top-level phonetic in the recorded response
assert.match(run.audioUrl, /run-au\.mp3$/); // first non-empty audio, skipping '' entries
assert.deepEqual(parseEntry(null), { found: false, word: 'Result', phonetic: '', definition: 'No definition found.', audioUrl: null });
assert.equal(parseEntry([{ word: 'x', meanings: [] }]).definition, 'No definition found.');

// URL encoding defect, shown live on the page and proven here with the recorded responses.
const raw = buildUrls('rock & roll', 'es', { encode: false }), enc = buildUrls('rock & roll', 'es');
assert.equal(raw.translation, 'https://api.mymemory.translated.net/get?q=rock & roll&langpair=en|es');
assert.equal(receivedQuery(raw.translation), 'rock ');
assert.equal(receivedQuery(enc.translation), 'rock & roll');
assert.equal(parseTranslation(fx('rock-and-roll.raw.es.translation.json')).text, 'mecerse');
assert.equal(parseTranslation(fx('rock-and-roll.encoded.es.translation.json')).text, 'Rock & Roll');

// Request flow: every step resolves to a real line in the named file.
const src = { 'background.js': background, 'content.js': content };
for (const st of FLOW) assert.ok(findLine(src[st.file], st.needle) > 0, `flow needle not found: ${st.needle}`);
assert.equal(findLine(background, 'api.dictionaryapi.dev'), 34);

// Safe-rendering demo uses the real template; the payload lands unescaped in the markup.
const tpl = popupTemplate(content);
assert.ok(tpl && tpl.includes('${initialTranslation}'));
const payload = '<img src=x onerror=alert(1)>';
const filled = fillTemplate(tpl, { word: 'w', phonetic: '', translation: payload, definition: 'd' });
assert.ok(filled.includes(payload) && !filled.includes('${'), 'template fill');

// Audit: 3 passes and 10 open defects in the code as committed.
const files = fs.readdirSync(root);
const a = audit({ manifest, background, content, files });
assert.equal(a.length, 13);
assert.deepEqual(a.filter((x) => x.pass).map((x) => x.id), ['host-scope', 'no-backend', 'allsettled']);
console.log('check ok', { lines: [background, content, css].map(lineCount), langs: langs.length, audit: `${a.filter((x) => x.pass).length}/${a.length}`, flowSteps: FLOW.length });
