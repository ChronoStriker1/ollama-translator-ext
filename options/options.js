// Enhanced Options Page with OCR Settings
class OptionsManager {
  constructor() {
    this.availableProviders = {
      tesseract: {
        name: 'Tesseract.js',
        description: 'Open-source OCR engine running in browser. Works offline, supports many languages.',
        isAvailable: true,
        requiresSetup: false,
        supportedLanguages: {
          'eng': 'English',
          'jpn': 'Japanese',
          'chi_sim': 'Chinese Simplified',
          'chi_tra': 'Chinese Traditional',
          'kor': 'Korean',
          'rus': 'Russian',
          'ara': 'Arabic',
          'tha': 'Thai',
          'vie': 'Vietnamese',
          'deu': 'German',
          'fra': 'French',
          'spa': 'Spanish',
          'ita': 'Italian',
          'por': 'Portuguese'
        }
      },
      macos_live_text: {
        name: 'macOS Live Text',
        description: 'Native macOS Live Text API. Fast and accurate, requires macOS 12+ and native app integration.',
        isAvailable: navigator.platform.includes('Mac'),
        requiresSetup: true,
        supportedLanguages: {
          'auto': 'Auto-detect',
          'en': 'English',
          'ja': 'Japanese',
          'zh': 'Chinese',
          'ko': 'Korean',
          'es': 'Spanish',
          'fr': 'French',
          'de': 'German',
          'it': 'Italian',
          'pt': 'Portuguese',
          'ru': 'Russian',
          'ar': 'Arabic'
        }
      },
      macos_vision: {
        name: 'macOS Vision Framework',
        description: 'Apple Vision Framework for text recognition. Highly accurate, requires macOS 10.15+ and native app.',
        isAvailable: navigator.platform.includes('Mac'),
        requiresSetup: true,
        supportedLanguages: {
          'auto': 'Auto-detect',
          'en-US': 'English (US)',
          'ja-JP': 'Japanese',
          'zh-CN': 'Chinese Simplified',
          'zh-TW': 'Chinese Traditional',
          'ko-KR': 'Korean',
          'es-ES': 'Spanish',
          'fr-FR': 'French',
          'de-DE': 'German',
          'it-IT': 'Italian',
          'pt-BR': 'Portuguese',
          'ru-RU': 'Russian',
          'ar-SA': 'Arabic'
        }
      },
      google_cloud: {
        name: 'Google Cloud Vision',
        description: 'Google Cloud Vision API. Highly accurate, requires API key and internet connection.',
        isAvailable: true,
        requiresSetup: true,
        supportedLanguages: {
          'auto': 'Auto-detect',
          'en': 'English',
          'ja': 'Japanese',
          'zh': 'Chinese',
          'zh-TW': 'Chinese Traditional',
          'ko': 'Korean',
          'es': 'Spanish',
          'fr': 'French',
          'de': 'German',
          'it': 'Italian',
          'pt': 'Portuguese',
          'ru': 'Russian',
          'ar': 'Arabic',
          'hi': 'Hindi',
          'th': 'Thai',
          'vi': 'Vietnamese'
        }
      }
    };
    
    this.currentSettings = {};
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupUI();
    this.setupEventListeners();
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get([
      // Original settings
      'ollamaUrl', 'ollamaModel', 'translationDelay', 'maxRetries',
      'useAggressiveBypass', 'bypassMode', 'customTranslateInstruction',
      'excludedDomains',
      // OCR settings
      'ocrProvider', 'ocrLanguage', 'ocrTryBothImages', 'ocrDebugMode',
      'googleCloudApiKey'
    ]);
    
    this.currentSettings = {
      // Original settings
      ollamaUrl: result.ollamaUrl || 'http://localhost:11434/api/generate',
      ollamaModel: result.ollamaModel || 'llama3.2:latest',
      translationDelay: result.translationDelay || 300,
      maxRetries: result.maxRetries || 3,
      useAggressiveBypass: result.useAggressiveBypass !== undefined ? result.useAggressiveBypass : true,
      bypassMode: result.bypassMode || 'translation',
      customTranslateInstruction: result.customTranslateInstruction || '',
      excludedDomains: result.excludedDomains || [],
      // OCR settings
      ocrProvider: result.ocrProvider || 'tesseract',
      ocrLanguage: result.ocrLanguage || 'eng',
      ocrTryBothImages: result.ocrTryBothImages !== false,
      ocrDebugMode: result.ocrDebugMode || false,
      googleCloudApiKey: result.googleCloudApiKey || ''
    };
  }

