// background.js
chrome.runtime.onMessage.addListener(async (msg, sender) => {
  if (msg.action !== "translate") return;
  try {
    const res = await fetch(msg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(msg.payload)
    });
    const data = await res.json();
    chrome.tabs.sendMessage(sender.tab.id, {
      action: msg.responseAction,
      data
    });
  } catch (error) {
    chrome.tabs.sendMessage(sender.tab.id, {
      action: msg.responseAction,
      error: error.message
    });
  }
});
