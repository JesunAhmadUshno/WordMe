# Word Me - Smart Dictionary Extension 🧠

**Word Me** is a lightweight Google Chrome Extension that integrates dictionary definitions, phonetics, and real-time translations directly into the browser's context menu.

![Demo](demo.gif) *(Tip: Record a small screen capture of it working and put it here)*

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
* [ ] Add text-to-speech audio support.

---
*Created by Jesun Ahmad Ushno*
