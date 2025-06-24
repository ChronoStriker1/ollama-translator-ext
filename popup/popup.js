document.addEventListener('DOMContentLoaded', () => {
  const openOptionsBtn = document.getElementById('openOptions');
  const toggleBtn = document.getElementById('toggleExtension');
  const statusDiv = document.getElementById('status');

  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Check if extension is working
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'ping'}, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = '❌ Extension not loaded on this page';
          statusDiv.className = 'status error';
        } else {
          statusDiv.textContent = '✅ Extension active';
          statusDiv.className = 'status success';
        }
        statusDiv.style.display = 'block';
      });
    }
  });
});