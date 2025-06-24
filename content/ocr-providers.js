// OCR Providers - Unified interface for different OCR engines - FIXED VERSION
class OCRProviders {
  constructor() {
    this.providers = {};
    this.currentProvider = 'tesseract'; // Default
    
    // Initialize providers safely
    this.initializeProviderClasses();
  }

  initializeProviderClasses() {
    try {
      this.providers.tesseract = new TesseractProvider();
    } catch (error) {
      console.warn('Failed to initialize Tesseract provider:', error);
      this.providers.tesseract = new StubProvider('Tesseract.js');
    }

    try {
      this.providers.macos_live_text = new MacOSLiveTextProvider();
    } catch (error) {
      console.warn('Failed to initialize macOS Live Text provider:', error);
      this.providers.macos_live_text = new StubProvider('macOS Live Text');
    }

    try {
      this.providers.macos_vision = new MacOSVisionProvider();
    } catch (error) {
      console.warn('Failed to initialize macOS Vision provider:', error);
      this.providers.macos_vision = new StubProvider('macOS Vision Framework');
    }

    try {
      this.providers.google_cloud = new GoogleCloudVisionProvider();
    } catch (error) {
      console.warn('Failed to initialize Google Cloud provider:', error);
      this.providers.google_cloud = new StubProvider('Google Cloud Vision');
    }
  }

  async initializeProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Unknown OCR provider: ${providerName}`);
    }
    
    this.currentProvider = providerName;
    
    try {
      return await this.providers[providerName].initialize();
    } catch (error) {
      console.warn(`Failed to initialize ${providerName}:`, error.message);
      return false;
    }
  }

  async performOCR(canvas, options = {}) {
    const provider = this.providers[this.currentProvider];
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not available`);
    }
    
    // Check if provider is initialized, if not try to initialize it
    if (!provider.isInitialized) {
      console.log(`📷 Provider ${this.currentProvider} not initialized, attempting to initialize...`);
      try {
        await provider.initialize();
      } catch (error) {
        throw new Error(`Failed to initialize ${this.currentProvider}: ${error.message}`);
      }
    }
    
    return await provider.recognize(canvas, options);
  }

  getAvailableProviders() {
    const available = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      available[name] = {
        name: provider.getName(),
        description: provider.getDescription(),
        isAvailable: provider.isAvailable(),
        requiresSetup: provider.requiresSetup(),
        supportedLanguages: provider.getSupportedLanguages()
      };
    }
    return available;
  }

  getCurrentProvider() {
    return this.currentProvider;
  }

  async cleanup() {
    for (const provider of Object.values(this.providers)) {
      if (provider.cleanup) {
        try {
          await provider.cleanup();
        } catch (error) {
          console.warn('Error cleaning up provider:', error);
        }
      }
    }
  }
}

// Base OCR Provider class
class BaseOCRProvider {
  constructor() {
    this.isInitialized = false;
  }

  getName() {
    throw new Error('getName must be implemented');
  }

  getDescription() {
    throw new Error('getDescription must be implemented');
  }

  isAvailable() {
    throw new Error('isAvailable must be implemented');
  }

  requiresSetup() {
    return false;
  }

  getSupportedLanguages() {
    return {};
  }

  async initialize() {
    throw new Error('initialize must be implemented');
  }

  async recognize(canvas, options = {}) {
    throw new Error('recognize must be implemented');
  }

  async cleanup() {
    this.isInitialized = false;
  }
}

// Stub Provider for when real providers fail to initialize
class StubProvider extends BaseOCRProvider {
  constructor(name) {
    super();
    this.providerName = name;
  }

  getName() {
    return this.providerName;
  }

  getDescription() {
    return `${this.providerName} (not available)`;
  }

  isAvailable() {
    return false;
  }

  getSupportedLanguages() {
    return {};
  }

  async initialize() {
    return false;
  }

  async recognize(canvas, options = {}) {
    throw new Error(`${this.providerName} is not available`);
  }
}

