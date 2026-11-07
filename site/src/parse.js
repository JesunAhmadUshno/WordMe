// Pure logic shared by the dashboard (browser) and the known-answer check (node src/check.mjs).
// Everything here reads the extension's own files or recorded API responses; nothing is typed in.

export const lineCount = (src) => src.split('\n').length;

// The 8 targets from the <option> tags in content.js langOptions.
export function parseLangOptions(contentSrc) {
  return [...contentSrc.matchAll(/<option value="([a-z]{2})">([^<]+)<\/option>/g)].map(([, code, label]) => ({ code, label: label.trim() }));
}

// Same field extraction as formatAndDisplay() in content.js, but guarded:
// content.js throws if meanings[0].definitions[0] is missing (see audit 'partial-data').
export function parseEntry(dictionary) {
  const entry = Array.isArray(dictionary) ? dictionary[0] : null;
  let audioUrl = null;
  for (const p of entry?.phonetics ?? []) if (p.audio && p.audio.length > 0) { audioUrl = p.audio; break; }
  return {
    found: !!entry,
    word: entry ? entry.word : 'Result',
    phonetic: entry ? entry.phonetic || '' : '',
    definition: entry?.meanings?.[0]?.definitions?.[0]?.definition ?? 'No definition found.',
    audioUrl,
  };
}

// content.js shows data.translation.responseData.translatedText whatever the status;
// this also reports the status and MyMemory's own match score so the page can be honest about it.
export function parseTranslation(t) {
  if (!t) return { text: 'No translation.', status: null, match: null, quota: false };
  return {
    text: t.responseData?.translatedText ?? 'No translation.',
    status: t.responseStatus ?? null,
    match: typeof t.responseData?.match === 'number' ? t.responseData.match : null,
    quota: t.quotaFinished === true || t.responseStatus === 429,
  };
}

// encode:false reproduces the template literals in background.js exactly; encode:true is the proposed fix.
export function buildUrls(text, targetLang, { encode = true } = {}) {
  const q = encode ? encodeURIComponent(text) : text;
  const pair = encode ? encodeURIComponent(`en|${targetLang}`) : `en|${targetLang}`;
  return {
    dictionary: `https://api.dictionaryapi.dev/api/v2/entries/en/${q}`,
    translation: `https://api.mymemory.translated.net/get?q=${q}&langpair=${pair}`,
  };
}

// What the server actually receives as q= (URLSearchParams decodes like the API does).
export const receivedQuery = (url) => new URL(url).searchParams.get('q');

// 1-based line of the first line containing needle, or 0.
export function findLine(src, needle) {
  const i = src.split('\n').findIndex((l) => l.includes(needle));
  return i + 1;
}

// The popup markup template, lifted from content.js and filled the way formatAndDisplay fills it.
export function popupTemplate(contentSrc) {
  const m = contentSrc.match(/const html = `([\s\S]*?)`;\n/);
  return m ? m[1] : null;
}
export function fillTemplate(template, { word, phonetic, translation, definition, audio = false, langOptions = '' }) {
  return template
    .replace(/\$\{audioUrl \?[\s\S]*?: ''\}/, audio ? '<button id="wm-play-audio" title="Listen">🔊</button>' : '')
    .replace('${word}', word).replace('${phonetic}', phonetic).replace('${langOptions}', langOptions)
    .replace('${initialTranslation}', translation).replace('${definition}', definition);
}

// Request flow: each step is located in the source by a needle, so line numbers are computed, not typed.
export const FLOW = [
  { from: 'page', to: 'bg', label: 'Right-click → "Word Me: \'%s\'"', file: 'background.js', needle: 'chrome.contextMenus.onClicked.addListener' },
  { from: 'bg', to: 'page', label: 'activeTab: insertCSS + executeScript', file: 'background.js', needle: 'chrome.scripting.executeScript' },
  { from: 'bg', to: 'page', label: 'message { action: "loading" }', file: 'background.js', needle: 'action: "loading"' },
  { from: 'page', to: 'page', label: 'showPopup("Loading...")', file: 'content.js', needle: 'showPopup("Loading..."' },
  { from: 'bg', to: 'dict', label: 'GET /entries/en/<text>', file: 'background.js', needle: 'api.dictionaryapi.dev' },
  { from: 'bg', to: 'mm', label: 'GET /get?q=<text>&langpair=en|es', file: 'background.js', needle: 'api.mymemory.translated.net/get?q=${selectedText}' },
  { from: 'bg', to: 'bg', label: 'Promise.allSettled([dict, translation])', file: 'background.js', needle: 'Promise.allSettled' },
  { from: 'bg', to: 'page', label: 'message { action: "result", data }', file: 'background.js', needle: 'action: "result"' },
  { from: 'page', to: 'page', label: 'formatAndDisplay → innerHTML popup', file: 'content.js', needle: 'function formatAndDisplay' },
  { from: 'page', to: 'bg', label: 'Language change → { action: "fetchTranslation" }', file: 'content.js', needle: 'action: "fetchTranslation"' },
  { from: 'bg', to: 'mm', label: 'GET /get?q=<word>&langpair=en|<lang>', file: 'background.js', needle: 'api.mymemory.translated.net/get?q=${word}' },
  { from: 'bg', to: 'page', label: 'sendResponse → translation box updated', file: 'content.js', needle: 'transBox.innerText = response.data' },
];

