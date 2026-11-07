# Word Me: engineering and research review

Reviewed 2026-11-07 against `master` at `0d7946f` (extension v1.4). Word Me is a product app, not a study, so the research rubric is read through an engineering lens: is the question it answers clear, is behaviour verified, are claims backed by evidence, and is every known gap written down with what it would take to close it.

Grades: A (meets the bar), B (mostly there), C (partly there), D (missing).

| Criterion | Grade | Evidence and reasoning |
|---|---|---|
| Question / purpose | A | One clear job: look up a selected word (definition, phonetics, audio, translation) without leaving the page. README and manifest agree. |
| Hypotheses / design claims | C | Implicit claims ("lightweight", "non-intrusive", "works on local files") are not tested. "Works on local files" is contradicted by `injectContent`, which returns early for any URL that is not http or https. |
| Method / architecture | B | Small, readable MV3 design: context menu, activeTab injection, two parallel fetches with `Promise.allSettled`, popup in the page. Weaknesses: the popup is built with `innerHTML`, and the target language is hard-coded. |
| Baselines / comparison | D | No comparison with other dictionary extensions or Chrome's built-in lookup. Not needed for a portfolio piece, but no claim of superiority is made either, which is correct. |
| Measurement / uncertainty | D | No latency, success rate or translation-quality figures exist. The dashboard shows none and labels Fetch live timings as the viewer's own. |
| Verification / tests | C (was D) | Before this review there were no tests. Now `tests/smoke.test.mjs` runs the real `background.js` and `content.js` in `node:vm` with recorded responses: 6 pass, 3 known defects are recorded as `todo`. `site/src/check.mjs` reproduces every dashboard number. CI runs both. Still missing: a real-browser test of the injected popup. |
| Reproducibility | B (was C) | Loads unpacked with no build step. API responses are now recorded with their URLs and date in `site/fixtures/index.json`, so the behaviour shown can be replayed offline. The APIs themselves change over time, so live results will drift. |
| Threats / security | C | Good: host access was reduced to activeTab only in three commits (`ae1e659`, `f1e3f0a`, `0d7946f`). Open: API strings reach `innerHTML` in the host page (XSS path); `web_accessible_resources` exposes the scripts to every site (fingerprinting); selections are not URL-encoded. |
| Related work | D | None cited. The two APIs are credited in README and PRIVACY.md. |
| Limitations stated | C (was D) | The README listed no limitations. The dashboard and this file now list them. |
| Privacy | B | PRIVACY.md matches the code: the selected text goes to the two APIs and nothing is stored. Last updated 2026-01-14, before the v1.2 to v1.4 permission changes; it is still accurate. |

## Fixed in this pass (no change to the extension's behaviour)

- Recorded API fixtures for 3 words and all 8 languages, with URLs, status codes and capture date.
- Smoke tests for the extension and a known-answer check for the dashboard, both in CI.
- README: removed the dead `demo.gif` reference, ticked the audio roadmap item (already built), added the dashboard link and test commands.
- Live dashboard with a source-driven audit, so a fix to any defect below turns its line green on the next deploy.

## Open gaps and exactly what closing each one needs

Items 1 to 5 change `background.js`, `content.js` or `manifest.json`, which ship in a published extension, so they wait for the Owner's approval. Each has a matching audit line on the dashboard and, where noted, a `todo` test that will start passing.

1. **Icon file case.** `manifest.json` names `icon.png`; the tracked file is `Icon.png`. Fix: change the three icon paths to `Icon.png` (one line each). Test: the `todo` icon test.
2. **URL encoding.** `background.js` puts the selection straight into both URLs. Recorded evidence: "rock & roll" into Spanish returned "mecerse" (to rock) unencoded and "Rock & Roll" encoded. Fix: `encodeURIComponent(selectedText)` and `encodeURIComponent(word)` in the three fetch URLs. Test: the `todo` encoding test.
3. **XSS path.** `formatAndDisplay` interpolates word, phonetic, definition and translatedText into an HTML string assigned to `innerHTML`. Fix: build the popup with `createElement` and `textContent` (about 30 lines). No exploit has been observed; the demonstration on the dashboard is of the code path.
4. **Robustness.** Guard `entry.meanings[0].definitions[0]` with optional chaining, check `responseStatus` and `quotaFinished` before showing a translation, handle the `error` message, and stop removing the popup on unrelated messages. Test: the `todo` malformed-data test, plus new tests for a quota response.
5. **Exposure and resources.** Remove `web_accessible_resources` (not needed for `chrome.scripting` injection), and register the drag listeners once instead of per popup.
6. **Accessibility.** Add `role="dialog"`, an accessible name, focus on open and Escape to close. Needs: a manual check with a screen reader (NVDA or VoiceOver) and keyboard only; no compute.
7. **Language preference.** Save the dropdown choice with `chrome.storage.sync` (needs the `storage` permission, a manifest change and a privacy-policy line).
8. **Measurement.** To make any latency or success-rate claim: run a fixed list of about 200 common English words and 50 phrases through both APIs once (about 500 free requests, within MyMemory's anonymous daily quota if spread over two days), record status codes and timings to a committed CSV, and report medians with bootstrap intervals. To judge translation quality: have a fluent reviewer rate a sample per language (the recorded Hindi and Italian answers for "serendipity" are not translations of the word, so quality is a real issue). No GPU or paid service is needed.
9. **Real-browser test.** Load the unpacked extension in headless Chrome with Playwright (`--load-extension`), select a word on a local test page, trigger the menu command and assert on the popup. Needs a Chrome build that supports extensions in headless mode; runs in under a minute.
10. **Branch hygiene.** `origin/main` is stale at `053c980`; the default branch is `master` and the Pages workflow targets `master`. Deleting or archiving `main` is the Owner's call.
