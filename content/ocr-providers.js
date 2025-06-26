<<<<<<< HEAD
// OCR Providers - Unified interface for different OCR engines - FIXED VERSION
class OCRProviders {
  constructor() {
    this.providers = {};
    this.currentProvider = 'tesseract'; // Default
    
    // Initialize providers safely
    this.initializeProviderClasses();
  }

=======
// OCR Providers - Unified interface with language code conversion - VISION OPTION REMOVED
class OCRProviders {
  constructor() {
    this.providers = {};
    this.currentProvider = 'tesseract';

    // Language code conversion maps
    this.languageConversions = {
      // Tesseract to macOS mapping
      tesseractToMacOS: {
        eng: 'en-US',
        jpn: 'ja-JP',
        chi_sim: 'zh-Hans',
        chi_tra: 'zh-Hant',
        kor: 'ko-KR',
        rus: 'ru-RU',
        ara: 'ar-SA',
        tha: 'th-TH',
        vie: 'vi-VN',
        deu: 'de-DE',
        fra: 'fr-FR',
        spa: 'es-ES',
        ita: 'it-IT',
        por: 'pt-BR',
        auto: 'auto',
      },
      // macOS to Tesseract mapping
      macOSToTesseract: {
        'en-US': 'eng',
        'en-GB': 'eng',
        'ja-JP': 'jpn',
        'zh-Hans': 'chi_sim',
        'zh-Hant': 'chi_tra',
        'ko-KR': 'kor',
        'ru-RU': 'rus',
        'ar-SA': 'ara',
        'th-TH': 'tha',
        'vi-VN': 'vie',
        'de-DE': 'deu',
        'fr-FR': 'fra',
        'es-ES': 'spa',
        'it-IT': 'ita',
        'pt-BR': 'por',
        auto: 'auto',
      },
    };

    this.initializeProviderClasses();
  }

  // Convert language codes between formats
  convertLanguageCode(code, fromFormat, toFormat) {
    if (fromFormat === toFormat || !code) return code;

    if (fromFormat === 'tesseract' && toFormat === 'macos') {
      return this.languageConversions.tesseractToMacOS[code] || code;
    }

    if (fromFormat === 'macos' && toFormat === 'tesseract') {
      return this.languageConversions.macOSToTesseract[code] || code;
    }

    return code;
  }

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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

<<<<<<< HEAD
    try {
      this.providers.macos_vision = new MacOSVisionProvider();
    } catch (error) {
      console.warn('Failed to initialize macOS Vision provider:', error);
      this.providers.macos_vision = new StubProvider('macOS Vision Framework');
    }
=======
    // **REMOVED**: The redundant macOS Vision provider is no longer initialized.
    // try {
    //   this.providers.macos_vision = new MacOSVisionProvider();
    // } catch (error) {
    //   console.warn('Failed to initialize macOS Vision provider:', error);
    //   this.providers.macos_vision = new StubProvider('macOS Vision Framework');
    // }
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)

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
<<<<<<< HEAD
    
    this.currentProvider = providerName;
    
=======

    this.currentProvider = providerName;

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
    
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
=======

    console.log(`📷 OCRProviders: Using provider ${this.currentProvider}`);

    // Create a mutable copy of options for conversion
    let finalOptions = { ...options };

    // Convert language code if the target provider is macOS
    if (options.language && this.currentProvider.startsWith('macos_')) {
      const originalLang = options.language;
      const convertedLang = this.convertLanguageCode(
        originalLang,
        'tesseract',
        'macos'
      );
      finalOptions.language = convertedLang;
      console.log(
        `📷 Converted language from "${originalLang}" to "${convertedLang}" for ${this.currentProvider}`
      );
    }

    if (!provider.isInitialized) {
      console.log(
        `📷 Provider ${this.currentProvider} not initialized, attempting to initialize...`
      );
      try {
        // Pass the final, converted language for initialization if needed
        await provider.initialize(finalOptions.language);
      } catch (error) {
        throw new Error(
          `Failed to initialize ${this.currentProvider}: ${error.message}`
        );
      }
    }

