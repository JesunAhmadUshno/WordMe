if (window.__wordMeInjected) {
  console.debug("Word Me already injected");
} else {
  window.__wordMeInjected = true;

  // 1. Track mouse position
  let lastMouseX = 0;
  let lastMouseY = 0;

  document.addEventListener("contextmenu", (event) => {
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  });

  // 2. Listen for messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const existing = document.getElementById("word-me-popup");
    if (existing) existing.remove();

    if (request.action === "loading") {
      showPopup("Loading...", lastMouseX, lastMouseY);
    } else if (request.action === "result") {
      formatAndDisplay(request.data);
    }
  });

  function formatAndDisplay(data) {
    const entry = data.dictionary ? data.dictionary[0] : null;
    const word = entry ? entry.word : "Result";
    const phonetic = entry ? (entry.phonetic || "") : "";
    const definition = entry ? entry.meanings[0].definitions[0].definition : "No definition found.";
    
    let initialTranslation = data.translation ? data.translation.responseData.translatedText : "No translation.";

    let audioUrl = null;
    if (entry && entry.phonetics) {
      for (let p of entry.phonetics) {
        if (p.audio && p.audio.length > 0) {
          audioUrl = p.audio;
          break;
        }
      }
    }

    const langOptions = `
      <option value="es">Spanish (ES)</option>
      <option value="bn">Bengali (BN)</option>
      <option value="fr">French (FR)</option>
      <option value="de">German (DE)</option>
      <option value="hi">Hindi (HI)</option>
      <option value="it">Italian (IT)</option>
      <option value="ja">Japanese (JA)</option>
      <option value="ru">Russian (RU)</option>
    `;

    const html = `
      <div class="wm-header" id="wm-drag-handle">
        <div style="display:flex; align-items:center; gap:8px;">
          <strong>${word}</strong> 
          <span class="wm-phonetic">${phonetic}</span>
          ${audioUrl ? `<button id="wm-play-audio" title="Listen">🔊</button>` : ''}
        </div>
      </div>

      <div class="wm-lang-bar">
          <span>English &rarr; </span>
          <select id="wm-lang-select">
              ${langOptions}
          </select>
      </div>

      <div class="wm-trans" id="wm-trans-text">${initialTranslation}</div>
      <div class="wm-def">${definition}</div>
      <button id="wm-close">Close</button>
    `;

    showPopup(html, lastMouseX, lastMouseY, true);

    if (audioUrl) {
      document.getElementById("wm-play-audio").addEventListener("click", () => {
        new Audio(audioUrl).play();
      });
    }

    const langSelect = document.getElementById("wm-lang-select");
    const transBox = document.getElementById("wm-trans-text");

    langSelect.addEventListener("change", (e) => {
      const newLang = e.target.value;
      transBox.innerText = "Translating...";
      transBox.style.opacity = "0.5";

      chrome.runtime.sendMessage({ 
        action: "fetchTranslation", 
        word: word, 
        targetLang: newLang 
      }, (response) => {
        transBox.style.opacity = "1";
        if (response && response.success) {
          transBox.innerText = response.data.responseData.translatedText;
        } else {
          transBox.innerText = "Error fetching translation.";
        }
      });
    });
  }

  function showPopup(content, x, y, isHtml = false) {
    const popup = document.createElement("div");
    popup.id = "word-me-popup";
    
    if (isHtml) popup.innerHTML = content;
    else popup.innerText = content;

    document.body.appendChild(popup);

    popup.style.top = `${y + 10}px`;
    popup.style.left = `${x + 10}px`;

    document.getElementById("wm-close")?.addEventListener("click", () => {
      popup.remove();
    });

    const handle = document.getElementById("wm-drag-handle");
    if (handle) makeDraggable(popup, handle);
  }

  function makeDraggable(element, handle) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    handle.addEventListener('mousedown', (e) => {
      if(e.target.id === 'wm-play-audio') return;
      
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = element.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      handle.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      element.style.left = `${initialLeft + dx}px`;
      element.style.top = `${initialTop + dy}px`;
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      handle.style.cursor = 'move';
    });
  }
}