// background.js
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate Selection with Ollama",
    contexts: ["selection"], // Show only when text is selected
  });
});

// Listen for context menu item clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-selection") {
    // Pass mouse coordinates along with the selection text
    chrome.tabs.sendMessage(tab.id, {
      action: "translate-selected-text",
      selectedText: info.selectionText,
      // We can't directly get mouse coords here on MV3 from onCLicked without a content script listener for clicks.
      // The current approach is to pass the selection text, and position the popup relative to the toolbar.
      // To accurately position near selected text from a context menu click,
      // we would need to inject a script to listen for mouse events, which is more complex.
      // For now, let's stick with the toolbar positioning as it's reliable.
    });
  }
});

// Existing listener for 'translate' action (for toolbar buttons)
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.action !== "translate") return;

  try {
    const res = await fetch(msg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload)
    });
    const data = await res.json();

    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: msg.responseAction,
        data
      });
    } else {
      console.error("Ollama Translator: Could not send response to content script.");
    }
  } catch (error) {
    if (sender.tab && sender.tab.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: msg.responseAction,
        error: error.message
      });
    } else {
      console.error("Ollama Translator: Could not send error response to content script.");
    }
  }
});