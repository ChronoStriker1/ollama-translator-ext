// Background service worker - Fixed Version with Enhanced Error Handling
let conversationSessions = new Map();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Ollama Translator Enhanced installed');
  
  // Remove existing context menus to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Create context menu for OCR
    chrome.contextMenus.create({
      id: "ollama-ocr-translate",
      title: "📷 OCR & Translate",
      contexts: ["page", "image"]
    });

    // Create context menu for selected text translation
    chrome.contextMenus.create({
      id: "ollama-translate-selection",
      title: "🌐 Translate Selection",
      contexts: ["selection"]
    });
    
    console.log('Context menus created successfully');
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, 'on tab:', tab.id);
  
  if (info.menuItemId === "ollama-ocr-translate") {
    console.log('Starting OCR translation...');
    chrome.tabs.sendMessage(tab.id, { action: "start-ocr" })
      .then(() => console.log('OCR message sent successfully'))
      .catch(err => console.warn('Failed to send OCR message:', err));
  } 
  else if (info.menuItemId === "ollama-translate-selection") {
    console.log('Translating selected text:', info.selectionText?.substring(0, 50) + '...');
    chrome.tabs.sendMessage(tab.id, { 
      action: "translate-selected-text", 
      selectedText: info.selectionText 
    })
      .then(() => console.log('Translation message sent successfully'))
      .catch(err => console.warn('Failed to send translation message:', err));
  }
});

// Enhanced screenshot capture for OCR + Native Messaging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message.action);
  
  if (message.action === 'captureScreenshot') {
    // Check if we have the necessary permissions
    if (!chrome.tabs || !chrome.tabs.captureVisibleTab) {
      console.error('Missing tabs permission or captureVisibleTab API');
      sendResponse({ error: 'Missing required permissions for screenshot capture' });
      return true;
    }
    
    console.log('Attempting to capture screenshot for tab:', sender.tab?.id);
    
    // Use null for windowId to capture the current active tab's window
    chrome.tabs.captureVisibleTab(
      null, // Let Chrome determine the current window automatically
      { 
        format: 'png', 
        quality: 100 
      },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error('Screenshot capture failed:', chrome.runtime.lastError);
          sendResponse({ 
            error: `Screenshot capture failed: ${chrome.runtime.lastError.message}` 
          });
        } else if (!dataUrl) {
          console.error('No screenshot data returned');
          sendResponse({ 
            error: 'No screenshot data returned' 
          });
        } else {
          console.log('Screenshot captured successfully, size:', dataUrl.length);
          sendResponse({ dataUrl: dataUrl });
        }
      }
    );
    return true; // Keep message channel open
  }
  
  // Handle native messaging for OCR - SIMPLIFIED VERSION
  if (message.action === 'sendNativeMessage') {
    const { hostName, nativeMessage } = message;
    
    console.log('📷 Background: Sending native message to:', hostName);
    console.log('📷 Background: Message action:', nativeMessage.action);
    
    if (!chrome.runtime.sendNativeMessage) {
      console.error('📷 Background: Native messaging not available');
      sendResponse({ error: 'Native messaging not supported' });
      return true;
    }
    
    // Set a timeout for native messaging
    const timeout = setTimeout(() => {
      console.error('📷 Background: Native messaging timeout');
      sendResponse({ error: 'Native messaging timeout after 15 seconds' });
    }, 15000);
    
    chrome.runtime.sendNativeMessage(hostName, nativeMessage, (response) => {
      clearTimeout(timeout);
      
      console.log('📷 Background: Native host response received');
      console.log('📷 Background: Response:', response);
      
      if (chrome.runtime.lastError) {
        console.error('📷 Background: Native messaging error:', chrome.runtime.lastError);
        sendResponse({ error: chrome.runtime.lastError.message });
        return;
      }
      
      // Simplified response handling
      if (!response) {
        console.error('📷 Background: No response from native host');
        sendResponse({ error: 'No response from native host' });
        return;
      }
      
      // Handle string responses (plain text OCR results)
      if (typeof response === 'string') {
        console.log('📷 Background: Plain text response');
        sendResponse({ 
          response: {
            text: response.trim(),
            confidence: response.trim().length > 0 ? 95 : 0
          }
        });
        return;
      }
      
      // Handle object responses
      if (typeof response === 'object') {
        console.log('📷 Background: Object response');
        sendResponse({ response: response });
        return;
      }
      
      // Fallback
      sendResponse({ 
        response: {
          text: String(response),
          confidence: 50
        }
      });
    });
    
    return true; // Keep message channel open for async response
  }
  
  // Handle translation requests
  if (message.action === 'translate') {
    handleTranslation(message, sender, sendResponse);
    return true;
  } else if (message.action === 'translateWithContext') {
    handleContextTranslation(message, sender, sendResponse);
    return true;
  }
});