    // Pass the final, converted options to the provider's recognize method
    return await provider.recognize(canvas, finalOptions);
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
  }

  getAvailableProviders() {
    const available = {};
    for (const [name, provider] of Object.entries(this.providers)) {
      available[name] = {
        name: provider.getName(),
        description: provider.getDescription(),
        isAvailable: provider.isAvailable(),
        requiresSetup: provider.requiresSetup(),
<<<<<<< HEAD
        supportedLanguages: provider.getSupportedLanguages()
=======
        supportedLanguages: provider.getSupportedLanguages(),
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
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
=======
      eng: 'English',
      jpn: 'Japanese',
      chi_sim: 'Chinese Simplified',
      chi_tra: 'Chinese Traditional',
      kor: 'Korean',
      rus: 'Russian',
      ara: 'Arabic',
      tha: 'Thai',
      vie: 'Vietnamese',
      deu: 'German',
      fra: 'French',
      spa: 'Spanish',
      ita: 'Italian',
      por: 'Portuguese',
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
    
    // Check if language is supported
    if (!this.availableLanguages[language]) {
      console.warn('📷 Tesseract: Language not supported:', language, 'using English');
      language = 'eng';
    }
    
    if (this.isInitialized && this.currentLanguage === language) {
      return true;
    }
  
=======

    // Check if language is supported
    if (!this.availableLanguages[language]) {
      console.warn(
        '📷 Tesseract: Language not supported:',
        language,
        'using English'
      );
      language = 'eng';
    }

    if (this.isInitialized && this.currentLanguage === language) {
      return true;
    }

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch (error) {
        console.warn('Error terminating previous worker:', error);
      }
      this.worker = null;
    }
<<<<<<< HEAD
  
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
  
=======

    console.log('📷 Tesseract: Initializing with language:', language);

    try {
      this.worker = await Tesseract.createWorker({
        logger: (m) => {
          if (window.ollamaTranslator?.translationEngine?.showLogs) {
            console.log('Tesseract:', m);
          }
        },
      });

      await this.worker.loadLanguage(language);
      await this.worker.initialize(language);

      await this.worker.setParameters({
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        preserve_interword_spaces: '1',
      });

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
        tessedit_pageseg_mode: psmMode
=======
        tessedit_pageseg_mode: psmMode,
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      });

      const result = await this.worker.recognize(canvas);
      this.recognitionCount++;

      return {
        text: result.data.text.trim(),
        confidence: result.data.confidence,
<<<<<<< HEAD
        words: result.data.words
=======
        words: result.data.words,
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
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
=======
    return 'macOS Native OCR'; // **CHANGED**: More generic name
  }

  getDescription() {
    // **CHANGED**: Updated description to be more encompassing
    return 'Native macOS OCR using the Vision framework. Fast and accurate, requires macOS 12+ and native app.';
  }

  isAvailable() {
    return (
      navigator.platform.includes('Mac') &&
      typeof chrome !== 'undefined' &&
      chrome.runtime &&
      chrome.runtime.sendMessage
    );
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
  }

  requiresSetup() {
    return true;
  }

  getSupportedLanguages() {
    return {
<<<<<<< HEAD
      'auto': 'Auto-detect',
=======
      auto: 'Auto-detect',
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
      'vi-VN': 'Vietnamese'
=======
      'vi-VN': 'Vietnamese',
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    };
  }

  async initialize() {
    try {
<<<<<<< HEAD
      console.log('📷 Live Text: Checking availability...');
      const response = await this.sendNativeMessage({ action: 'check_availability' });
      
      if (response && response.available) {
        this.hostAvailable = true;
        this.isInitialized = true;
        console.log('📷 Live Text: Successfully initialized');
        return true;
      } else {
        console.warn('📷 Live Text: Host not available:', response?.error || 'Unknown error');
=======
      console.log('📷 macOS OCR: Checking availability...');
      const response = await this.sendNativeMessage({
        action: 'check_availability',
      });

      if (response && response.available) {
        this.hostAvailable = true;
        this.isInitialized = true;
        console.log('📷 macOS OCR: Successfully initialized');
        return true;
      } else {
        console.warn(
          '📷 macOS OCR: Host not available:',
          response?.error || 'Unknown error'
        );
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
        this.hostAvailable = false;
        this.isInitialized = false;
        return false;
      }
    } catch (error) {
<<<<<<< HEAD
      console.warn('📷 Live Text: Initialization failed:', error.message);
=======
      console.warn('📷 macOS OCR: Initialization failed:', error.message);
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      this.hostAvailable = false;
      this.isInitialized = false;
      return false;
    }
  }

  async recognize(canvas, options = {}) {
<<<<<<< HEAD
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
      
=======
    if (!this.isInitialized) {
      console.log('📷 macOS OCR: Not initialized, attempting to initialize...');
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error(
          'macOS Native OCR not available - native messaging host not responding'
        );
      }
    }

    let imageData;
    try {
      const maxSize = 1024;
      let targetCanvas = canvas;

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      if (canvas.width > maxSize || canvas.height > maxSize) {
        const scale = Math.min(maxSize / canvas.width, maxSize / canvas.height);
        targetCanvas = document.createElement('canvas');
        targetCanvas.width = canvas.width * scale;
        targetCanvas.height = canvas.height * scale;
<<<<<<< HEAD
        
=======

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
        const ctx = targetCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);
      }
<<<<<<< HEAD
      
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
=======

      imageData = targetCanvas.toDataURL('image/png', 0.9);
      console.log(
        '📷 macOS OCR: Optimized image data size:',
        imageData.length,
        'characters'
      );
    } catch (error) {
      console.error('📷 macOS OCR: Image processing error:', error);
      throw new Error('Failed to process image for macOS OCR: ' + error.message);
    }

    // The language code is already converted by the OCRProviders class.
    const message = {
      action: 'live_text_ocr', // Action name remains the same for the host
      image: imageData,
      language: options.language || 'auto',
      orientation: options.orientation || 'auto',
    };

    console.log(
      '📷 macOS OCR: Sending OCR request with language:',
      options.language
    );

    try {
      const response = await this.sendNativeMessage(message);
      console.log('📷 macOS OCR: Raw response received:', response);
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)

      if (!response) {
        throw new Error('No response from native messaging host');
      }

      if (response.error) {
<<<<<<< HEAD
        console.error('📷 Live Text: Native host error:', response.error);
        throw new Error('Live Text error: ' + response.error);
      }

      // Handle different response formats
=======
        console.error('📷 macOS OCR: Native host error:', response.error);
        throw new Error('macOS OCR error: ' + response.error);
      }

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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
<<<<<<< HEAD
        console.warn('📷 Live Text: Unexpected response format:', response);