// Engineering audit: each item is decided by reading the source, so a fix flips it automatically.
export function audit({ manifest, background, content, files }) {
  const icons = [...new Set(Object.values(manifest.icons ?? {}))];
  const hosts = [...(manifest.host_permissions ?? []), ...(manifest.content_scripts ?? []).flatMap((c) => c.matches)];
  const fetchHosts = [...new Set([...background.matchAll(/fetch\(`https:\/\/([^/]+)/g)].map((m) => m[1]))];
  return [
    { id: 'host-scope', title: 'No standing host access (activeTab only)', pass: hosts.length === 0 && (manifest.permissions ?? []).includes('activeTab'), evidence: `host_permissions + content_scripts matches: ${hosts.length}` },
    { id: 'no-backend', title: 'Talks only to the two public APIs', pass: fetchHosts.length === 2, evidence: `fetch hosts in background.js: ${fetchHosts.join(', ')}` },
    { id: 'allsettled', title: 'One failed API does not hide the other', pass: background.includes('Promise.allSettled'), evidence: 'Promise.allSettled in background.js' },
    { id: 'icon-case', title: 'Manifest icon paths match tracked files (case-sensitive)', pass: icons.every((i) => files.includes(i)), evidence: `manifest: ${icons.join(', ')}; tracked: ${files.filter((f) => f.endsWith('.png')).join(', ')}` },
    { id: 'url-encoding', title: 'Selected text is URL-encoded', pass: background.includes('encodeURIComponent'), evidence: '"rock & roll" is sent as q=rock%20 without it' },
    { id: 'xss', title: 'API strings never reach innerHTML', pass: !/\$\{(definition|initialTranslation|word|phonetic)\}/.test(popupTemplate(content) ?? '') || !content.includes('innerHTML = content'), evidence: 'word, phonetic, definition and translatedText are interpolated into the popup template' },
    { id: 'partial-data', title: 'Malformed dictionary data cannot crash the popup', pass: !content.includes('entry.meanings[0].definitions[0]'), evidence: 'entry.meanings[0].definitions[0] has no guard' },
    { id: 'quota', title: 'Quota or error responses are not shown as translations', pass: content.includes('responseStatus') || content.includes('quotaFinished'), evidence: 'translatedText is shown without checking responseStatus' },
    { id: 'error-state', title: 'The "error" message is handled', pass: /action === ["']error["']/.test(content), evidence: 'background.js can send { action: "error" }; content.js only handles loading and result' },
    { id: 'listeners', title: 'Drag listeners are not added per popup', pass: !/function makeDraggable[\s\S]*document\.addEventListener\('mousemove'/.test(content), evidence: 'makeDraggable adds document mousemove/mouseup listeners on every lookup' },
    { id: 'war', title: 'No web_accessible_resources (not needed with chrome.scripting)', pass: !(manifest.web_accessible_resources?.length), evidence: `exposed to ${(manifest.web_accessible_resources ?? []).flatMap((w) => w.matches).join(' ') || 'none'}` },
    { id: 'a11y', title: 'Popup is a labelled dialog with Escape to close', pass: content.includes('role') && content.includes('Escape'), evidence: 'no role="dialog", no focus move, no Escape handler' },
    { id: 'lang-pref', title: 'Language choice is remembered', pass: content.includes('chrome.storage') || background.includes('chrome.storage'), evidence: 'targetLang is hard-coded to "es" in background.js' },
  ];
}
