import { useMemo, useState, useEffect, useId } from 'react';
import manifest from '../../manifest.json';
import manifestRaw from '../../manifest.json?raw';
import backgroundSrc from '../../background.js?raw';
import contentSrc from '../../content.js?raw';
import cssSrc from '../../styles.css?raw';
import readme from '../../README.md?raw';
import privacy from '../../PRIVACY.md?raw';
import '../../styles.css'; // the extension's real popup styles (all scoped to #word-me-popup / .wm-*)
import history from './history.json';
import fixtureIndex from '../fixtures/index.json';
import { lineCount, parseLangOptions, parseEntry, parseTranslation, buildUrls, receivedQuery, findLine, popupTemplate, fillTemplate, FLOW, audit } from './parse.js';

const REPO = 'https://github.com/JesunAhmadUshno/WordMe';
const blob = (p, line) => `${REPO}/blob/master/${p}${line ? `#L${line}` : ''}`;
const fixtures = Object.fromEntries(Object.entries(import.meta.glob('../fixtures/*.json', { eager: true, import: 'default' })).map(([k, v]) => [k.split('/').pop(), v]));
const pngs = import.meta.glob('../../*.png', { eager: true, query: '?url', import: 'default' });
const pngNames = Object.keys(pngs).map((k) => k.split('/').pop());
const iconUrl = pngs[Object.keys(pngs)[0]];
const SRC = { 'background.js': backgroundSrc, 'content.js': contentSrc };
const LANGS = parseLangOptions(contentSrc);
const AUDIT = audit({ manifest, background: backgroundSrc, content: contentSrc, files: pngNames });
const CAPTURED = fixtureIndex.captured;
const lines = { 'background.js': lineCount(backgroundSrc), 'content.js': lineCount(contentSrc), 'styles.css': lineCount(cssSrc) };
const totalLines = Object.values(lines).reduce((a, b) => a + b, 0);
const WORDS = [['serendipity', 'serendipity'], ['run', 'run'], ['wordmeqzx', 'wordmeqzx (not a word)']];
const fxDict = (w) => fixtures[`${w}.dictionary.json`];
const fxTrans = (w, l) => fixtures[`${w}.${l}.translation.json`] ?? null;
const dictStatus = (w) => fixtureIndex.files.find((f) => f.file === `${w}.dictionary.json`)?.status;

const SECTIONS = [['top', 'Overview', '◎'], ['play', 'Playground', '▢'], ['flow', 'Request flow', '⇄'], ['perms', 'Permissions', '⚿'], ['langs', 'Languages', 'あ'], ['safe', 'Safe rendering', '⚠'], ['audit', 'Audit', '✓'], ['install', 'Install', '❯_']];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

function MenuBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return (
    <div className="menubar" role="banner">
      <span className="apple" aria-hidden="true">◆</span>
      <a className="app" href="#top">Word Me</a>
      <a className="m" href={blob('README.md')}>README</a>
      <a className="m" href={blob('PRIVACY.md')}>Privacy</a>
      <a className="m" href={blob('docs/research-review.md')}>Review</a>
      <span className="spacer" />
      <span className="status"><i /> v{manifest.version} · Manifest V{manifest.manifest_version}</span>
      <a href={REPO}>GitHub ↗</a>
      <span className="clock">{now.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
    </div>
  );
}

function Dock() {
  const [active, setActive] = useState('top');
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, []);
  return (
    <nav className="dock" aria-label="Sections">
      {SECTIONS.map(([id, label, icon]) => (
        <a key={id} href={`#${id}`} className={active === id ? 'on' : ''} aria-current={active === id ? 'true' : undefined}>
          <span className="ico" aria-hidden="true">{icon}</span><span className="lbl">{label}</span>
        </a>
      ))}
    </nav>
  );
}

function Range({ label, value, min, max, step, onChange, show }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label} <span>{show}</span></label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} />
    </div>
  );
}

export default function App() {
  useReveal();
  return (
    <div className="wrap">
      <MenuBar />
      <div className="glow" aria-hidden="true" />
      <Hero />
      <Playground />
      <Flow />
      <Permissions />
      <Languages />
      <SafeRendering />
      <Audit />
      <Install />
      <Dock />
      <footer>
        Every number on this page is read at build time from <code>manifest.json</code>, the extension's source files, <code>site/fixtures/</code> (API responses recorded {CAPTURED}) and <code>site/src/history.json</code>, and checked by <code>site/src/check.mjs</code>. Nothing calls an API until you press Fetch live.
      </footer>
    </div>
  );
}

