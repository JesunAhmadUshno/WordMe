// 1. Create the Context Menu when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wordMeLookup",
    title: "Word Me: '%s'",
    contexts: ["selection"]
  });
});

async function injectContent(tab) {
  if (!tab?.id) return;
  const url = tab.url || "";
  if (!url.startsWith("http://") && !url.startsWith("https://")) return;

  await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["styles.css"] }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }).catch(() => {});
}

// 2. Listen for when the user clicks the menu item
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "wordMeLookup") return;
  if (!info.selectionText || !tab?.id) return;

  const selectedText = info.selectionText.trim();
  await injectContent(tab);

  chrome.tabs.sendMessage(tab.id, { action: "loading" }).catch(() => {
    console.log("Could not send 'loading' message. The user likely needs to refresh the page.");
  });

  const targetLang = "es";  // Change this to 'fr', 'de', 'bn', etc.
  const sourceLang = "en"; 

  const dictionaryFetch = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${selectedText}`)
    .then(res => {
      if (!res.ok) throw new Error("Word not found");
      return res.json();
    });

  const translationFetch = fetch(`https://api.mymemory.translated.net/get?q=${selectedText}&langpair=${sourceLang}|${targetLang}`)
    .then(res => res.json());

  Promise.allSettled([dictionaryFetch, translationFetch])
    .then((results) => {
      const dictionaryResult = results[0].status === 'fulfilled' ? results[0].value : null;
      const translationResult = results[1].status === 'fulfilled' ? results[1].value : null;

      chrome.tabs.sendMessage(tab.id, { 
        action: "result", 
        data: {
          dictionary: dictionaryResult,
          translation: translationResult
        } 
      }).catch(() => {
          console.log("Could not send data. The content script is not ready.");
      });
    })
    .catch(error => {
      console.error("Global Error:", error);
      chrome.tabs.sendMessage(tab.id, { action: "error" }).catch(() => {}); 
    });
});

// Listen for "Translate Only" requests from the popup dropdown
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchTranslation") {
    const { word, targetLang } = request;
    
    fetch(`https://api.mymemory.translated.net/get?q=${word}&langpair=en|${targetLang}`)
      .then(res => res.json())
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error("Translation Error:", error);
        sendResponse({ success: false });
      });

    return true; // Keep the message channel open for the async response
  }
});