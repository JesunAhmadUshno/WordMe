// 1. Track mouse position so we know where to show the popup
let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener("contextmenu", (event) => {
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
});

// 2. Listen for the message from background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Remove any existing popup first
  const existing = document.getElementById("word-me-popup");
  if (existing) existing.remove();

  if (request.action === "loading") {
    showPopup("Loading...", lastMouseX, lastMouseY);
  } 
  else if (request.action === "result") {
    formatAndDisplay(request.data);
  }
});

// 3. Helper to format the data
function formatAndDisplay(data) {
  // --- Dictionary Data ---
  const entry = data.dictionary ? data.dictionary[0] : null;
  const word = entry ? entry.word : "Result";
  const phonetic = entry ? (entry.phonetic || "") : "";
  const definition = entry ? entry.meanings[0].definitions[0].definition : "No definition found.";
  
  // --- Translation Data ---
  const translation = data.translation ? data.translation.responseData.translatedText : "No translation.";

  const html = `
    <div class="wm-header">
      <strong>${word}</strong> <span class="wm-phonetic">${phonetic}</span>
    </div>
    <div class="wm-trans">${translation}</div>
    <div class="wm-def">${definition}</div>
    <button id="wm-close">Close</button>
  `;

  showPopup(html, lastMouseX, lastMouseY, true);
}

// 4. Helper to create the popup bubble
function showPopup(content, x, y, isHtml = false) {
  const popup = document.createElement("div");
  popup.id = "word-me-popup";
  
  if (isHtml) popup.innerHTML = content;
  else popup.innerText = content;

  document.body.appendChild(popup);

  // Position it near the mouse
  popup.style.top = `${y + 10}px`;
  popup.style.left = `${x + 10}px`;

  document.getElementById("wm-close")?.addEventListener("click", () => {
    popup.remove();
  });
}