function Hero() {
  const passes = AUDIT.filter((a) => a.pass).length;
  return (
    <header className="card hero window" id="top" data-title="WordMe.app">
      <div className="head">
        <p className="eyebrow"><img className="appicon" src={iconUrl} alt="" width="20" height="20" /> Chrome extension · v{manifest.version} · no backend</p>
        <span className="pill warn">● {passes} of {AUDIT.length} audit checks pass</span>
      </div>
      <h1>Right-click any word for its <em>meaning</em>, sound and {LANGS.length} translations.</h1>
      <p className="sub">
        Word Me adds one item to Chrome's right-click menu. It sends the selected text to two free public APIs (Free Dictionary and MyMemory) and draws a small draggable popup with the definition, phonetics, a pronunciation button and a translation you can switch between {LANGS.length} languages.
        It is {totalLines} lines of plain Manifest V3 JavaScript and CSS. This page runs the popup on recorded responses, walks through each message, and lists what still needs fixing.
      </p>
      <div className="actions">
        <a className="btn primary" href="#play">Try the popup</a>
        <a className="btn ghost" href={REPO}>View the source</a>
        <span className="hint">Author in manifest: “{manifest.author}”</span>
      </div>
      <div className="tiles">
        <div className="tile"><div className="num">{totalLines}</div><div className="cap">lines in total: background.js {lines['background.js']}, content.js {lines['content.js']}, styles.css {lines['styles.css']}</div></div>
        <div className="tile"><div className="num">{manifest.permissions.length}</div><div className="cap">permissions ({manifest.permissions.join(', ')}), no host permissions</div></div>
        <div className="tile"><div className="num">{LANGS.length}</div><div className="cap">target languages parsed from content.js</div></div>
        <div className="tile"><div className="num">{history.commits.length}</div><div className="cap">commits on {history.ref}, up to {history.head}</div></div>
      </div>
    </header>
  );
}

// The popup, drawn with the same ids and classes as the template in content.js, so the extension's styles.css applies.
// Text is rendered by React (escaped), never via innerHTML.
function Popup({ entry, trans, lang, setLang, onClose, busy }) {
  return (
    <div id="word-me-popup" role="dialog" aria-label={`Word Me result for ${entry.word}`}>
      <div className="wm-header" id="wm-drag-handle">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>{entry.word}</strong>
          <span className="wm-phonetic">{entry.phonetic}</span>
          {entry.audioUrl && <button id="wm-play-audio" title="Listen" aria-label="Play pronunciation" onClick={() => new Audio(entry.audioUrl).play().catch(() => {})}>🔊</button>}
        </div>
      </div>
      <div className="wm-lang-bar">
        <span>English → </span>
        <select id="wm-lang-select" aria-label="Translate into" value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>
      <div className="wm-trans" id="wm-trans-text" style={{ opacity: busy ? 0.5 : 1 }}>{busy ? 'Translating...' : trans.text}</div>
      <div className="wm-def">{entry.definition}</div>
      <button id="wm-close" onClick={onClose}>Close</button>
    </div>
  );
}

async function timed(url) {
  const t0 = performance.now();
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body, ms: performance.now() - t0 };
}