// Tesseract Provider - FIXED VERSION
class TesseractProvider extends BaseOCRProvider {
  constructor() {
    super();
    this.worker = null;
    this.recognitionCount = 0;
    this.maxRecognitionsBeforeReset = 3;
    this.availableLanguages = {
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
    };
  }

  getName() {
    return 'Tesseract.js';
  }

  getDescription() {
    return 'Open-source OCR engine running in browser. Works offline, supports many languages.';
  }

  isAvailable() {
    return typeof window.Tesseract !== 'undefined';
  }

  getSupportedLanguages() {
    return this.availableLanguages;
  }

  async initialize(language = 'eng') {
    // Validate language - Tesseract doesn't support 'auto'
    if (language === 'auto') {
      language = 'eng'; // Default to English if auto is requested
      console.log('📷 Tesseract: Auto language not supported, using English');
    }
    
    // Check if language is supported
    if (!this.availableLanguages[language]) {
      console.warn('📷 Tesseract: Language not supported:', language, 'using English');
      language = 'eng';
    }
    
    if (this.isInitialized && this.currentLanguage === language) {
      return true;
    }
  
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        console.warn('Error terminating previous worker:', error);
      }
      this.worker = null;
    }
  
    console.log('📷 Tesseract: Initializing with language:', language);
  
    try {
      this.worker = await Tesseract.createWorker({
        logger: m => {
          if (window.ollamaTranslator?.translationEngine?.showLogs) {
            console.log('Tesseract:', m);
          }
        }
      });
  
      await this.worker.loadLanguage(language);
      await this.worker.initialize(language);
      
      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: '1'
      });
  
      this.currentLanguage = language;
      this.isInitialized = true;
      this.recognitionCount = 0;
      return true;
    } catch (error) {
      console.error('Failed to initialize Tesseract:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async recognize(canvas, options = {}) {
    if (!this.isInitialized || !this.worker) {
      throw new Error('Tesseract not initialized');
    }

    // Reset worker if used too many times
    if (this.recognitionCount >= this.maxRecognitionsBeforeReset) {
      await this.initialize(this.currentLanguage);
    }

    try {
      // Set PSM mode based on orientation
      let psmMode = Tesseract.PSM.AUTO;
      if (options.orientation === 'vertical') {
        psmMode = Tesseract.PSM.SINGLE_BLOCK_VERT_TEXT;
      } else if (options.orientation === 'horizontal') {
        psmMode = Tesseract.PSM.SINGLE_BLOCK;
      }

      await this.worker.setParameters({
        tessedit_pageseg_mode: psmMode
      });

      const result = await this.worker.recognize(canvas);
      this.recognitionCount++;

      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
        words: result.data.words
      };
    } catch (error) {
      console.error('Tesseract recognition failed:', error);
      throw new Error('Tesseract recognition failed: ' + error.message);
    }
  }

  async cleanup() {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        console.warn('Error terminating Tesseract worker:', error);
      }
      this.worker = null;
    }
    await super.cleanup();
  }
}

// macOS Live Text Provider - FIXED VERSION
class MacOSLiveTextProvider extends BaseOCRProvider {
  constructor() {
    super();
    this.hostAvailable = false;
  }

  getName() {
    return 'macOS Live Text';
  }

  getDescription() {
    return 'Native macOS Live Text API. Fast and accurate, requires macOS 12+ and native app integration.';
  }

  isAvailable() {
    return navigator.platform.includes('Mac') && 
           typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.sendMessage;
  }

  requiresSetup() {
    return true;
  }

  getSupportedLanguages() {
    return {
      'auto': 'Auto-detect',
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'ja-JP': 'Japanese',
      'zh-Hans': 'Chinese Simplified',
      'zh-Hant': 'Chinese Traditional',
      'ko-KR': 'Korean',
      'es-ES': 'Spanish',
      'fr-FR': 'French',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'pt-BR': 'Portuguese (Brazil)',
      'ru-RU': 'Russian',
      'ar-SA': 'Arabic',
      'hi-IN': 'Hindi',
      'th-TH': 'Thai',
      'vi-VN': 'Vietnamese'
    };
  }

