# Word Me - Smart Dictionary Extension 🧠

**Word Me** is a lightweight Google Chrome Extension that integrates dictionary definitions, phonetics, and real-time translations directly into the browser's context menu.

Live dashboard: https://jesunahmadushno.github.io/WordMe/ (the popup replayed on recorded API responses, the request flow, permissions history and an engineering audit)

## 🚀 Features
* **Instant Definitions:** Fetches data from the Free Dictionary API.
* **Multi-Language Translation:** Translates selected text using the MyMemory API.
* **Non-Intrusive UI:** Injects a clean, removable popup directly into the DOM.
* **Cross-Platform Support:** Works on standard webpages and local files (if permitted).

## 🛠️ Tech Stack
* **Manifest V3** (Latest Chrome Extension Standard)
* **JavaScript (ES6+)** - `fetch`, `Promise.allSettled`, `Async/Await`
* **DOM Manipulation** - Dynamic HTML injection
* **CSS3** - For styling the floating interface

## 📦 Installation
1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Toggle **Developer mode** (top right).
4.  Click **Load unpacked** and select the project folder.
5.  **Refresh any webpage** before using!

## 🔮 Future Improvements
* [ ] Add an Options Page to change target languages dynamically.
* [ ] Add "Save Word" feature to build a personal vocabulary list.
* [x] Add pronunciation audio (the popup plays the dictionary's recording when one exists).
* [ ] Fix the open items in the [engineering review](docs/research-review.md): URL-encode the selection, render API text with textContent, match the manifest icon name to `Icon.png`.

## 🧪 Tests and dashboard
* `node --test tests/*.test.mjs` runs `background.js` and `content.js` against recorded API responses (no network).
* `cd site && npm ci && npm run build` checks every dashboard number against the repo files, then builds the page.

---
*Created by Jesun Ahmad Ushno*