  setupUI() {
    // Load original settings
    document.getElementById('ollamaUrl').value = this.currentSettings.ollamaUrl;
    document.getElementById('ollamaModel').value = this.currentSettings.ollamaModel;
    document.getElementById('translationDelay').value = this.currentSettings.translationDelay;
    document.getElementById('maxRetries').value = this.currentSettings.maxRetries;
    document.getElementById('useAggressiveBypass').checked = this.currentSettings.useAggressiveBypass;
    document.getElementById('bypassMode').value = this.currentSettings.bypassMode;
    document.getElementById('customTranslateInstruction').value = this.currentSettings.customTranslateInstruction;
    document.getElementById('excludedDomains').value = Array.isArray(this.currentSettings.excludedDomains) 
      ? this.currentSettings.excludedDomains.join('\n') 
      : '';

    // Setup OCR UI
    this.renderOCRProviders();
    this.renderOCRLanguageOptions();
    this.updateOCRFormValues();
  }

  renderOCRProviders() {
    const grid = document.getElementById('provider-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    Object.entries(this.availableProviders).forEach(([key, provider]) => {
      const isSelected = key === this.currentSettings.ocrProvider;
      const isDisabled = !provider.isAvailable;
      
      const providerDiv = document.createElement('div');
      providerDiv.className = `provider-card ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`;
      providerDiv.dataset.provider = key;
      
      const statusClass = provider.isAvailable ? 
        (provider.requiresSetup ? 'setup-required' : 'available') : 
        'unavailable';
      const statusText = provider.isAvailable ? 
        (provider.requiresSetup ? 'Setup Required' : 'Available') : 
        'Unavailable';
      
      providerDiv.innerHTML = `
        <div class="provider-header">
          <input type="radio" name="ocr-provider" value="${key}" ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
          <h3>${provider.name}</h3>
          <span class="provider-status ${statusClass}">${statusText}</span>
        </div>
        <p class="provider-description">${provider.description}</p>
        ${provider.requiresSetup && provider.isAvailable ? 
          `<button class="setup-btn" data-provider="${key}">Configure</button>` : 
          ''
        }
      `;
      
      grid.appendChild(providerDiv);
    });
  }

  renderOCRLanguageOptions() {
    const select = document.getElementById('default-ocr-language');
    if (!select) return;
    
    const currentProvider = this.availableProviders[this.currentSettings.ocrProvider];
    const languages = currentProvider?.supportedLanguages || {};
    
    select.innerHTML = '';
    Object.entries(languages).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      option.selected = code === this.currentSettings.ocrLanguage;
      select.appendChild(option);
    });
  }

  updateOCRFormValues() {
    const tryBothCheckbox = document.getElementById('try-both-images');
    const debugCheckbox = document.getElementById('ocr-debug-mode');
    const googleApiKey = document.getElementById('google-api-key');
    
    if (tryBothCheckbox) tryBothCheckbox.checked = this.currentSettings.ocrTryBothImages;
    if (debugCheckbox) debugCheckbox.checked = this.currentSettings.ocrDebugMode;
    if (googleApiKey) googleApiKey.value = this.currentSettings.googleCloudApiKey;
    
    // Show/hide provider-specific sections
    const googleSection = document.getElementById('google-cloud-section');
    const macosSection = document.getElementById('macos-section');
    
    if (googleSection) {
      googleSection.style.display = this.currentSettings.ocrProvider === 'google_cloud' ? 'block' : 'none';
    }
    if (macosSection) {
      macosSection.style.display = ['macos_live_text', 'macos_vision'].includes(this.currentSettings.ocrProvider) ? 'block' : 'none';
    }
  }

  setupEventListeners() {
    // Original event listeners
    document.getElementById('testBtn')?.addEventListener('click', () => this.testConnection());
    document.getElementById('saveBtn')?.addEventListener('click', () => this.saveSettings());
    document.getElementById('resetBtn')?.addEventListener('click', () => this.resetSettings());

    // OCR Provider selection
    document.addEventListener('change', (e) => {
      if (e.target.name === 'ocr-provider') {
        this.currentSettings.ocrProvider = e.target.value;
        this.renderOCRLanguageOptions();
        this.updateOCRFormValues();
        this.updateProviderSelection();
      }
    });

    // OCR Language selection
    document.getElementById('default-ocr-language')?.addEventListener('change', (e) => {
      this.currentSettings.ocrLanguage = e.target.value;
    });

    // OCR Checkboxes
    document.getElementById('try-both-images')?.addEventListener('change', (e) => {
      this.currentSettings.ocrTryBothImages = e.target.checked;
    });

    document.getElementById('ocr-debug-mode')?.addEventListener('change', (e) => {
      this.currentSettings.ocrDebugMode = e.target.checked;
    });

    // Google Cloud API key
    document.getElementById('google-api-key')?.addEventListener('input', (e) => {
      this.currentSettings.googleCloudApiKey = e.target.value;
    });

    document.getElementById('test-google-api')?.addEventListener('click', () => {
      this.testGoogleCloudAPI();
    });

    // Setup buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('setup-btn')) {
        const provider = e.target.dataset.provider;
        this.showSetupInstructions(provider);
      }
    });

    // macOS buttons
    document.getElementById('download-macos-host')?.addEventListener('click', () => {
      this.downloadMacOSHost();
    });

    document.getElementById('macos-setup-help')?.addEventListener('click', () => {
      this.showMacOSSetupHelp();
    });

    // Provider card clicks
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.provider-card');
      if (card && !card.classList.contains('disabled') && !e.target.classList.contains('setup-btn')) {
        const radio = card.querySelector('input[type="radio"]');
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change'));
        }
      }
    });
  }

  updateProviderSelection() {
    document.querySelectorAll('.provider-card').forEach(card => {
      if (card.dataset.provider === this.currentSettings.ocrProvider) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }

  async testConnection() {
    const button = document.getElementById('testBtn');
    const status = document.getElementById('status');
    
    button.disabled = true;
    button.textContent = 'Testing...';
    
    try {
      const ollamaUrl = document.getElementById('ollamaUrl').value;
      const model = document.getElementById('ollamaModel').value;
      
      const response = await fetch(ollamaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: model,
          prompt: 'Hello',
          stream: false
        })
      });
      
      if (response.ok) {
        this.showStatus('✅ Connection successful!', 'success');
      } else {
        this.showStatus(`❌ Connection failed: ${response.status} ${response.statusText}`, 'error');
      }
    } catch (error) {
      this.showStatus(`❌ Connection error: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
      button.textContent = '🧪 Test Connection';
    }
  }

  async testGoogleCloudAPI() {
    const apiKey = this.currentSettings.googleCloudApiKey;
    const statusDiv = document.getElementById('google-api-status');
    const button = document.getElementById('test-google-api');
    
    if (!apiKey) {
      statusDiv.innerHTML = '<span class="error">Please enter an API key</span>';
      return;
    }
    
    button.disabled = true;
    button.textContent = 'Testing...';
    statusDiv.innerHTML = '<span class="info">Testing API key...</span>';
    
    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
            }]
          })
        }
      );

      if (response.ok) {
        statusDiv.innerHTML = '<span class="success">✅ API key is valid!</span>';
      } else {
        const error = await response.json();
        statusDiv.innerHTML = `<span class="error">❌ Error: ${error.error?.message || 'API key validation failed'}</span>`;
      }
    } catch (error) {
      statusDiv.innerHTML = `<span class="error">❌ Network error: ${error.message}</span>`;
    } finally {
      button.disabled = false;
      button.textContent = 'Test API Key';
    }
  }

  showSetupInstructions(provider) {
    if (provider === 'google_cloud') {
      window.open('https://console.cloud.google.com/', '_blank');
    } else if (provider.startsWith('macos_')) {
      this.showMacOSSetupHelp();
    }
  }

  showMacOSSetupHelp() {
    alert(`macOS OCR Setup Instructions:

1. Download the native messaging host application
2. Install it in /Applications/
3. Run the installer to set up native messaging
4. Grant necessary permissions in System Preferences
5. Restart your browser

Note: The native messaging host is not included with this extension and requires separate development.`);
  }

  downloadMacOSHost() {
    alert('The macOS native messaging host is not yet available. This feature requires additional development of a native macOS application.');
  }

  async saveSettings() {
    try {
      // Collect all form values
      const settings = {
        // Original settings
        ollamaUrl: document.getElementById('ollamaUrl').value,
        ollamaModel: document.getElementById('ollamaModel').value,
        translationDelay: parseInt(document.getElementById('translationDelay').value),
        maxRetries: parseInt(document.getElementById('maxRetries').value),
        useAggressiveBypass: document.getElementById('useAggressiveBypass').checked,
        bypassMode: document.getElementById('bypassMode').value,
        customTranslateInstruction: document.getElementById('customTranslateInstruction').value,
        excludedDomains: document.getElementById('excludedDomains').value
          .split('\n')
          .map(d => d.trim())
          .filter(d => d.length > 0),
        // OCR settings
        ocrProvider: this.currentSettings.ocrProvider,
        ocrLanguage: this.currentSettings.ocrLanguage,
        ocrTryBothImages: this.currentSettings.ocrTryBothImages,
        ocrDebugMode: this.currentSettings.ocrDebugMode,
        googleCloudApiKey: this.currentSettings.googleCloudApiKey
      };
      
      await chrome.storage.sync.set(settings);
      this.showStatus('✅ Settings saved successfully!', 'success');
    } catch (error) {
      this.showStatus(`❌ Failed to save settings: ${error.message}`, 'error');
    }
  }

  async resetSettings() {
    if (confirm('Reset all settings to defaults? This cannot be undone.')) {
      try {
        await chrome.storage.sync.clear();
        this.showStatus('✅ Settings reset to defaults!', 'success');
        setTimeout(() => location.reload(), 1000);
      } catch (error) {
        this.showStatus(`❌ Failed to reset settings: ${error.message}`, 'error');
      }
    }
  }

  showStatus(message, type) {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    setTimeout(() => {
      status.style.display = 'none';
    }, 5000);
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new OptionsManager();
});