function Playground() {
  const [word, setWord] = useState('serendipity');
  const [lang, setLang] = useState('es');
  const [open, setOpen] = useState(true);
  const [live, setLive] = useState(null); // { text, dict, trans: {lang: resp}, at, note }
  const [query, setQuery] = useState('serendipity');
  const [busy, setBusy] = useState(false);
  const [fallback, alertFallback] = useState('');
  const qId = useId(), wId = useId();

  const recordedEntry = parseEntry(fxDict(word));
  const recordedTrans = fxTrans(word, lang);
  const entry = live ? parseEntry(live.dict?.ok ? live.dict.body : null) : recordedEntry;
  const transResp = live ? live.trans[lang] : null;
  const trans = live ? (transResp?.ok ? parseTranslation(transResp.body) : { text: transResp ? 'Error fetching translation.' : 'Translating...' })
    : recordedTrans ? parseTranslation(recordedTrans) : { text: 'Not recorded for this word and language. Use Fetch live.' };

  async function fetchLive(text = query, l = lang) {
    if (!text.trim()) return;
    setBusy(true);
    const urls = buildUrls(text.trim(), l);
    try {
      const [dict, tr] = await Promise.allSettled([timed(urls.dictionary), timed(urls.translation)]);
      const d = dict.status === 'fulfilled' ? dict.value : null, t = tr.status === 'fulfilled' ? tr.value : null;
      if (!d && !t) throw new Error('offline');
      setLive({ text: text.trim(), dict: d, trans: { [l]: t }, at: new Date(), urls });
      setOpen(true);
    } catch {
      setLive(null);
      alertFallback('Both requests failed (offline or blocked). Showing the recorded response instead.');
    } finally { setBusy(false); }
  }
  async function changeLang(l) {
    setLang(l);
    if (live && !live.trans[l]) {
      setBusy(true);
      const t = await timed(buildUrls(live.text, l).translation).catch(() => null);
      setLive((s) => ({ ...s, trans: { ...s.trans, [l]: t ?? { ok: false } } }));
      setBusy(false);
    }
  }

  const label = live
    ? `Live response, fetched ${live.at.toLocaleTimeString()}`
    : `Recorded API response, captured ${CAPTURED}`;
  const status = live
    ? [live.dict ? `dictionary HTTP ${live.dict.status} in ${live.dict.ms.toFixed(0)} ms` : 'dictionary request failed in the browser, so no definition is shown', transResp ? `translation HTTP ${transResp.status ?? 'failed'}${transResp.ms ? ` in ${transResp.ms.toFixed(0)} ms` : ''}` : null].filter(Boolean)
    : [`dictionary HTTP ${dictStatus(word)}`, recordedTrans ? `translation status ${recordedTrans.responseStatus}, match ${recordedTrans.responseData.match}` : 'translation not recorded'];
  const shown = live ? live.text : word;

  return (
    <section id="play" className="card window reveal" data-title="content.js — popup">
      <div className="head">
        <div>
          <p className="eyebrow">Popup playground</p>
          <h2>The real popup, fed with real API responses.</h2>
          <p className="sub">
            Same markup ids and the extension's own <code>styles.css</code>, filled by the same field rules as <a href={blob('content.js', findLine(contentSrc, 'function formatAndDisplay'))}>formatAndDisplay</a>.
            By default it replays responses recorded with curl on {CAPTURED}. Fetch live sends the same two GET requests from your browser, with the text URL-encoded (the extension does not encode yet; see the audit).
          </p>
        </div>
        <span className={`pill ${live ? 'good' : 'info'}`}>{live ? '● Live' : '● Recorded'}</span>
      </div>
      <div className="controls">
        <div className="field"><label htmlFor={wId}>Recorded word</label>
          <select id={wId} value={live ? '' : word} onChange={(e) => { setLive(null); setWord(e.target.value); setQuery(e.target.value); setOpen(true); }}>
            {live && <option value="">(live: {live.text})</option>}
            {WORDS.map(([w, l]) => <option key={w} value={w}>{l}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor={qId}>Word or phrase to fetch live</label>
          <input id={qId} type="text" value={query} maxLength={80} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchLive()} />
        </div>
      </div>
      <div className="actions" style={{ marginTop: 0, marginBottom: 16 }}>
        <button className="btn primary" onClick={() => fetchLive()} disabled={busy}>{busy ? 'Fetching…' : 'Fetch live'}</button>
        {live && <button className="btn ghost" onClick={() => setLive(null)}>Back to recorded</button>}
        <span className="hint">Free, unauthenticated APIs. MyMemory allows about 5,000 characters a day per anonymous user.</span>
      </div>
      {fallback && !live && <p className="hint" role="status">{fallback}</p>}
      <div className="fakepage">
        <div className="browserbar" aria-hidden="true"><i /><i /><i /><span>example.com/article</span></div>
        <div className="pagebody">
          <p className="pagetext">…and that is how a wrong turn became the best afternoon of the trip, a small piece of <mark>{shown}</mark> nobody planned for.</p>
          {open ? <Popup entry={entry} trans={trans} lang={lang} setLang={changeLang} onClose={() => setOpen(false)} busy={busy} />
            : <button className="btn ghost" onClick={() => setOpen(true)}>Right-click → Word Me: ‘{shown}’</button>}
        </div>
      </div>
      <div className="tip" aria-live="polite"><b>{label}</b> · {status.join(' · ')}</div>
      {!live && word === 'run' && <p className="hint">Single words are ambiguous: the recorded Spanish answer for “run” is a 100% translation-memory match for a bank run, and the first dictionary definition is “To run.”</p>}
      {!live && word === 'wordmeqzx' && <p className="hint">The dictionary answers 404, so the popup falls back to “Result” and “No definition found.” MyMemory still returns a machine “translation” that echoes the input.</p>}
    </section>
  );
}

const LANES = [['page', 'Web page', 'content.js'], ['bg', 'Service worker', 'background.js'], ['dict', 'dictionaryapi.dev', 'definition'], ['mm', 'MyMemory', 'translation']];

function Flow() {
  const [step, setStep] = useState(1);
  const steps = useMemo(() => FLOW.map((s) => ({ ...s, line: findLine(SRC[s.file], s.needle) })), []);
  const cur = steps[step - 1];
  const W = 760, top = 54, rowH = 34, H = top + steps.length * rowH + 16;
  const lx = (k) => 95 + LANES.findIndex(([id]) => id === k) * 190;
  const srcLines = SRC[cur.file].split('\n');
  const from = Math.max(0, cur.line - 3), excerpt = srcLines.slice(from, cur.line + 2);
  return (
    <section id="flow" className="card window reveal" data-title="background.js — message flow">
      <p className="eyebrow">Request flow</p>
      <h2>One right-click, {steps.length} steps, two parallel requests.</h2>
      <p className="sub">
        The service worker injects the popup only into the tab you clicked (activeTab), asks both APIs at once with <code>Promise.allSettled</code> so one failure does not hide the other, then hands the result to the page.
        Drag the slider to follow a lookup. Line numbers are found in the source at build time.
      </p>
      <div className="controls" style={{ gridTemplateColumns: '1fr', marginTop: 16 }}>
        <Range label="Step" value={step} min={1} max={steps.length} step={1} onChange={setStep} show={`${step} of ${steps.length}`} />
      </div>
      <div className="grid2 flowgrid">
        <div style={{ overflowX: 'auto' }}>
          <svg className="chart seq" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sequence diagram of ${steps.length} messages; step ${step}: ${cur.label}`} style={{ minWidth: 520 }}>
            {LANES.map(([id, name, sub]) => (
              <g key={id}>
                <text x={lx(id)} y={18} textAnchor="middle" className="lane">{name}</text>
                <text x={lx(id)} y={34} textAnchor="middle">{sub}</text>
                <line className="axis" x1={lx(id)} x2={lx(id)} y1={42} y2={H - 6} strokeDasharray="3 4" />
              </g>
            ))}
            <defs>
              <marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke" /></marker>
            </defs>
            {steps.map((s, i) => {
              const y = top + i * rowH + 20, on = i === step - 1, past = i < step - 1;
              const x1 = lx(s.from), x2 = lx(s.to), self = s.from === s.to;
              const color = on ? 'var(--primary)' : past ? 'var(--text)' : 'var(--muted)';
              return (
                <g key={i} opacity={on ? 1 : past ? 0.75 : 0.5} style={{ cursor: 'pointer' }} onClick={() => setStep(i + 1)}>
                  {on && <rect x={8} y={y - 22} width={W - 16} height={rowH - 2} rx="8" fill="var(--primary-pale)" />}
                  {self
                    ? <path d={`M${x1} ${y - 8} h34 v12 h-30`} fill="none" stroke={color} strokeWidth={on ? 2 : 1.3} markerEnd="url(#ah)" />
                    : <line x1={x1} x2={x2 + (x2 > x1 ? -3 : 3)} y1={y} y2={y} stroke={color} strokeWidth={on ? 2 : 1.3} markerEnd="url(#ah)" />}
                  <text x={self ? x1 + 42 : (x1 + x2) / 2} y={self ? y : y - 6} textAnchor={self ? 'start' : 'middle'} style={{ fill: color, fontWeight: on ? 700 : 400 }}>{i + 1}. {s.label}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <div>
          <h3>Step {step}: {cur.label}</h3>
          <p className="hint"><a href={blob(cur.file, cur.line)}>{cur.file} line {cur.line}</a></p>
          <pre className="code" aria-label={`${cur.file} lines ${from + 1} to ${from + excerpt.length}`}>{excerpt.map((l, i) => (
            <span key={i} className={from + i + 1 === cur.line ? 'hl' : ''}><b>{String(from + i + 1).padStart(3, ' ')}</b>  {l}{'\n'}</span>
          ))}</pre>
        </div>
      </div>
    </section>
  );
}

const PERM_TEXT = {
  contextMenus: 'Adds the “Word Me: ‘…’” entry to the right-click menu when text is selected.',
  activeTab: 'Grants temporary access to the current tab only, and only after you click the menu item.',
  scripting: 'Lets the service worker inject content.js and styles.css into that tab on demand.',
};

function Permissions() {
  const commits = [...history.commits].reverse();
  const hostOf = (c) => [...new Set([...c.host_permissions, ...c.content_script_matches])];
  const bullets = privacy.split('\n').filter((l) => /^\* We do \*\*not\*\*/.test(l)).map((l) => l.replace(/^\* /, '').replace(/\*\*/g, ''));
  const updated = privacy.match(/\*\*Last updated:\*\* (.+)/)?.[1];
  const war = manifest.web_accessible_resources ?? [];
  return (
    <section id="perms" className="card window reveal" data-title="manifest.json">
      <p className="eyebrow">Permissions and privacy</p>
      <h2>From every website to <em>only the tab you click</em>.</h2>
      <p className="sub">
        The first releases asked for standing access to all URLs and injected a content script everywhere. Three commits on {commits.at(-1).date} removed that: today the extension has no host permissions and runs only when you use it.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <h3>Permissions in v{manifest.version}</h3>
          <ul className="plist">
            {manifest.permissions.map((p) => <li key={p}><code>{p}</code><span>{PERM_TEXT[p] ?? 'No explanation recorded.'}</span></li>)}
            {war.map((w, i) => <li key={i}><code>web_accessible_resources</code><span>Exposes {w.resources.join(' and ')} to {w.matches.join(' ')}. Not needed when injecting with chrome.scripting, and lets any site detect the extension (audit item).</span></li>)}
          </ul>
        </div>
        <div>
          <h3>manifest.json as shipped</h3>
          <pre className="code small">{manifestRaw}</pre>
        </div>
      </div>
      <h3 style={{ marginTop: 20 }}>How host access changed, commit by commit</h3>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Commit</th><th>Date</th><th>Version</th><th>Permissions</th><th>Host access</th></tr></thead>
          <tbody>
            {commits.map((c) => {
              const h = hostOf(c);
              return (
                <tr key={c.hash}><td><a className="mono" href={`${REPO}/commit/${c.hash}`}>{c.hash}</a><div className="hint">{c.subject}</div></td><td>{c.date}</td><td>{c.version ?? 'n/a'}</td>
                  <td className="mono">{c.permissions.join(', ') || 'none'}</td>
                  <td><span className={`pill ${h.length ? 'bad' : 'good'}`}>{h.length ? h.join(' ') : 'none (activeTab)'}</span></td></tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 20 }}>From PRIVACY.md (last updated {updated})</h3>
      <ul className="plist">{bullets.map((b) => <li key={b}><span>{b}</span></li>)}</ul>
      <p className="hint">The selected text itself is sent to the two APIs, as the policy says. This page cannot verify what those services log.</p>
    </section>
  );
}

function Languages() {
  const [lang, setLang] = useState('hi');
  const id = useId();
  const rows = LANGS.map((l) => {
    const r = fxTrans('serendipity', l.code);
    return { ...l, ...parseTranslation(r), by: r?.matches?.[0]?.['created-by'] ?? 'n/a' };
  });
  const cur = rows.find((r) => r.code === lang);
  return (
    <section id="langs" className="card window reveal" data-title="Languages">
      <p className="eyebrow">Language explorer</p>
      <h2>{LANGS.length} targets, and translation memory is not a dictionary.</h2>
      <p className="sub">
        The options come from the <code>&lt;option&gt;</code> tags in content.js. Each answer below is MyMemory's recorded response for “serendipity” ({CAPTURED}), with its own match score and the source of the top memory segment.
        A high score means the stored English segment matched, not that the translation is right.
      </p>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <div className="field"><label htmlFor={id}>Target language</label>
            <select id={id} value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}</select>
          </div>
          <div className="tile bigtrans" style={{ marginTop: 12 }} lang={lang}>
            <div className="num">{cur.text}</div>
            <div className="cap">match {cur.match} · top segment from {cur.by} · status {cur.status}</div>
          </div>
          {lang === 'hi' && <p className="hint">This Hindi answer is a human translation-memory segment that reads “I wish I could say the same”, returned with a 0.97 match. MyMemory's own machine translation was ranked below it.</p>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Code</th><th>Recorded answer</th><th>Match</th><th>Source</th></tr></thead>
            <tbody>
              {rows.map((r) => <tr key={r.code} className={r.code === lang ? 'sel' : ''} onClick={() => setLang(r.code)}><td className="mono">{r.code}</td><td lang={r.code}>{r.text}</td><td>{r.match}</td><td>{r.by}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

const TEMPLATE = popupTemplate(contentSrc);

function SafeRendering() {
  const [payload, setPayload] = useState('<img src=x onerror=alert(document.domain)>');
  const id = useId();
  const markup = fillTemplate(TEMPLATE, { word: 'serendipity', phonetic: '', translation: payload, definition: 'A combination of events…' });
  const transLine = markup.split('\n').find((l) => l.includes('wm-trans-text'))?.trim() ?? '';
  // DOMParser builds an inert document: no scripts run and no images load. Used only to count what innerHTML would create.
  const found = useMemo(() => {
    const doc = new DOMParser().parseFromString(`<div>${transLine}</div>`, 'text/html');
    const box = doc.getElementById('wm-trans-text');
    const els = box ? [...box.querySelectorAll('*')] : [];
    return { els: els.map((e) => e.tagName.toLowerCase()), handlers: els.flatMap((e) => [...e.attributes].filter((a) => /^on/i.test(a.name)).map((a) => `${e.tagName.toLowerCase()} ${a.name}`)) };
  }, [transLine]);
  return (
    <section id="safe" className="card window reveal" data-title="xss_demo — innerHTML vs textContent">
      <p className="eyebrow">Safe-rendering demo</p>
      <h2>Why API text should never go through <em>innerHTML</em>.</h2>
      <p className="sub">
        content.js builds the popup by pasting the word, phonetic, definition and translation into an HTML string and assigning it to <code>innerHTML</code> on the page you are reading.
        MyMemory serves crowd-sourced memory (the Hindi answer above shows unreviewed segments do come back), so a hostile segment would run in that page. This is a demonstration of the code path, not an observed attack. Edit the string to see what the browser would build.
      </p>
      <div className="field" style={{ marginTop: 16 }}><label htmlFor={id}>Translation text returned by the API</label>
        <input id={id} type="text" className="wide" value={payload} maxLength={200} onChange={(e) => setPayload(e.target.value)} />
      </div>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="tile">
          <div className="head" style={{ marginBottom: 8 }}><h3>Today: innerHTML</h3><span className={`pill ${found.handlers.length ? 'bad' : found.els.length ? 'warn' : 'good'}`}>{found.handlers.length ? `${found.handlers.length} event handler${found.handlers.length > 1 ? 's' : ''}` : found.els.length ? `${found.els.length} element(s)` : 'plain text'}</span></div>
          <pre className="code small">{transLine}</pre>
          <p className="hint" style={{ margin: 0 }}>The browser would create: {found.els.length ? found.els.join(', ') : 'no elements'}{found.handlers.length ? `, with ${found.handlers.join(', ')}` : ''}.</p>
        </div>
        <div className="tile">
          <div className="head" style={{ marginBottom: 8 }}><h3>Fix: textContent</h3><span className="pill good">0 elements</span></div>
          <div className="inline-popup"><div className="wm-trans">{payload}</div></div>
          <p className="hint" style={{ margin: 0 }}>Assigning the same string to <code>textContent</code> shows it as characters. The fix touches content.js, so it waits for the Owner's approval.</p>
        </div>
      </div>
    </section>
  );
}

function Audit() {
  const [text, setText] = useState('rock & roll');
  const id = useId();
  const raw = buildUrls(text, 'es', { encode: false }).translation, enc = buildUrls(text, 'es').translation;
  let rawQ;
  try { rawQ = receivedQuery(raw.replace(/ /g, '%20')); } catch { rawQ = '(invalid URL)'; }
  const passes = AUDIT.filter((a) => a.pass).length;
  const rec = (f) => parseTranslation(fixtures[f]).text;
  return (
    <section id="audit" className="card window reveal" data-title="audit.md">
      <div className="head">
        <div>
          <p className="eyebrow">Engineering review</p>
          <h2>{passes} checks pass, {AUDIT.length - passes} known defects are open.</h2>
          <p className="sub">Each line is decided by reading the committed source at build time, so a fix turns it green on the next deploy. None of the fixes are applied yet: they change a published extension and wait for the Owner.</p>
        </div>
        <span className="pill warn">{passes}/{AUDIT.length}</span>
      </div>
      <ul className="audit">
        {AUDIT.map((a) => <li key={a.id}><span className={`pill ${a.pass ? 'good' : 'bad'}`}>{a.pass ? 'Pass' : 'Open'}</span><div><b>{a.title}</b><div className="hint">{a.evidence}</div></div></li>)}
      </ul>
      <h3 style={{ marginTop: 24 }}>Try the URL-encoding defect</h3>
      <div className="field" style={{ marginTop: 8 }}><label htmlFor={id}>Selected text</label>
        <input id={id} type="text" className="wide" value={text} maxLength={80} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="tile"><h3>background.js today</h3><pre className="code small">{raw}</pre><p className="hint" style={{ margin: 0 }}>MyMemory receives q = <b>“{rawQ}”</b></p></div>
        <div className="tile"><h3>With encodeURIComponent</h3><pre className="code small">{enc}</pre><p className="hint" style={{ margin: 0 }}>MyMemory receives q = <b>“{receivedQuery(enc)}”</b></p></div>
      </div>
      <p className="hint">Recorded {CAPTURED} for “rock &amp; roll” into Spanish: unencoded request returned “{rec('rock-and-roll.raw.es.translation.json')}” (to rock), encoded request returned “{rec('rock-and-roll.encoded.es.translation.json')}”.</p>
      <h3 style={{ marginTop: 24 }}>What this page cannot tell you</h3>
      <ul className="plist">
        <li><span>No latency or success-rate figures: nothing has been measured over a word list. Fetch live shows timings for your own requests only.</span></li>
        <li><span>The fixtures are one day's answers from services that change; translation quality is not evaluated beyond the examples shown.</span></li>
        <li><span>The smoke tests run background.js and content.js in Node with a small stand-in for Chrome and the DOM, not in a real browser. Three of them are recorded as known failures.</span></li>
        <li><span>The Web Store package and listing were not inspected.</span></li>
      </ul>
    </section>
  );
}

function Install() {
  const steps = readme.split('\n').filter((l) => /^\d+\.\s/.test(l)).map((l) => l.replace(/^\d+\.\s+/, '').replace(/\*\*/g, '').replace(/`/g, ''));
  const docs = [
    ['README.md', 'README', 'Features and install'],
    ['PRIVACY.md', 'Privacy policy', 'What leaves your browser'],
    ['docs/research-review.md', 'Engineering review', 'Graded, with the open gaps'],
    ['tests/smoke.test.mjs', 'Smoke tests', 'node --test tests/*.test.mjs'],
    ['site/fixtures/index.json', 'Recorded responses', `Captured ${CAPTURED}`],
    ['site/src/check.mjs', 'Known-answer check', 'Runs before every build'],
  ];
  return (
    <section id="install" className="card window reveal" data-title="README.md — Installation">
      <p className="eyebrow">Install</p>
      <h2>Load it unpacked in {steps.length} steps.</h2>
      <ol className="steps" style={{ marginTop: 16 }}>
        {steps.map((s, i) => <li key={i}><span className="n">{i + 1}</span><div>{i === 0 ? <><b>{s}</b><div className="hint"><code>git clone {REPO}.git</code></div></> : <b>{s}</b>}</div></li>)}
      </ol>
      <div className="docs" style={{ marginTop: 20 }}>
        {docs.map(([p, t, d]) => <a key={p} href={blob(p)}><b>{t}</b><small>{d}</small></a>)}
      </div>
    </section>
  );
}
