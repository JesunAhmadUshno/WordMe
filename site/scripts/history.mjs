// One-off: node scripts/history.mjs <ref>  ->  src/history.json
// Records each commit on <ref> with the manifest's version and permissions at that commit,
// so the dashboard can show how host access changed without needing git in CI.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const ref = process.argv[2] || 'master';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', cwd: new URL('../..', import.meta.url) });
const commits = git('log', ref, '--format=%h|%ad|%s', '--date=short').trim().split('\n').map((l) => {
  const [hash, date, ...s] = l.split('|');
  let m = null;
  try { m = JSON.parse(git('show', `${hash}:manifest.json`)); } catch { /* commit without a manifest */ }
  return {
    hash, date, subject: s.join('|'),
    version: m?.version ?? null,
    permissions: m?.permissions ?? [],
    host_permissions: m?.host_permissions ?? [],
    content_script_matches: (m?.content_scripts ?? []).flatMap((c) => c.matches),
  };
});
fs.writeFileSync(new URL('../src/history.json', import.meta.url), JSON.stringify({ ref, head: commits[0].hash, commits }, null, 1) + '\n');
console.log(`history: ${commits.length} commits on ${ref}`);