  async initialize() {
    try {
      console.log('📷 Live Text: Checking availability...');
      const response = await this.sendNativeMessage({ action: 'check_availability' });
      
      if (response && response.available) {
        this.hostAvailable = true;
        this.isInitialized = true;
        console.log('📷 Live Text: Successfully initialized');
        return true;
      } else {
        console.warn('📷 Live Text: Host not available:', response?.error || 'Unknown error');
        this.hostAvailable = false;
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.warn('📷 Live Text: Initialization failed:', error.message);
      this.hostAvailable = false;
      this.isInitialized = false;
      return false;
    }
  }

  async recognize(canvas, options = {}) {
    // Try to initialize if not already done
    if (!this.isInitialized) {
      console.log('📷 Live Text: Not initialized, attempting to initialize...');
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error('macOS Live Text not available - native messaging host not responding');
      }
    }

    // Convert canvas to base64 with size optimization
    let imageData;
    try {
      // Optimize image size for native messaging
      const maxSize = 1024; // Max dimension
      let targetCanvas = canvas;
      
      if (canvas.width > maxSize || canvas.height > maxSize) {
        const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
        targetCanvas = document.createElement('canvas');
        targetCanvas.width = canvas.width * scale;
        targetCanvas.height = canvas.height * scale;
        
        const ctx = targetCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);
      }
      
      imageData = targetCanvas.toDataURL('image/png', 0.9);
      console.log('📷 Live Text: Optimized image data size:', imageData.length, 'characters');
      
    } catch (error) {
      console.error('📷 Live Text: Image processing error:', error);
      throw new Error('Failed to process image for Live Text: ' + error.message);
    }
    
    const message = {
      action: 'live_text_ocr',
      image: imageData,
      language: options.language || 'auto',
      orientation: options.orientation || 'auto'
    };
    
    console.log('📷 Live Text: Sending OCR request...');
    
    try {
      const response = await this.sendNativeMessage(message);
      console.log('📷 Live Text: Raw response received:', response);

      if (!response) {
        throw new Error('No response from native messaging host');
      }

      if (response.error) {
        console.error('📷 Live Text: Native host error:', response.error);
        throw new Error('Live Text error: ' + response.error);
      }

      // Handle different response formats
      let text = '';
      let confidence = 0;
      let words = [];

      if (typeof response === 'string') {
        text = response.trim();
        confidence = text.length > 0 ? 95 : 0;
      } else if (response.text !== undefined) {
        text = response.text || '';
        confidence = response.confidence || (text.length > 0 ? 95 : 0);
        words = response.words || [];
      } else if (response.result) {
        text = response.result.text || response.result || '';
        confidence = response.result.confidence || (text.length > 0 ? 95 : 0);
        words = response.result.words || [];
      } else {
        console.warn('📷 Live Text: Unexpected response format:', response);
        text = '';
        confidence = 0;
      }

      console.log('📷 Live Text: Processed result:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        confidence: confidence,
        wordCount: words.length
      });

      return {
        text: text,
        confidence: confidence,
        words: words
      };
    } catch (error) {
      console.error('📷 Live Text recognition error:', error);
      // Reset initialization status on error
      this.isInitialized = false;
      this.hostAvailable = false;
      throw new Error('macOS Live Text recognition failed: ' + error.message);
    }
  }

  async sendNativeMessage(message) {
    return new Promise((resolve, reject) => {
      console.log('📷 Sending native message to Live Text host...');
      
      // Set a timeout for the native messaging
      const timeout = setTimeout(() => {
        console.error('📷 Native messaging timeout');
        reject(new Error('Native messaging timeout after 15 seconds'));
      }, 15000);
      
      chrome.runtime.sendMessage({
        action: 'sendNativeMessage',
        hostName: 'com.ollama.translator.ocr',
        nativeMessage: message
      }, (response) => {
        clearTimeout(timeout);
        
        console.log('📷 Background response received:', response);
        
        if (chrome.runtime.lastError) {
          console.error('📷 Chrome runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response) {
          console.error('📷 No response from background script');
          reject(new Error('No response from background script'));
          return;
        }
        
        if (response.error) {
          console.error('📷 Background script error:', response.error);
          reject(new Error(response.error));
          return;
        }
        
        if (response.response === undefined) {
          console.error('📷 No response data from native host');
          reject(new Error('No response data from native host'));
          return;
        }
        
        resolve(response.response);
      });
    });
  }
}

