// Background script for Ollama Translator Extension
const activeConversations = new Map();
const MAX_CONVERSATION_LENGTH = 50; // Prevent memory issues

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'translate') {
    handleTranslation(message, sender, sendResponse);
    return true;
  } else if (message.action === 'translateWithContext') {
    handleTranslationWithContext(message, sender, sendResponse);
    return true;
  }
});

// Original translation handler (preserved for compatibility)
async function handleTranslation(message, sender, sendResponse) {
  const { payload, url, responseAction } = message;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    chrome.tabs.sendMessage(sender.tab.id, {
      action: responseAction,
      data: data
    });
    
  } catch (error) {
    console.error('Translation error:', error);
    chrome.tabs.sendMessage(sender.tab.id, {
      action: responseAction,
      error: error.message
    });
  }
}

// New conversation-based translation handler
async function handleTranslationWithContext(message, sender, sendResponse) {
  const { payload, url, responseAction } = message;
  const { conversationId, isInitial, textOnly, closeConversation } = payload;
  
  try {
    let response;
    let newConversationId = conversationId;
    
    // Close conversation if requested
    if (closeConversation && conversationId) {
      activeConversations.delete(conversationId);
      chrome.tabs.sendMessage(sender.tab.id, {
        action: responseAction,
        data: { conversationClosed: true }
      });
      return;
    }
    
    // Determine which API endpoint to use
    const isChatAPI = url.includes('/api/chat') || payload.useChat;
    const apiUrl = isChatAPI ? url.replace('/api/generate', '/api/chat') : url;
    
    if (isInitial || !conversationId || !activeConversations.has(conversationId)) {
      // Start new conversation
      newConversationId = generateConversationId();
      
      if (isChatAPI) {
        // Use chat API
        const requestBody = {
          model: payload.model,
          messages: [
            {
              role: 'system',
              content: payload.systemPrompt || 'You are a professional translator.'
            },
            {
              role: 'user',
              content: payload.prompt
            }
          ],
          stream: false,
          options: payload.options || {}
        };
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const assistantResponse = data.message?.content || data.response || '';
        
        // Store conversation
        activeConversations.set(newConversationId, {
          messages: [
            { role: 'system', content: requestBody.messages[0].content },
            { role: 'user', content: payload.prompt },
            { role: 'assistant', content: assistantResponse }
          ],
          model: payload.model,
          options: payload.options || {},
          createdAt: Date.now()
        });
        
        chrome.tabs.sendMessage(sender.tab.id, {
          action: responseAction,
          data: { response: assistantResponse },
          conversationId: newConversationId
        });
        
      } else {
        // Use generate API (fallback)
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: payload.model,
            prompt: payload.prompt,
            stream: false,
            options: payload.options || {}
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const assistantResponse = data.response || '';
        
        // Store conversation context for generate API
        activeConversations.set(newConversationId, {
          context: payload.prompt + '\n' + assistantResponse,
          model: payload.model,
          options: payload.options || {},
          createdAt: Date.now(),
          isGenerateAPI: true
        });
        
        chrome.tabs.sendMessage(sender.tab.id, {
          action: responseAction,
          data: { response: assistantResponse },
          conversationId: newConversationId
        });
      }
      
    } else {
      // Continue existing conversation
      const conversation = activeConversations.get(conversationId);
      
      if (conversation.isGenerateAPI) {
        // Handle generate API continuation
        const contextPrompt = conversation.context + '\nuser: ' + textOnly + '\nassistant:';
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: conversation.model,
            prompt: contextPrompt,
            stream: false,
            options: conversation.options
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const assistantResponse = data.response || '';
        
        // Update context
        conversation.context = contextPrompt + assistantResponse;
        
        chrome.tabs.sendMessage(sender.tab.id, {
          action: responseAction,
          data: { response: assistantResponse }
        });
        
      } else {
        // Handle chat API continuation
        // Add new user message
        conversation.messages.push({
          role: 'user',
          content: textOnly
        });
        
        // Trim conversation if too long
        if (conversation.messages.length > MAX_CONVERSATION_LENGTH) {
          // Keep system message and recent messages
          const systemMsg = conversation.messages[0];
          const recentMessages = conversation.messages.slice(-MAX_CONVERSATION_LENGTH + 1);
          conversation.messages = [systemMsg, ...recentMessages];
        }
        
        response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: conversation.model,
            messages: conversation.messages,
            stream: false,
            options: conversation.options
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const assistantResponse = data.message?.content || data.response || '';
        
        // Add assistant response
        conversation.messages.push({
          role: 'assistant',
          content: assistantResponse
        });
        
        chrome.tabs.sendMessage(sender.tab.id, {
          action: responseAction,
          data: { response: assistantResponse }
        });
      }
    }
    
  } catch (error) {
    console.error('Translation with context error:', error);
    
    // Clean up failed conversation
    if (conversationId) {
      activeConversations.delete(conversationId);
    }
    
    chrome.tabs.sendMessage(sender.tab.id, {
      action: responseAction,
      error: error.message
    });
  }
}

function generateConversationId() {
  return 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Cleanup old conversations periodically
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [id, conversation] of activeConversations.entries()) {
    if (now - conversation.createdAt > maxAge) {
      activeConversations.delete(id);
    }
  }
  
  // Also limit total conversations
  if (activeConversations.size > 10) {
    const entries = Array.from(activeConversations.entries());
    const toDelete = entries.slice(0, entries.length - 5);
    toDelete.forEach(([id]) => activeConversations.delete(id));
  }
}, 300000); // Every 5 minutes

// Handle context menu creation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate-selection",
    title: "Translate with Ollama",
    contexts: ["selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translate-selection" && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      action: "translate-selected-text",
      selectedText: info.selectionText
    });
  }
});