=======
        console.warn('📷 macOS OCR: Unexpected response format:', response);
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
        text = '';
        confidence = 0;
      }

<<<<<<< HEAD
      console.log('📷 Live Text: Processed result:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        confidence: confidence,
        wordCount: words.length
=======
      console.log('📷 macOS OCR: Processed result:', {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        confidence: confidence,
        wordCount: words.length,
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      });

      return {
        text: text,
        confidence: confidence,
<<<<<<< HEAD
        words: words
      };
    } catch (error) {
      console.error('📷 Live Text recognition error:', error);
      // Reset initialization status on error
      this.isInitialized = false;
      this.hostAvailable = false;
      throw new Error('macOS Live Text recognition failed: ' + error.message);
=======
        words: words,
      };
    } catch (error) {
      console.error('📷 macOS OCR recognition error:', error);
      this.isInitialized = false;
      this.hostAvailable = false;
      throw new Error('macOS Native OCR recognition failed: ' + error.message);
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    }
  }

  async sendNativeMessage(message) {
    return new Promise((resolve, reject) => {
<<<<<<< HEAD
      console.log('📷 Sending native message to Live Text host...');
      
      // Set a timeout for the native messaging
=======
      console.log('📷 Sending native message to macOS host...');

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      const timeout = setTimeout(() => {
        console.error('📷 Native messaging timeout');
        reject(new Error('Native messaging timeout after 15 seconds'));
      }, 15000);
<<<<<<< HEAD
      
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
=======

      console.log('📷 macOS OCR: Sending to com.ollama.translator.ocr host');
      chrome.runtime.sendMessage(
        {
          action: 'sendNativeMessage',
          hostName: 'com.ollama.translator.ocr',
          nativeMessage: message,
        },
        (response) => {
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
        }
      );
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    });
  }
}