// macOS Vision Framework Provider - FIXED VERSION
class MacOSVisionProvider extends BaseOCRProvider {
  constructor() {
    super();
    this.hostAvailable = false;
  }

  getName() {
    return 'macOS Vision Framework';
  }

  getDescription() {
    return 'Apple Vision Framework for text recognition. Highly accurate, requires macOS 10.15+ and native app.';
  }

  isAvailable() {
    return navigator.platform.includes('Mac') && 
           typeof chrome !== 'undefined' && 
           chrome.runtime && 
           chrome.runtime.sendMessage;
  }

  requiresSetup() {
    return true;
  }

  getSupportedLanguages() {
    return {
      'auto': 'Auto-detect',
      'en-US': 'English (US)',
      'en-GB': 'English (UK)', 
      'ja-JP': 'Japanese',
      'zh-Hans': 'Chinese Simplified',
      'zh-Hant': 'Chinese Traditional',
      'ko-KR': 'Korean',
      'es-ES': 'Spanish',
      'fr-FR': 'French',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'pt-BR': 'Portuguese (Brazil)',
      'ru-RU': 'Russian',
      'ar-SA': 'Arabic',
      'hi-IN': 'Hindi',
      'th-TH': 'Thai',
      'vi-VN': 'Vietnamese'
    };
  }

  async initialize() {
    try {
      console.log('📷 Vision: Checking availability...');
      const response = await this.sendNativeMessage({ action: 'check_vision_availability' });
      
      if (response && response.available) {
        this.hostAvailable = true;
        this.isInitialized = true;
        console.log('📷 Vision: Successfully initialized');
        return true;
      } else {
        console.warn('📷 Vision: Host not available:', response?.error || 'Unknown error');
        this.hostAvailable = false;
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
      console.warn('📷 Vision: Initialization failed:', error.message);
      this.hostAvailable = false;
      this.isInitialized = false;
      return false;
    }
  }

  async recognize(canvas, options = {}) {
    // Try to initialize if not already done
    if (!this.isInitialized) {
      console.log('📷 Vision: Not initialized, attempting to initialize...');
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error('macOS Vision Framework not available - native messaging host not responding');
      }
    }

    const imageData = canvas.toDataURL('image/png');
    console.log('📷 Vision: Image data size:', imageData.length, 'characters');
    
    const message = {
      action: 'vision_ocr',
      image: imageData,
      language: options.language || 'auto',
      recognitionLevel: options.recognitionLevel || 'accurate'
    };
    
    console.log('📷 Vision: Sending message with action:', message.action);
    
    try {
      const response = await this.sendNativeMessage(message);
      console.log('📷 Vision: Raw response:', response);

      if (!response) {
        throw new Error('No response from native messaging host');
      }

      if (response.error) {
        throw new Error(response.error);
      }

      return {
        text: response.text || '',
        confidence: response.confidence || 0,
        words: response.words || [],
        boundingBoxes: response.boundingBoxes || []
      };
    } catch (error) {
      console.error('📷 Vision recognition error:', error);
      // Reset initialization status on error
      this.isInitialized = false;
      this.hostAvailable = false;
      throw new Error('macOS Vision Framework recognition failed: ' + error.message);
    }
  }

