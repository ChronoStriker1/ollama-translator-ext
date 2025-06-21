// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const elements = {
    ollamaUrl: document.getElementById('ollamaUrl'),
    ollamaModel: document.getElementById('ollamaModel'),
    translationDelay: document.getElementById('translationDelay'),
    maxRetries: document.getElementById('maxRetries'),
    useAggressiveBypass: document.getElementById('useAggressiveBypass'),
    bypassMode: document.getElementById('bypassMode'),
    customTranslateInstruction: document.getElementById('customTranslateInstruction'),
    excludedDomains: document.getElementById('excludedDomains'),
    saveBtn: document.getElementById('saveBtn'),
    resetBtn: document.getElementById('resetBtn'),
    testBtn: document.getElementById('testBtn'),
    status: document.getElementById('status')
  };

  // Default values with localhost example
  const defaults = {
    ollamaUrl: 'http://localhost:11434/api/generate',
    ollamaModel: 'llama3.2:latest',
    translationDelay: 300,
    maxRetries: 3,
    useAggressiveBypass: false,
    bypassMode: 'translation',
    customTranslateInstruction: 'Translate this text to natural, conversational English. Match the original tone and context. Use slang, casual language, and terminology that native English speakers would actually use in this situation. Translate EVERY word to English - no foreign words left untranslated. Output only the translation:',
    excludedDomains: [] // Empty by default, user can add localhost if needed
  };

  // Load settings with better error handling
  function loadSettings() {
    chrome.storage.sync.get([
      'ollamaUrl',
      'ollamaModel', 
      'translationDelay',
      'maxRetries',
      'useAggressiveBypass',
      'bypassMode',
      'customTranslateInstruction',
      'excludedDomains'
    ], function(result) {
      if (chrome.runtime.lastError) {
        console.error('Error loading settings:', chrome.runtime.lastError);
        showStatus('Error loading settings', 'error');
        return;
      }

      elements.ollamaUrl.value = result.ollamaUrl || defaults.ollamaUrl;
      elements.ollamaModel.value = result.ollamaModel || defaults.ollamaModel;
      elements.translationDelay.value = result.translationDelay !== undefined ? result.translationDelay : defaults.translationDelay;
      elements.maxRetries.value = result.maxRetries !== undefined ? result.maxRetries : defaults.maxRetries;
      elements.useAggressiveBypass.checked = result.useAggressiveBypass !== undefined ? result.useAggressiveBypass : defaults.useAggressiveBypass;
      elements.bypassMode.value = result.bypassMode || defaults.bypassMode;
      elements.customTranslateInstruction.value = result.customTranslateInstruction || defaults.customTranslateInstruction;
      
      // Handle excluded domains with localhost examples
      const excludedDomains = result.excludedDomains || defaults.excludedDomains;
      elements.excludedDomains.value = excludedDomains.join('\n');
      
      console.log('Settings loaded successfully');
    });
  }

  // Save settings with validation
  function saveSettings() {
    // Validate URL
    const url = elements.ollamaUrl.value.trim();
    if (!url) {
      showStatus('Please enter a valid Ollama URL', 'error');
      return;
    }

    // Validate model
    const model = elements.ollamaModel.value.trim();
    if (!model) {
      showStatus('Please enter a valid model name', 'error');
      return;
    }

    // Process excluded domains
    const excludedDomainsText = elements.excludedDomains.value.trim();
    const excludedDomains = excludedDomainsText
      .split('\n')
      .map(domain => domain.trim().toLowerCase())
      .filter(domain => domain.length > 0)
      .filter(domain => {
        // Basic domain validation
        if (domain === 'localhost' || domain === '127.0.0.1') return true;
        if (domain.match(/^\d+\.\d+\.\d+\.\d+$/)) return true; // IP address
        if (domain.match(/^[a-z0-9.-]+\.[a-z]{2,}$/)) return true; // Domain
        return false;
      });

    const settings = {
      ollamaUrl: url,
      ollamaModel: model,
      translationDelay: parseInt(elements.translationDelay.value) || defaults.translationDelay,
      maxRetries: parseInt(elements.maxRetries.value) || defaults.maxRetries,
      useAggressiveBypass: elements.useAggressiveBypass.checked,
      bypassMode: elements.bypassMode.value,
      customTranslateInstruction: elements.customTranslateInstruction.value.trim() || defaults.customTranslateInstruction,
      excludedDomains: excludedDomains
    };

    chrome.storage.sync.set(settings, function() {
      if (chrome.runtime.lastError) {
        console.error('Error saving settings:', chrome.runtime.lastError);
        showStatus('Error saving settings', 'error');
        return;
      }
      
      showStatus('Settings saved successfully!', 'success');
      console.log('Settings saved:', settings);
    });
  }

  // Reset to defaults
  function resetSettings() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      chrome.storage.sync.clear(function() {
        if (chrome.runtime.lastError) {
          console.error('Error clearing settings:', chrome.runtime.lastError);
          showStatus('Error resetting settings', 'error');
          return;
        }
        
        loadSettings();
        showStatus('Settings reset to defaults!', 'success');
      });
    }
  }

  // Test connection with better error handling
  async function testConnection() {
    const url = elements.ollamaUrl.value.trim();
    const model = elements.ollamaModel.value.trim();
    
    if (!url || !model) {
      showStatus('Please enter both URL and model name.', 'error');
      return;
    }

    elements.testBtn.disabled = true;
    elements.testBtn.textContent = '🔄 Testing...';
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          prompt: 'Test connection. Respond with "OK".',
          stream: false,
          options: {
            max_tokens: 10
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.response) {
          showStatus('✅ Connection successful!', 'success');
        } else {
          showStatus('⚠️ Connected but unexpected response format.', 'error');
          console.log('Response data:', data);
        }
      } else {
        const errorText = await response.text();
        showStatus(`❌ Connection failed: ${response.status} ${response.statusText}`, 'error');
        console.error('Response error:', errorText);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        showStatus('❌ Connection timeout (10s)', 'error');
      } else {
        showStatus(`❌ Connection error: ${error.message}`, 'error');
      }
      console.error('Connection error:', error);
    } finally {
      elements.testBtn.disabled = false;
      elements.testBtn.textContent = '🧪 Test Connection';
    }
  }

  // Show status message
  function showStatus(message, type) {
    elements.status.textContent = message;
    elements.status.className = `status ${type}`;
    elements.status.style.display = 'block';
    
    setTimeout(() => {
      elements.status.style.display = 'none';
    }, 5000);
  }

  // Event listeners
  elements.saveBtn.addEventListener('click', saveSettings);
  elements.resetBtn.addEventListener('click', resetSettings);
  elements.testBtn.addEventListener('click', testConnection);

  // Auto-save on checkbox change
  elements.useAggressiveBypass.addEventListener('change', function() {
    console.log('Aggressive bypass changed to:', this.checked);
  });

  // Load settings on popup open
  loadSettings();
});