<<<<<<< HEAD
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
=======
// **REMOVED**: The entire MacOSVisionProvider class is gone.
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)

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
<<<<<<< HEAD
    return true; // Available everywhere with internet
=======
    return true;
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
  }

  requiresSetup() {
    return true;
  }

  getSupportedLanguages() {
    return {
<<<<<<< HEAD
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
=======
      auto: 'Auto-detect',
      en: 'English',
      ja: 'Japanese',
      zh: 'Chinese',
      'zh-TW': 'Chinese Traditional',
      ko: 'Korean',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ar: 'Arabic',
      hi: 'Hindi',
      th: 'Thai',
      vi: 'Vietnamese',
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    };
  }

  async initialize(apiKey) {
    if (!apiKey) {
<<<<<<< HEAD
      // Try to get API key from storage
=======
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      try {
        const result = await chrome.storage.sync.get(['googleCloudApiKey']);
        apiKey = result.googleCloudApiKey;
      } catch (error) {
<<<<<<< HEAD
        console.warn('Failed to load Google Cloud API key from storage:', error);
=======
        console.warn(
          'Failed to load Google Cloud API key from storage:',
          error
        );
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      }
    }

    if (!apiKey) {
      console.warn('📷 Google Cloud Vision: No API key provided');
      this.isInitialized = false;
      return false;
    }

    this.apiKey = apiKey;
<<<<<<< HEAD
    
    // Test API key
=======

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    try {
      const testResponse = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
<<<<<<< HEAD
            requests: [{
              image: { content: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' },
              features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
            }]
          })
=======
            requests: [
              {
                image: {
                  content:
                    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                },
                features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
              },
            ],
          }),
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
        }
      );

      if (!testResponse.ok) {
        const error = await testResponse.json();
        throw new Error(error.error?.message || 'API key validation failed');
      }

      this.isInitialized = true;
      return true;
    } catch (error) {
<<<<<<< HEAD
      console.warn('📷 Google Cloud Vision: API key validation failed:', error.message);
=======
      console.warn(
        '📷 Google Cloud Vision: API key validation failed:',
        error.message
      );
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      this.isInitialized = false;
      return false;
    }
  }

  async recognize(canvas, options = {}) {
    if (!this.isInitialized || !this.apiKey) {
<<<<<<< HEAD
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
=======
      const initResult = await this.initialize();
      if (!initResult) {
        throw new Error(
          'Google Cloud Vision not available - API key required'
        );
      }
    }

    const imageData = canvas.toDataURL('image/png').split(',')[1];

    const requestBody = {
      requests: [
        {
          image: { content: imageData },
          features: [{ type: 'TEXT_DETECTION', maxResults: 50 }],
          imageContext: {},
        },
      ],
    };

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    if (options.language && options.language !== 'auto') {
      requestBody.requests[0].imageContext.languageHints = [options.language];
    }

    try {
      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
<<<<<<< HEAD
          body: JSON.stringify(requestBody)
=======
          body: JSON.stringify(requestBody),
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
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

<<<<<<< HEAD
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
=======
      const fullText = annotations[0].description || '';

      const words = annotations.slice(1).map((annotation) => ({
        text: annotation.description,
        confidence: 100,
        bbox: {
          x0: Math.min(
            ...annotation.boundingPoly.vertices.map((v) => v.x || 0)
          ),
          y0: Math.min(
            ...annotation.boundingPoly.vertices.map((v) => v.y || 0)
          ),
          x1: Math.max(
            ...annotation.boundingPoly.vertices.map((v) => v.x || 0)
          ),
          y1: Math.max(
            ...annotation.boundingPoly.vertices.map((v) => v.y || 0)
          ),
        },
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
      }));

      return {
        text: fullText,
<<<<<<< HEAD
        confidence: 95, // Google Vision is generally very accurate
        words: words
      };
    } catch (error) {
      throw new Error('Google Cloud Vision recognition failed: ' + error.message);
=======
        confidence: 95,
        words: words,
      };
    } catch (error) {
      throw new Error(
        'Google Cloud Vision recognition failed: ' + error.message
      );
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    }
  }
}

window.OCRProviders = OCRProviders;