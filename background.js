// 1. Create the Context Menu when the extension is installed
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "wordMeLookup",
    title: "Word Me: '%s'",
    contexts: ["selection"]
  });
});

// 2. Listen for when the user clicks the menu item
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "wordMeLookup") {
    // Get the selected text and trim extra spaces
    const selectedText = info.selectionText.trim();
    
    // Notify content script to show "Loading..." bubble
    // We add .catch() here to prevent the "Receiving end does not exist" error
    chrome.tabs.sendMessage(tab.id, { action: "loading" }).catch(() => {
      console.log("Could not send 'loading' message. The user likely needs to refresh the page.");
    });

    // --- CONFIGURATION ---
    const targetLang = "es";  // Change this to 'fr', 'de', 'bn', etc.
    const sourceLang = "en"; 
    // ---------------------

    // 3. Prepare the API requests (Dictionary + Translation)
    const dictionaryFetch = fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${selectedText}`)
      .then(res => {
        if (!res.ok) throw new Error("Word not found");
        return res.json();
      });

    const translationFetch = fetch(`https://api.mymemory.translated.net/get?q=${selectedText}&langpair=${sourceLang}|${targetLang}`)
      .then(res => res.json());

    // 4. Execute both requests simultaneously
    Promise.allSettled([dictionaryFetch, translationFetch])
      .then((results) => {
        // Check if Dictionary succeeded
        const dictionaryResult = results[0].status === 'fulfilled' ? results[0].value : null;
        
        // Check if Translation succeeded
        const translationResult = results[1].status === 'fulfilled' ? results[1].value : null;

        // 5. Send combined data back to content script
        chrome.tabs.sendMessage(tab.id, { 
          action: "result", 
          data: {
            dictionary: dictionaryResult,
            translation: translationResult
          } 
        }).catch(() => {
            // This catches the error if the user hasn't refreshed the page yet
            console.log("Could not send data. The content script is not ready.");
        });
      })
      .catch(error => {
        console.error("Global Error:", error);
        chrome.tabs.sendMessage(tab.id, { action: "error" }).catch(() => {}); 
      });
  }
});