// Test native messaging availability
function testNativeMessaging() {
  console.log('Testing native messaging availability...');
  console.log('chrome.runtime.sendNativeMessage available:', typeof chrome.runtime.sendNativeMessage);
  
  if (chrome.runtime.sendNativeMessage) {
    // Test macOS Live Text
    chrome.runtime.sendNativeMessage('com.ollama.translator.ocr', { action: 'check_availability' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('macOS Live Text test failed:', chrome.runtime.lastError.message);
      } else {
        console.log('macOS Live Text test response:', response);
      }
    });
    
    // Test macOS Vision
    chrome.runtime.sendNativeMessage('com.ollama.translator.vision', { action: 'check_vision_availability' }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('macOS Vision test failed:', chrome.runtime.lastError.message);
      } else {
        console.log('macOS Vision test response:', response);
      }
    });
  }
}

// Call this when the extension starts
chrome.runtime.onStartup.addListener(() => {
  conversationSessions.clear();
  testNativeMessaging();
});

// Rest of translation handling code...
async function handleTranslation(request, sender, sendResponse) {
  try {
    const response = await fetch(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: request.responseAction,
        data: data
      }).catch(err => {
        console.warn('Failed to send message to tab:', err);
        sendResponse({ data: data });
      });
    } else {
      sendResponse({ data: data });
    }
  } catch (error) {
    console.error('Translation error:', error);
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: request.responseAction,
        error: error.message
      }).catch(err => {
        console.warn('Failed to send error to tab:', err);
        sendResponse({ error: error.message });
      });
    } else {
      sendResponse({ error: error.message });
    }
  }
}

async function handleContextTranslation(request, sender, sendResponse) {
  try {
    const { payload, url, responseAction } = request;
    const tabId = sender.tab?.id || 'default';

    if (payload.closeConversation) {
      conversationSessions.delete(tabId);
      
      if (sender.tab?.id) {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: responseAction,
          data: { closed: true }
        }).catch(err => {
          console.warn('Failed to send close confirmation to tab:', err);
          sendResponse({ data: { closed: true } });
        });
      } else {
        sendResponse({ data: { closed: true } });
      }
      return;
    }

    let conversationId = payload.conversationId;
    
    if (payload.isInitial || !conversationId) {
      conversationId = `conv_${Date.now()}_${Math.random()}`;
      conversationSessions.set(tabId, conversationId);
    }

    const requestBody = {
      model: payload.model,
      prompt: payload.prompt || payload.textOnly,
      stream: false,
      options: payload.options || {}
    };

    if (payload.systemPrompt) {
      requestBody.system = payload.systemPrompt;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: responseAction,
        data: data,
        conversationId: conversationId
      }).catch(err => {
        console.warn('Failed to send translation result to tab:', err);
        sendResponse({ data: data, conversationId: conversationId });
      });
    } else {
      sendResponse({ data: data, conversationId: conversationId });
    }
  } catch (error) {
    console.error('Context translation error:', error);
    
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: responseAction,
        error: error.message
      }).catch(err => {
        console.warn('Failed to send error to tab:', err);
        sendResponse({ error: error.message });
      });
    } else {
      sendResponse({ error: error.message });
    }
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  conversationSessions.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    conversationSessions.delete(tabId);
  }
});

chrome.runtime.onStartup.addListener(() => {
  conversationSessions.clear();
});