  async sendNativeMessage(message) {
    return new Promise((resolve, reject) => {
      console.log('📷 Sending native message to Vision host...');
      
      const timeout = setTimeout(() => {
        console.error('📷 Vision native messaging timeout');
        reject(new Error('Native messaging timeout after 15 seconds'));
      }, 15000);
      
      chrome.runtime.sendMessage({
        action: 'sendNativeMessage',
        hostName: 'com.ollama.translator.vision',
        nativeMessage: message
      }, (response) => {
        clearTimeout(timeout);
        
        console.log('📷 Vision background response received:', response);
        
        if (chrome.runtime.lastError) {
          console.error('📷 Chrome runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        
        if (!response) {
          console.error('📷 No response from background script');
          reject(new Error('No response from background script'));
          return;
        }
        
        if (response.error) {
          console.error('📷 Background script error:', response.error);
          reject(new Error(response.error));
          return;
        }
        
        if (response.response === undefined) {
          console.error('📷 No response data from native host');
          reject(new Error('No response data from native host'));
          return;
        }
        
        resolve(response.response);
      });
    });
  }
}

// Google Cloud Vision Provider - FIXED VERSION
class GoogleCloudVisionProvider extends BaseOCRProvider {
  constructor() {
    super();
    this.apiKey = null;
  }

  getName() {
    return 'Google Cloud Vision';
  }

  getDescription() {
    return 'Google Cloud Vision API. Highly accurate, requires API key and internet connection.';
  }

  isAvailable() {
    return true; // Available everywhere with internet
  }

  requiresSetup() {
    return true;
  }

  getSupportedLanguages() {
    return {
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
    };
  }

  async initialize(apiKey) {
    if (!apiKey) {
      // Try to get API key from storage
      try {
        const result = await chrome.storage.sync.get(['googleCloudApiKey']);
        apiKey = result.googleCloudApiKey;
      } catch (error) {
        console.warn('Failed to load Google Cloud API key from storage:', error);
      }
    }

    if (!apiKey) {
      console.warn('📷 Google Cloud Vision: No API key provided');
      this.isInitialized = false;
      return false;
    }

    this.apiKey = apiKey;
    
    // Test API key
    try {
      const testResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
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

      if (!testResponse.ok) {
        const error = await testResponse.json();
        throw new Error(error.error?.message || 'API key validation failed');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('📷 Google Cloud Vision: API key validation failed:', error.message);
      this.isInitialized = false;
      return false;
    }
  }

  async recognize(canvas, options = {}) {
    if (!this.isInitialized || !this.apiKey) {
      // Try to initialize
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error('Google Cloud Vision not available - API key required');
      }
    }

    // Convert canvas to base64
    const imageData = canvas.toDataURL('image/png').split(',')[1];

    const requestBody = {
      requests: [{
        image: { content: imageData },
        features: [{ type: 'TEXT_DETECTION', maxResults: 50 }],
        imageContext: {}
      }]
    };

    // Add language hints if specified
    if (options.language && options.language !== 'auto') {
      requestBody.requests[0].imageContext.languageHints = [options.language];
    }

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API request failed');
      }

      const result = await response.json();
      const annotations = result.responses[0]?.textAnnotations || [];

      if (annotations.length === 0) {
        return { text: '', confidence: 0, words: [] };
      }

      // First annotation contains full text
      const fullText = annotations[0].description || '';
      
      // Remaining annotations are individual words
      const words = annotations.slice(1).map(annotation => ({
        text: annotation.description,
        confidence: 100, // Google doesn't provide word-level confidence
        bbox: {
          x0: Math.min(...annotation.boundingPoly.vertices.map(v => v.x || 0)),
          y0: Math.min(...annotation.boundingPoly.vertices.map(v => v.y || 0)),
          x1: Math.max(...annotation.boundingPoly.vertices.map(v => v.x || 0)),
          y1: Math.max(...annotation.boundingPoly.vertices.map(v => v.y || 0))
        }
      }));

      return {
        text: fullText,
        confidence: 95, // Google Vision is generally very accurate
        words: words
      };
    } catch (error) {
      throw new Error('Google Cloud Vision recognition failed: ' + error.message);
    }
  }
}

window.OCRProviders = OCRProviders;