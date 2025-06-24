// OCR Settings Page
class OCRSettings {
  constructor() {
    this.ocrProviders = null;
    this.currentSettings = {};
    this.init();
  }

  async init() {
    // Load OCR providers (we'll need to include the providers file)
    await this.loadOCRProviders();
    await this.loadSettings();
    this.setupUI();
    this.setupEventListeners();
  }

  async loadOCRProviders() {
    // Since we can't directly import the content script, we'll recreate the provider info
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
  }

  async loadSettings() {
    const result = await chrome.storage.sync.get([
      'ocrProvider',
      'ocrLanguage',
      'ocrTryBothImages',
      'ocrDebugMode',
      'googleCloudApiKey'
    ]);
    
    this.currentSettings = {
      provider: result.ocrProvider || 'tesseract',
      language: result.ocrLanguage || 'eng',
      tryBothImages: result.ocrTryBothImages !== false,
      debugMode: result.ocrDebugMode || false,
      googleCloudApiKey: result.googleCloudApiKey || ''
    };
  }

  setupUI() {
    this.renderProviders();
    this.renderLanguageOptions();
    this.updateFormValues();
  }

  renderProviders() {
    const grid = document.getElementById('provider-grid');
    grid.innerHTML = '';

    Object.entries(this.availableProviders).forEach(([key, provider]) => {
      const isSelected = key === this.currentSettings.provider;
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
          <span class="status ${statusClass}">${statusText}</span>
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

  renderLanguageOptions() {
    const select = document.getElementById('default-language');
    const currentProvider = this.availableProviders[this.currentSettings.provider];
    const languages = currentProvider?.supportedLanguages || {};
    
    select.innerHTML = '';
    Object.entries(languages).forEach(([code, name]) => {
      const option = document.createElement('option');
      option.value = code;
      option.textContent = name;
      option.selected = code === this.currentSettings.language;
      select.appendChild(option);
    });
  }

  updateFormValues() {
    document.getElementById('try-both-images').checked = this.currentSettings.tryBothImages;
    document.getElementById('debug-mode').checked = this.currentSettings.debugMode;
    document.getElementById('google-api-key').value = this.currentSettings.googleCloudApiKey;
    
    // Show/hide provider-specific sections
    const googleSection = document.getElementById('google-cloud-section');
    const macosSection = document.getElementById('macos-section');
    
    googleSection.style.display = this.currentSettings.provider === 'google_cloud' ? 'block' : 'none';
    macosSection.style.display = ['macos_live_text', 'macos_vision'].includes(this.currentSettings.provider) ? 'block' : 'none';
  }

  setupEventListeners() {
    // Provider selection
    document.addEventListener('change', (e) => {
      if (e.target.name === 'ocr-provider') {
        this.currentSettings.provider = e.target.value;
        this.renderLanguageOptions();
        this.updateFormValues();
        this.updateProviderSelection();
      }
    });

    // Language selection
    document.getElementById('default-language').addEventListener('change', (e) => {
      this.currentSettings.language = e.target.value;
    });

    // Checkboxes
    document.getElementById('try-both-images').addEventListener('change', (e) => {
      this.currentSettings.tryBothImages = e.target.checked;
    });

    document.getElementById('debug-mode').addEventListener('change', (e) => {
      this.currentSettings.debugMode = e.target.checked;
    });

    // Google Cloud API key
    document.getElementById('google-api-key').addEventListener('input', (e) => {
      this.currentSettings.googleCloudApiKey = e.target.value;
    });

    document.getElementById('test-google-api').addEventListener('click', () => {
      this.testGoogleCloudAPI();
    });

    // Setup buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('setup-btn')) {
        const provider = e.target.dataset.provider;
        this.showSetupInstructions(provider);
      }
    });

    // Action buttons
    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveSettings();
    });

    document.getElementById('reset-settings').addEventListener('click', () => {
      this.resetSettings();
    });

    // macOS buttons
    document.getElementById('download-macos-host')?.addEventListener('click', () => {
      this.downloadMacOSHost();
    });

    document.getElementById('macos-setup-help')?.addEventListener('click', () => {
      this.showMacOSSetupHelp();
    });
  }

  updateProviderSelection() {
    document.querySelectorAll('.provider-card').forEach(card => {
      if (card.dataset.provider === this.currentSettings.provider) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
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
    const statusDiv = document.getElementById('status');
    
    try {
      await chrome.storage.sync.set({
        ocrProvider: this.currentSettings.provider,
        ocrLanguage: this.currentSettings.language,
        ocrTryBothImages: this.currentSettings.tryBothImages,
        ocrDebugMode: this.currentSettings.debugMode,
        googleCloudApiKey: this.currentSettings.googleCloudApiKey
      });
      
      statusDiv.innerHTML = '<span class="success">✅ Settings saved successfully!</span>';
      setTimeout(() => {
        statusDiv.innerHTML = '';
      }, 3000);
    } catch (error) {
      statusDiv.innerHTML = `<span class="error">❌ Failed to save settings: ${error.message}</span>`;
    }
  }

  async resetSettings() {
    if (confirm('Reset all OCR settings to defaults?')) {
      this.currentSettings = {
        provider: 'tesseract',
        language: 'eng',
        tryBothImages: true,
        debugMode: false,
        googleCloudApiKey: ''
      };
      
      this.renderProviders();
      this.renderLanguageOptions();
      this.updateFormValues();
      
      await this.saveSettings();
    }
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  new OCRSettings();
});