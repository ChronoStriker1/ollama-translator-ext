// Enhanced OCR Handler with Multiple Provider Support - COMPLETE FIXED VERSION
class OCRHandler {
  constructor() {
    this.isSelecting = false;
    this.selectionBox = null;
    this.startPoint = null;
    this.overlay = null;
    this.controlPanel = null;
    this.ocrProviders = null;
    this.orientationMode = 'auto';
    this.isDragging = false;
    this.debugMode = false;
    this.selectedLanguage = 'eng';
    this.selectedProvider = 'tesseract';
    this.tryBothImages = true;
    this.currentProviderInfo = null;
    
    // Event handler references for proper cleanup
    this.mouseDownHandler = null;
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;
    this.keyDownHandler = null;
    
    // Initialize providers only if OCRProviders is available
    this.initializeProviders();
    this.setupEventListeners();
    this.injectOCRStyles();
    this.loadSettings();
  }

  initializeProviders() {
    try {
      if (typeof OCRProviders !== 'undefined') {
        this.ocrProviders = new OCRProviders();
      } else {
        console.warn('OCRProviders not available, creating stub');
        this.ocrProviders = {
          getAvailableProviders: () => ({
            tesseract: {
              name: 'Tesseract.js',
              description: 'OCR engine (requires library)',
              isAvailable: typeof window.Tesseract !== 'undefined',
              requiresSetup: false,
              supportedLanguages: { 'eng': 'English' }
            }
          }),
          initializeProvider: () => Promise.resolve(false),
          performOCR: () => Promise.reject(new Error('OCR providers not available')),
          cleanup: () => {}
        };
      }
    } catch (error) {
      console.error('Failed to initialize OCR providers:', error);
      this.ocrProviders = {
        getAvailableProviders: () => ({}),
        initializeProvider: () => Promise.resolve(false),
        performOCR: () => Promise.reject(new Error('OCR initialization failed')),
        cleanup: () => {}
      };
    }
  }

  async loadSettings() {
      try {
        const result = await chrome.storage.sync.get([
          'ocrProvider',
          'ocrLanguage',
          'ocrTryBothImages',
          'ocrDebugMode',
          'googleCloudApiKey'
        ]);
        
        this.selectedProvider = result.ocrProvider || 'tesseract';
        this.selectedLanguage = result.ocrLanguage || 'eng';
        this.tryBothImages = result.ocrTryBothImages !== false;
        this.debugMode = result.ocrDebugMode || false;
        
        // Validate language for current provider
        const availableProviders = this.ocrProviders.getAvailableProviders();
        const currentProvider = availableProviders[this.selectedProvider];
        const supportedLanguages = currentProvider?.supportedLanguages || {};
        
        // If current language isn't supported by current provider, use first available
        if (!supportedLanguages[this.selectedLanguage]) {
          const firstLanguage = Object.keys(supportedLanguages)[0];
          if (firstLanguage) {
            this.selectedLanguage = firstLanguage;
            console.log('📋 Language not supported, switching to:', this.selectedLanguage);
          }
        }
        
        console.log('📋 Loaded OCR settings:', {
          provider: this.selectedProvider,
          language: this.selectedLanguage,
          tryBothImages: this.tryBothImages,
          debugMode: this.debugMode
        });
      } catch (error) {
        console.warn('Failed to load OCR settings:', error);
        // Set safe defaults
        this.selectedProvider = 'tesseract';
        this.selectedLanguage = 'eng';
        this.tryBothImages = true;
        this.debugMode = false;
      }
    }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        ocrProvider: this.selectedProvider,
        ocrLanguage: this.selectedLanguage,
        ocrTryBothImages: this.tryBothImages,
        ocrDebugMode: this.debugMode
      });
    } catch (error) {
      console.warn('Failed to save OCR settings:', error);
    }
  }

  injectOCRStyles() {
    // Remove existing styles first
    const existingStyle = document.getElementById('ocr-handler-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'ocr-handler-styles';
    style.textContent = `
      /* OCR Selection Overlay - Consistent with main theme */
      #ocr-selection-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background-color: rgba(0, 0, 0, 0.3) !important;
        z-index: 999999 !important;
        pointer-events: all !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
      }

      #ocr-selection-box {
        position: absolute !important;
        border: 2px dashed #ff6b6b !important;
        background-color: rgba(255, 107, 107, 0.1) !important;
        pointer-events: none !important;
        display: none !important;
        z-index: 999998 !important;
      }

      #ocr-selection-box.active {
        display: block !important;
      }

      /* OCR Control Panel - Consistent with main theme */
      .ocr-control-panel {
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        background: #222 !important;
        color: #fff !important;
        padding: 15px !important;
        border-radius: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        z-index: 1000000 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
        min-width: 400px !important;
        max-width: 450px !important;
        max-height: 85vh !important;
        overflow: auto !important;
        display: block !important;
        visibility: visible !important;
        opacity: 0.9 !important;
      }

      .ocr-draggable {
        cursor: move !important;
        user-select: none !important;
      }
      
      .ocr-no-drag {
        cursor: default !important;
      }
      
      .ocr-provider-section {
        margin-bottom: 20px !important;
        padding: 12px !important;
        background: #333 !important;
        border-radius: 6px !important;
        border: 1px solid #555 !important;
      }
      
      .ocr-provider-header {
        display: flex !important;
        align-items: center !important;
        margin-bottom: 10px !important;
        font-weight: bold !important;
        color: #fff !important;
      }
      
      .ocr-provider-status {
        margin-left: auto !important;
        font-size: 11px !important;
        padding: 2px 6px !important;
        border-radius: 3px !important;
        font-weight: normal !important;
      }
      
      .ocr-provider-status.available {
        background: #4CAF50 !important;
        color: white !important;
      }
      
      .ocr-provider-status.unavailable {
        background: #f44336 !important;
        color: white !important;
      }
      
      .ocr-provider-status.setup-required {
        background: #ff9800 !important;
        color: white !important;
      }
      
      .ocr-provider-grid {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 8px !important;
      }
      
      .ocr-provider-item {
        display: flex !important;
        align-items: flex-start !important;
        padding: 10px !important;
        border-radius: 4px !important;
        background: #444 !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
        position: relative !important;
      }
      
      .ocr-provider-item:hover {
        background: #555 !important;
      }
      
      .ocr-provider-item.selected {
        background: #4CAF50 !important;
      }
      
      .ocr-provider-item.selected:hover {
        background: #45a049 !important;
      }
      
      .ocr-provider-item.disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
      
      .ocr-provider-radio {
        width: 16px !important;
        height: 16px !important;
        margin: 0 !important;
        margin-right: 10px !important;
        margin-top: 2px !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        background: #fff !important;
        border: 2px solid #666 !important;
        border-radius: 50% !important;
        outline: none !important;
        position: relative !important;
      }
      
      .ocr-provider-radio:checked {
        background: #4CAF50 !important;
        border-color: #4CAF50 !important;
      }
      
      .ocr-provider-radio:checked::after {
        content: '' !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 6px !important;
        height: 6px !important;
        background: white !important;
        border-radius: 50% !important;
      }
      
      .ocr-provider-info {
        flex: 1 !important;
      }
      
      .ocr-provider-name {
        font-size: 13px !important;
        color: #fff !important;
        font-weight: bold !important;
        margin-bottom: 4px !important;
      }
      
      .ocr-provider-description {
        font-size: 11px !important;
        color: #ccc !important;
        line-height: 1.3 !important;
      }
      
      .ocr-setup-button {
        margin-top: 8px !important;
        padding: 4px 8px !important;
        background: #ff9800 !important;
        color: white !important;
        border: none !important;
        border-radius: 3px !important;
        font-size: 11px !important;
        cursor: pointer !important;
      }
      
      .ocr-setup-button:hover {
        background: #f57c00 !important;
      }

      /* Language Selection - Consistent styling */
      .ocr-language-grid {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 4px !important;
        margin-bottom: 15px !important;
        max-height: 200px !important;
        overflow-y: auto !important;
        padding: 8px !important;
        background: #333 !important;
        border-radius: 4px !important;
        border: 1px solid #555 !important;
      }
      
      .ocr-language-item {
        display: flex !important;
        align-items: center !important;
        padding: 8px !important;
        border-radius: 4px !important;
        background: #444 !important;
        cursor: pointer !important;
        transition: background-color 0.2s !important;
        position: relative !important;
      }
      
      .ocr-language-item:hover {
        background: #555 !important;
      }
      
      .ocr-language-item.selected {
        background: #4CAF50 !important;
      }
      
      .ocr-language-item.selected:hover {
        background: #45a049 !important;
      }
      
      .ocr-language-radio {
        width: 16px !important;
        height: 16px !important;
        margin: 0 !important;
        margin-right: 10px !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        background: #fff !important;
        border: 2px solid #666 !important;
        border-radius: 50% !important;
        outline: none !important;
        position: relative !important;
      }
      
      .ocr-language-radio:checked {
        background: #4CAF50 !important;
        border-color: #4CAF50 !important;
      }
      
      .ocr-language-radio:checked::after {
        content: '' !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 6px !important;
        height: 6px !important;
        background: white !important;
        border-radius: 50% !important;
      }
      
      .ocr-language-label {
        font-size: 13px !important;
        color: #fff !important;
        cursor: pointer !important;
        user-select: none !important;
        flex: 1 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      .ocr-language-item.selected .ocr-language-label {
        font-weight: bold !important;
      }

      /* Options - Consistent styling */
      .ocr-option-container {
        display: flex !important;
        align-items: center !important;
        margin-bottom: 8px !important;
        min-height: 24px !important;
        position: relative !important;
        padding: 4px !important;
        border-radius: 4px !important;
        background: #333 !important;
      }
      
      .ocr-option-container:hover {
        background: #444 !important;
      }
      
      .ocr-input-wrapper {
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        cursor: pointer !important;
      }
      
      .ocr-radio, .ocr-checkbox {
        width: 16px !important;
        height: 16px !important;
        margin: 0 !important;
        margin-right: 10px !important;
        cursor: pointer !important;
        flex-shrink: 0 !important;
        position: relative !important;
        z-index: 1000001 !important;
        appearance: none !important;
        -webkit-appearance: none !important;
        -moz-appearance: none !important;
        background: #fff !important;
        border: 2px solid #666 !important;
        border-radius: 3px !important;
        outline: none !important;
      }
      
      .ocr-radio {
        border-radius: 50% !important;
      }
      
      .ocr-radio:checked, .ocr-checkbox:checked {
        background: #4CAF50 !important;
        border-color: #4CAF50 !important;
      }
      
      .ocr-radio:checked::after {
        content: '' !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        width: 6px !important;
        height: 6px !important;
        background: white !important;
        border-radius: 50% !important;
      }
      
      .ocr-checkbox:checked::after {
        content: '✓' !important;
        position: absolute !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        color: white !important;
        font-size: 10px !important;
        font-weight: bold !important;
        line-height: 1 !important;
      }
      
      .ocr-option-label {
        font-size: 13px !important;
        cursor: pointer !important;
        user-select: none !important;
        color: #fff !important;
        line-height: 1.2 !important;
        flex: 1 !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      /* Instructions and loading messages - Consistent styling */
      .ocr-instruction-popup, .ocr-loading-message {
        position: fixed !important;
        top: 50% !important;
        left: 50% !important;
        transform: translate(-50%, -50%) !important;
        background-color: rgba(34, 34, 34, 0.95) !important;
        color: #fff !important;
        padding: 20px !important;
        border-radius: 8px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 16px !important;
        text-align: center !important;
        z-index: 1000001 !important;
        max-width: 400px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
      }

      /* Hide OCR UI elements from screenshots */
      .ocr-capturing #ocr-selection-overlay,
      .ocr-capturing .ocr-control-panel,
      .ocr-capturing .ocr-loading-message,
      .ocr-capturing .ocr-instruction-popup {
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
      
      #ocr-selection-box.capturing {
        visibility: hidden !important;
        opacity: 0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'start-ocr') {
        console.log('📷 OCR Handler received start-ocr message');
        this.startOCRSelection();
        sendResponse({status: 'started'});
      }
    });
  }

  async startOCRSelection() {
      console.log('📷 Starting OCR selection...');
      
      if (this.isSelecting) {
        console.log('📷 OCR already in progress, ignoring');
        return;
      }
      
      try {
        this.showLoadingMessage('Initializing OCR engine...');
        
        // Get available providers
        const availableProviders = this.ocrProviders.getAvailableProviders();
        this.currentProviderInfo = availableProviders[this.selectedProvider];
        
        if (!this.currentProviderInfo?.isAvailable) {
          this.hideLoadingMessage();
          this.showError(`Selected OCR provider "${this.selectedProvider}" is not available. Please select a different provider.`);
          return;
        }
        
        // Initialize the selected provider
        console.log('📷 Initializing provider:', this.selectedProvider);
        await this.ocrProviders.initializeProvider(this.selectedProvider);
        
        // For Tesseract, also initialize with language
        if (this.selectedProvider === 'tesseract' && this.ocrProviders.providers?.tesseract) {
          let languageToUse = this.selectedLanguage;
          
          // Validate language for Tesseract
          const supportedLanguages = this.currentProviderInfo.supportedLanguages;
          if (!supportedLanguages[languageToUse]) {
            languageToUse = 'eng'; // Default to English
            console.log('📷 Language not supported by Tesseract, using English');
          }
          
          console.log('📷 Initializing Tesseract with language:', languageToUse);
          await this.ocrProviders.providers.tesseract.initialize(languageToUse);
        }
        
        this.hideLoadingMessage();
        
        console.log('📷 Creating selection overlay...');
        this.isSelecting = true;
        this.isDragging = false;
        this.createSelectionOverlay();
        
        // Show instructions with delay to ensure they appear after overlay
        setTimeout(() => {
          this.showInstructions();
        }, 100);
        
        document.body.style.cursor = 'crosshair';
        console.log('📷 OCR selection ready');
        
      } catch (error) {
        console.error('Failed to start OCR:', error);
        this.showError('Failed to initialize OCR: ' + error.message);
        this.hideLoadingMessage();
      }
    }

  createSelectionOverlay() {
    console.log('📷 Creating selection overlay...');
    
    // Remove any existing overlay
    this.cancelOCRSelection();
    
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.id = 'ocr-selection-overlay';
    
    // Create selection box
    this.selectionBox = document.createElement('div');
    this.selectionBox.id = 'ocr-selection-box';
    
    // Create control panel
    this.controlPanel = this.createControlPanel();
    
    // Append elements
    this.overlay.appendChild(this.selectionBox);
    this.overlay.appendChild(this.controlPanel);
    document.body.appendChild(this.overlay);
    
    console.log('📷 Overlay created, setting up event listeners...');
    
    // Setup event listeners
    this.mouseDownHandler = this.handleMouseDown.bind(this);
    this.mouseMoveHandler = this.handleMouseMove.bind(this);
    this.mouseUpHandler = this.handleMouseUp.bind(this);
    this.keyDownHandler = this.handleKeyDown.bind(this);
    
    // Add event listeners to the overlay, not document
    this.overlay.addEventListener('mousedown', this.mouseDownHandler, true);
    document.addEventListener('mousemove', this.mouseMoveHandler, true);
    document.addEventListener('mouseup', this.mouseUpHandler, true);
    document.addEventListener('keydown', this.keyDownHandler, true);
    
    console.log('📷 Event listeners attached');
  }

  createControlPanel() {
    console.log('📷 Creating control panel...');
    
    const panel = document.createElement('div');
    panel.className = 'ocr-control-panel';

    this.makeDraggable(panel);

    const availableProviders = this.ocrProviders.getAvailableProviders();
    const currentProvider = availableProviders[this.selectedProvider];
    const supportedLanguages = currentProvider?.supportedLanguages || {};

    panel.innerHTML = `
      <div class="ocr-draggable" style="font-weight: bold; margin-bottom: 10px; padding: 5px 0;">📷 OCR Selection</div>
      <div class="ocr-draggable" style="font-size: 12px; margin-bottom: 15px; color: #ccc; padding: 5px 0;">
        Drag to select text area for OCR translation
      </div>
      
      <!-- OCR Provider Selection -->
      <div class="ocr-provider-section">
        <div class="ocr-provider-header">
          🔧 OCR Engine
        </div>
        <div class="ocr-provider-grid">
          ${Object.entries(availableProviders).map(([key, provider]) => {
            const isSelected = key === this.selectedProvider;
            const isDisabled = !provider.isAvailable;
            const statusClass = provider.isAvailable ? 
              (provider.requiresSetup ? 'setup-required' : 'available') : 
              'unavailable';
            const statusText = provider.isAvailable ? 
              (provider.requiresSetup ? 'Setup Required' : 'Available') : 
              'Unavailable';
            
            return `
              <div class="ocr-provider-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}" 
                   data-provider="${key}">
                <input type="radio" class="ocr-provider-radio ocr-no-drag" 
                       name="ocr-provider" id="provider-${key}" value="${key}" 
                       ${isSelected ? 'checked' : ''} ${isDisabled ? 'disabled' : ''}>
                <div class="ocr-provider-info">
                  <div class="ocr-provider-name">${provider.name}</div>
                  <div class="ocr-provider-description">${provider.description}</div>
                  ${provider.requiresSetup && provider.isAvailable ? 
                    `<button class="ocr-setup-button ocr-no-drag" data-provider="${key}">Configure</button>` : 
                    ''
                  }
                </div>
                <div class="ocr-provider-status ${statusClass}">${statusText}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      
      <!-- Language Selection -->
      <div style="margin-bottom: 15px;">
        <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">OCR Language:</div>
        <div class="ocr-language-grid" id="ocr-language-grid">
          ${Object.entries(supportedLanguages).map(([code, name]) => `
            <div class="ocr-language-item ${code === this.selectedLanguage ? 'selected' : ''}" data-lang="${code}">
              <input type="radio" class="ocr-language-radio ocr-no-drag" name="ocr-language" id="lang-${code}" value="${code}" 
                     ${code === this.selectedLanguage ? 'checked' : ''}>
              <label class="ocr-language-label ocr-no-drag" for="lang-${code}">${name}</label>
            </div>
          `).join('')}
        </div>
      </div>
      
      <!-- Processing Options -->
      ${this.selectedProvider === 'tesseract' ? `
        <div style="margin-bottom: 15px;">
          <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">Processing Options:</div>
          
          <div class="ocr-option-container">
            <div class="ocr-input-wrapper">
              <input type="checkbox" class="ocr-checkbox ocr-no-drag" id="ocr-try-both" ${this.tryBothImages ? 'checked' : ''}>
              <label class="ocr-option-label ocr-no-drag" for="ocr-try-both">Try both original and processed images</label>
            </div>
          </div>
        </div>
      ` : ''}
      
      <!-- Orientation Options -->
      <div style="margin-bottom: 15px;">
        <div style="font-size: 12px; color: #aaa; margin-bottom: 8px;">Text Orientation:</div>
        
        <div class="ocr-option-container">
          <div class="ocr-input-wrapper">
            <input type="radio" class="ocr-radio ocr-no-drag" name="orientation" id="ocr-auto" value="auto" ${this.orientationMode === 'auto' ? 'checked' : ''}>
            <label class="ocr-option-label ocr-no-drag" for="ocr-auto">Auto-detect orientation</label>
          </div>
        </div>
        
        <div class="ocr-option-container">
          <div class="ocr-input-wrapper">
            <input type="radio" class="ocr-radio ocr-no-drag" name="orientation" id="ocr-vertical" value="vertical" ${this.orientationMode === 'vertical' ? 'checked' : ''}>
            <label class="ocr-option-label ocr-no-drag" for="ocr-vertical">Vertical text (manga/Japanese)</label>
          </div>
        </div>
        
        <div class="ocr-option-container">
          <div class="ocr-input-wrapper">
            <input type="radio" class="ocr-radio ocr-no-drag" name="orientation" id="ocr-horizontal" value="horizontal" ${this.orientationMode === 'horizontal' ? 'checked' : ''}>
            <label class="ocr-option-label ocr-no-drag" for="ocr-horizontal">Horizontal text (standard)</label>
          </div>
        </div>
      </div>
      
      <!-- Debug Options -->
      <div style="margin-bottom: 15px;">
        <div class="ocr-option-container">
          <div class="ocr-input-wrapper">
            <input type="checkbox" class="ocr-checkbox ocr-no-drag" id="ocr-debug" ${this.debugMode ? 'checked' : ''}>
            <label class="ocr-option-label ocr-no-drag" for="ocr-debug">Debug mode (show captured images)</label>
          </div>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="ocr-reset-btn" class="ocr-no-drag" style="padding: 6px 10px; background: #ff9800; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">Reset OCR</button>
        <button id="ocr-cancel-btn" class="ocr-no-drag" style="padding: 6px 10px; background: #666; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">Cancel</button>
        <button id="ocr-help-btn" class="ocr-no-drag" style="padding: 6px 10px; background: #4CAF50; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">Help</button>
      </div>
    `;
    
    console.log('📷 Control panel HTML created, setting up event listeners...');
    this.setupPanelEventListeners(panel);
    
    return panel;
  }

  // Continue with the rest of the methods...
  setupPanelEventListeners(panel) {
    // Provider selection
    const providerItems = panel.querySelectorAll('.ocr-provider-item');
    const providerRadios = panel.querySelectorAll('input[name="ocr-provider"]');
    
    providerItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        if (item.classList.contains('disabled')) return;
        
        if (e.target.type === 'radio' || e.target.classList.contains('ocr-setup-button')) return;
        
        const radio = item.querySelector('input[type="radio"]');
        if (radio && !radio.disabled && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
    
    providerRadios.forEach(radio => {
      radio.addEventListener('change', async (e) => {
        if (e.target.checked) {
          console.log('📷 Provider changed to:', e.target.value);
          await this.updateSelectedProvider(e.target.value);
        }
      });
    });

    // Language selection
    const languageItems = panel.querySelectorAll('.ocr-language-item');
    const languageRadios = panel.querySelectorAll('input[name="ocr-language"]');
    
    languageItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.type === 'radio') return;
        
        const radio = item.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
    
    languageRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          console.log('📷 Language changed to:', e.target.value);
          this.updateSelectedLanguage(e.target.value);
        }
      });
    });

    // Orientation radio buttons
    const orientationRadios = panel.querySelectorAll('input[name="orientation"]');
    orientationRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          console.log('📷 Orientation changed to:', e.target.value);
          this.orientationMode = e.target.value;
          this.saveSettings();
        }
      });
    });

    // Checkboxes
    const tryBothCheckbox = panel.querySelector('#ocr-try-both');
    if (tryBothCheckbox) {
      tryBothCheckbox.addEventListener('change', (e) => {
        console.log('📷 Try both images changed to:', e.target.checked);
        this.tryBothImages = e.target.checked;
        this.saveSettings();
      });
    }

    const debugCheckbox = panel.querySelector('#ocr-debug');
    if (debugCheckbox) {
      debugCheckbox.addEventListener('change', (e) => {
        console.log('📷 Debug mode changed to:', e.target.checked);
        this.debugMode = e.target.checked;
        this.saveSettings();
      });
    }

    // Action buttons
    const cancelBtn = panel.querySelector('#ocr-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📷 Cancel button clicked');
        this.cancelOCRSelection();
      });
    }

    const resetBtn = panel.querySelector('#ocr-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📷 Reset button clicked');
        this.resetOCRSettings();
      });
    }

    const helpBtn = panel.querySelector('#ocr-help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('📷 Help button clicked');
        this.showOCRHelp();
      });
    }

    // Setup buttons for providers that require setup
    const setupButtons = panel.querySelectorAll('.ocr-setup-button');
    setupButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const provider = button.dataset.provider;
        console.log('📷 Setup button clicked for provider:', provider);
        this.showProviderSetup(provider);
      });
    });

    console.log('📷 Panel event listeners setup complete');
  }

  async updateSelectedProvider(providerKey) {
    console.log('📷 Updating selected provider to:', providerKey);
    this.selectedProvider = providerKey;
    
    // Update UI
    const items = document.querySelectorAll('.ocr-provider-item');
    items.forEach(item => {
      if (item.dataset.provider === providerKey) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
    
    // Update language options for the new provider
    this.updateLanguageOptions();
    
    await this.saveSettings();
  }
  
  updateSelectedLanguage(languageCode) {
    console.log('📷 Updating selected language to:', languageCode);
    this.selectedLanguage = languageCode;
    
    // Update UI
    const items = document.querySelectorAll('.ocr-language-item');
    items.forEach(item => {
      if (item.dataset.lang === languageCode) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
    
    this.saveSettings();
  }
  
  updateLanguageOptions() {
    const languageGrid = document.getElementById('ocr-language-grid');
    if (!languageGrid) return;
    
    const availableProviders = this.ocrProviders.getAvailableProviders();
    const currentProvider = availableProviders[this.selectedProvider];
    const supportedLanguages = currentProvider?.supportedLanguages || {};
    
    // Clear existing options
    languageGrid.innerHTML = '';
    
    // Add new options
    Object.entries(supportedLanguages).forEach(([code, name]) => {
      const isSelected = code === this.selectedLanguage;
      
      const languageItem = document.createElement('div');
      languageItem.className = `ocr-language-item ${isSelected ? 'selected' : ''}`;
      languageItem.dataset.lang = code;
      
      languageItem.innerHTML = `
        <input type="radio" class="ocr-language-radio ocr-no-drag" 
               name="ocr-language" id="lang-${code}" value="${code}" 
               ${isSelected ? 'checked' : ''}>
        <label class="ocr-language-label ocr-no-drag" for="lang-${code}">${name}</label>
      `;
      
      languageGrid.appendChild(languageItem);
    });
    
    // Re-attach event listeners for new elements
    this.attachLanguageEventListeners();
  }
  
  attachLanguageEventListeners() {
    const languageItems = document.querySelectorAll('.ocr-language-item');
    const languageRadios = document.querySelectorAll('input[name="ocr-language"]');
    
    languageItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.type === 'radio') return;
        
        const radio = item.querySelector('input[type="radio"]');
        if (radio && !radio.checked) {
          radio.checked = true;
          radio.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
    
    languageRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          this.updateSelectedLanguage(e.target.value);
        }
      });
    });
  }

  handleMouseDown(e) {
    console.log('📷 Mouse down on overlay, target:', e.target.id, 'className:', e.target.className);
    
    // Only start selection if clicking directly on the overlay
    if (e.target !== this.overlay) {
      console.log('📷 Click not on overlay, ignoring');
      return;
    }
    
    console.log('📷 Starting drag selection');
    this.isDragging = true;
    this.startPoint = {
      x: e.clientX,
      y: e.clientY
    };

    this.selectionBox.style.left = e.clientX + 'px';
    this.selectionBox.style.top = e.clientY + 'px';
    this.selectionBox.style.width = '0px';
    this.selectionBox.style.height = '0px';
    this.selectionBox.style.display = 'block';
    this.selectionBox.classList.add('active');

    console.log('📷 Selection box positioned at:', e.clientX, e.clientY);
    e.preventDefault();
    e.stopPropagation();
  }

  handleMouseMove(e) {
    if (!this.isDragging || !this.startPoint) return;

    const currentX = e.clientX;
    const currentY = e.clientY;

    const left = Math.min(this.startPoint.x, currentX);
    const top = Math.min(this.startPoint.y, currentY);
    const width = Math.abs(currentX - this.startPoint.x);
    const height = Math.abs(currentY - this.startPoint.y);

    this.selectionBox.style.left = left + 'px';
    this.selectionBox.style.top = top + 'px';
    this.selectionBox.style.width = width + 'px';
    this.selectionBox.style.height = height + 'px';

    if (width > 50 && height > 20) {
      this.selectionBox.style.border = '2px solid #4CAF50';
      this.selectionBox.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
    } else {
      this.selectionBox.style.border = '2px dashed #ff6b6b';
      this.selectionBox.style.backgroundColor = 'rgba(255, 107, 107, 0.1)';
    }

    e.preventDefault();
  }

  async handleMouseUp(e) {
    console.log('📷 Mouse up, isDragging:', this.isDragging);
    
    if (!this.isDragging || !this.startPoint) return;

    this.isDragging = false;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const left = Math.min(this.startPoint.x, currentX);
    const top = Math.min(this.startPoint.y, currentY);
    const width = Math.abs(currentX - this.startPoint.x);
    const height = Math.abs(currentY - this.startPoint.y);
    
    const rect = {
      left: left,
      top: top,
      right: left + width,
      bottom: top + height,
      width: width,
      height: height,
      x: left,
      y: top
    };
    
    console.log('📍 Selection coordinates:', rect);
    
    if (rect.width < 20 || rect.height < 20) {
      console.log('📷 Selection too small, resetting');
      this.resetSelection();
      return;
    }

    console.log('📷 Starting capture and translate...');
    await this.captureAndTranslate(rect);
    e.preventDefault();
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      console.log('📷 ESC pressed, canceling OCR');
      this.cancelOCRSelection();
    }
  }

  resetSelection() {
    this.startPoint = null;
    this.isDragging = false;
    if (this.selectionBox) {
      this.selectionBox.style.display = 'none';
      this.selectionBox.classList.remove('active');
    }
  }

  // COMPLETE CAPTURE AND TRANSLATE METHOD
  async captureAndTranslate(rect) {
      try {
        this.hideUIForCapture();
        await Utils.delay(200);
        
        this.showLoadingIndicator();
    
        const shouldShowDebug = this.debugMode || (window.ollamaTranslator?.translationEngine?.showLogs);
    
        console.log('📷 Starting capture with rect:', rect);
        console.log('🔧 Using OCR provider:', this.selectedProvider);
        
        const originalCanvas = await this.captureWithBackgroundScript(rect);
        
        if (!originalCanvas) {
          throw new Error('Failed to capture screenshot');
        }
    
        if (shouldShowDebug) {
          this.showDebugCanvas(originalCanvas, 'Original Screenshot');
        }
    
        let ocrResult = null;
        let usedProcessedImage = false;
    
        // For Tesseract, try both images if enabled
        if (this.selectedProvider === 'tesseract' && this.tryBothImages) {
          console.log('🔍 Trying OCR on original image first...');
          try {
            ocrResult = await this.ocrProviders.performOCR(originalCanvas, {
              language: this.selectedLanguage,
              orientation: this.orientationMode
            });
            
            if (ocrResult?.text && ocrResult.text.trim().length > 3) {
              console.log('✅ Original image OCR successful');
            } else {
              console.log('⚠️ Original image OCR result poor, will try processed image');
              ocrResult = null;
            }
          } catch (error) {
            console.warn('⚠️ Original image OCR failed:', error.message);
            ocrResult = null;
          }
        }
    
        // If original didn't work or wasn't tried, try processed image (for Tesseract)
        if (!ocrResult && this.selectedProvider === 'tesseract') {
          console.log('🎨 Processing image for better OCR...');
          const processedCanvas = this.preprocessForOCR(originalCanvas);
          usedProcessedImage = true;
          
          if (shouldShowDebug) {
            this.showDebugCanvas(processedCanvas, 'Processed for OCR');
          }
    
          console.log('🔍 Trying OCR on processed image...');
          ocrResult = await this.ocrProviders.performOCR(processedCanvas, {
            language: this.selectedLanguage,
            orientation: this.orientationMode
          });
        }
    
        // For other providers, use original image directly
        if (!ocrResult && this.selectedProvider !== 'tesseract') {
          console.log('🔍 Performing OCR with', this.selectedProvider);
          ocrResult = await this.ocrProviders.performOCR(originalCanvas, {
            language: this.selectedLanguage,
            orientation: this.orientationMode
          });
        }
        
        if (ocrResult?.text && ocrResult.text.trim()) {
          await this.translateOCRResult(ocrResult.text, rect, usedProcessedImage);
        } else {
          this.showError('No text detected in the selected area. Try:\n• Selecting a clearer text area\n• Enabling debug mode to see captured images\n• Trying a different OCR provider or orientation mode');
        }
      } catch (error) {
        console.error('OCR capture failed:', error);
        this.showError('OCR processing failed: ' + error.message);
      } finally {
        this.cancelOCRSelection();
      }
    }
    
    hideUIForCapture() {
      // Hide all OCR UI elements
      document.body.classList.add('ocr-capturing');
      
      // Hide selection box during capture
      if (this.selectionBox) {
        this.selectionBox.classList.add('capturing');
      }
    }
    
    async captureWithBackgroundScript(rect) {
      return new Promise((resolve, reject) => {
        console.log('📷 Requesting screenshot with selection rect:', rect);
        
        chrome.runtime.sendMessage(
          { action: 'captureScreenshot' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome runtime error:', chrome.runtime.lastError);
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            
            if (response.error) {
              console.error('Background script error:', response.error);
              reject(new Error(response.error));
              return;
            }
            
            if (!response.dataUrl) {
              reject(new Error('No screenshot data received'));
              return;
            }
            
            console.log('📷 Screenshot received, processing...');
            
            const img = new Image();
            img.onload = () => {
              try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const screenshotWidth = img.naturalWidth || img.width;
                const screenshotHeight = img.naturalHeight || img.height;
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                const scaleX = screenshotWidth / viewportWidth;
                const scaleY = screenshotHeight / viewportHeight;
                
                console.log('📷 Screenshot analysis:');
                console.log('- Screenshot size:', screenshotWidth + 'x' + screenshotHeight);
                console.log('- Viewport size:', viewportWidth + 'x' + viewportHeight);
                console.log('- Scale factors:', scaleX.toFixed(2) + 'x' + scaleY.toFixed(2));
                console.log('- Selection rect:', rect);
                
                const scaledRect = {
                  x: Math.round(rect.left * scaleX),
                  y: Math.round(rect.top * scaleY),
                  width: Math.round(rect.width * scaleX),
                  height: Math.round(rect.height * scaleY)
                };

                console.log('- Scaled rect for cropping:', scaledRect);

                // Capture at higher resolution for better OCR
                const outputScale = 3; // 3x scale for better text recognition
                canvas.width = rect.width * outputScale;
                canvas.height = rect.height * outputScale;

                ctx.scale(outputScale, outputScale);
                ctx.imageSmoothingEnabled = false; // Important for text
                ctx.imageSmoothingQuality = 'high';

                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, rect.width, rect.height);

                ctx.drawImage(
                  img,
                  scaledRect.x, scaledRect.y, scaledRect.width, scaledRect.height,
                  0, 0, rect.width, rect.height
                );

                console.log('📷 Final canvas created:', canvas.width + 'x' + canvas.height);
                resolve(canvas);
              } catch (error) {
                console.error('Canvas processing error:', error);
                reject(error);
              }
            };
            
            img.onerror = (error) => {
              console.error('Image load error:', error);
              reject(new Error('Failed to load screenshot image'));
            };
            
            img.src = response.dataUrl;
          }
        );
      });
    }
    
    preprocessForOCR(canvas) {
      console.log('🎨 Starting preprocessing for OCR...');
      console.log('- Input canvas size:', canvas.width + 'x' + canvas.height);
      console.log('- Target language:', this.selectedLanguage);
      
      const processedCanvas = document.createElement('canvas');
      const ctx = processedCanvas.getContext('2d');
      
      // Scale up the image for better OCR (minimum 300px width)
      const minWidth = 300;
      const scale = Math.max(minWidth / canvas.width, 2);
      
      processedCanvas.width = canvas.width * scale;
      processedCanvas.height = canvas.height * scale;
      
      ctx.imageSmoothingEnabled = false; // Disable smoothing for text
      ctx.imageSmoothingQuality = 'high';
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, processedCanvas.width, processedCanvas.height);
      
      // Draw scaled image
      ctx.drawImage(canvas, 0, 0, processedCanvas.width, processedCanvas.height);
      
      const imageData = ctx.getImageData(0, 0, processedCanvas.width, processedCanvas.height);
      const data = imageData.data;
      
      // Improved contrast enhancement for text
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // More aggressive contrast for small text
        let threshold = 128;
        if (this.selectedLanguage === 'jpn' || this.selectedLanguage === 'chi_sim' || this.selectedLanguage === 'chi_tra') {
          threshold = 140; // Higher threshold for Asian languages
        }
        
        const newValue = luminance > threshold ? 255 : 0;
        
        data[i] = newValue;
        data[i + 1] = newValue;
        data[i + 2] = newValue;
      }
      
      ctx.putImageData(imageData, 0, 0);
      
      console.log('🎨 Preprocessing complete');
      console.log('- Output canvas size:', processedCanvas.width + 'x' + processedCanvas.height);
      console.log('- Scale factor:', scale);
      
      return processedCanvas;
    }

  // Continue with remaining methods...
  showInstructions() {
    console.log('📷 Showing instructions...');
    
    const instructions = document.createElement('div');
    instructions.className = 'ocr-instruction-popup';

    const providerName = this.ocrProviders.getAvailableProviders()[this.selectedProvider]?.name || this.selectedProvider;

    instructions.innerHTML = `
        <div style="margin-bottom: 15px; font-size: 18px;">📷 OCR Text Selection</div>
        <div style="margin-bottom: 10px;">1. Click and drag to select the text area</div>
        <div style="margin-bottom: 10px;">2. Release to capture and translate</div>
        <div style="margin-bottom: 15px;">3. Press ESC to cancel</div>
        <div style="font-size: 12px; opacity: 0.8;">
        Provider: ${providerName}<br>
        Language: ${this.selectedLanguage}<br>
        ${this.selectedProvider === 'tesseract' && this.tryBothImages ? 'Will try both original and processed images' : 'Using selected processing mode'}
        </div>
    `;

    document.body.appendChild(instructions);

    // Auto-remove instructions after 3 seconds
    setTimeout(() => {
        if (instructions.parentNode) {
        instructions.remove();
        }
    }, 3000);
  }

  showLoadingMessage(message) {
    console.log('📷 Showing loading message:', message);
    
    const loading = document.createElement('div');
    loading.id = 'ocr-init-loading';
    loading.className = 'ocr-loading-message';

    loading.innerHTML = `
      <div style="margin-bottom: 10px;">📷 ${message}</div>
      <div style="font-size: 12px; opacity: 0.8;">Provider: ${this.selectedProvider}</div>
    `;

    document.body.appendChild(loading);
  }

  hideLoadingMessage() {
    console.log('📷 Hiding loading message');
    
    const loading = document.getElementById('ocr-init-loading');
    if (loading) {
      loading.remove();
    }
  }

  showLoadingIndicator() {
    const loading = document.createElement('div');
    loading.id = 'ocr-loading';
    loading.className = 'ocr-loading-message';

    const providerName = this.ocrProviders.getAvailableProviders()[this.selectedProvider]?.name || this.selectedProvider;

    loading.innerHTML = `
      <div style="margin-bottom: 10px;">📷 Processing OCR...</div>
      <div style="font-size: 12px; opacity: 0.8;">
        Provider: ${providerName}<br>
        Language: ${this.selectedLanguage}<br>
        ${this.selectedProvider === 'tesseract' && this.tryBothImages ? 'Trying both original and processed images' : 'Using selected processing mode'}
      </div>
    `;

    document.body.appendChild(loading);
  }

  async translateOCRResult(text, rect, usedProcessedImage = false) {
    if (!window.ollamaTranslator?.translationEngine) {
      this.showError('Translation engine not available');
      return;
    }

    try {
      const userContext = window.ollamaTranslator.uiManager?.getContextInput() || '';
      const userInstructions = window.ollamaTranslator.uiManager?.getCurrentTranslateInstruction() || 'Translate the following text to natural English. Respond only with the English translation:';
      
      const translated = await window.ollamaTranslator.translationEngine.translateTextWithContext(
        text.trim(),
        userContext,
        userInstructions,
        false
      );

      this.showOCRResult(text, translated, rect, usedProcessedImage);
    } catch (error) {
      this.showError('Translation failed: ' + error.message);
    }
  }
  
  showOCRResult(originalText, translatedText, rect, usedProcessedImage = false) {
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position: 'fixed',
      left: Math.min(rect.left, window.innerWidth - 350) + 'px',
      top: Math.min(rect.bottom + 10, window.innerHeight - 200) + 'px',
      width: '320px',
      maxHeight: '400px',
      backgroundColor: '#333',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '1000000',
      overflow: 'auto'
    });
  
    this.makeDraggable(popup);
  
    const providerName = this.ocrProviders.getAvailableProviders()[this.selectedProvider]?.name || this.selectedProvider;
    const imageTypeText = usedProcessedImage ? 'Processed' : 'Original';
    const imageTypeColor = usedProcessedImage ? '#ff9800' : '#4CAF50';
  
    // Escape text for safe HTML insertion
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };
  
    const escapedOriginal = escapeHtml(originalText);
    const escapedTranslated = escapeHtml(translatedText);
  
    popup.innerHTML = `
      <div class="ocr-draggable" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 5px 0;">
        <span style="font-weight: bold;">📷 OCR Translation</span>
        <button onclick="this.parentElement.parentElement.remove()" class="ocr-no-drag" style="background: none; border: none; color: #fff; font-size: 18px; cursor: pointer;">×</button>
      </div>
      
      <div style="font-size: 11px; color: #aaa; margin-bottom: 10px;">
        Provider: ${providerName} | Language: ${this.selectedLanguage} | 
        <span style="color: ${imageTypeColor};">${imageTypeText} Image</span>
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">Original (OCR):</div>
        <div style="background: #222; padding: 8px; border-radius: 4px; font-size: 12px; max-height: 80px; overflow-y: auto; word-wrap: break-word;">${escapedOriginal}</div>
      </div>
      
      <div style="margin-bottom: 10px;">
        <div style="font-size: 12px; color: #aaa; margin-bottom: 5px;">Translation:</div>
        <div style="background: #444; padding: 8px; border-radius: 4px; max-height: 100px; overflow-y: auto; word-wrap: break-word;">${escapedTranslated}</div>
      </div>
      
      <div style="display: flex; gap: 10px;">
        <button id="copy-translation-btn" class="ocr-no-drag" style="padding: 6px 12px; background: #4CAF50; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">
          Copy Translation
        </button>
        <button id="copy-original-btn" class="ocr-no-drag" style="padding: 6px 12px; background: #666; border: none; color: white; border-radius: 4px; cursor: pointer; font-size: 12px; flex: 1;">
          Copy Original
        </button>
      </div>
    `;
    
    // Add event listeners properly instead of using onclick attributes
    const copyTranslationBtn = popup.querySelector('#copy-translation-btn');
    const copyOriginalBtn = popup.querySelector('#copy-original-btn');
    
    copyTranslationBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(translatedText);
        copyTranslationBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyTranslationBtn.textContent = 'Copy Translation';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy translation:', error);
        copyTranslationBtn.textContent = 'Copy Failed';
        setTimeout(() => {
          copyTranslationBtn.textContent = 'Copy Translation';
        }, 2000);
      }
    });
    
    copyOriginalBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(originalText);
        copyOriginalBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyOriginalBtn.textContent = 'Copy Original';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy original:', error);
        copyOriginalBtn.textContent = 'Copy Failed';
        setTimeout(() => {
          copyOriginalBtn.textContent = 'Copy Original';
        }, 2000);
      }
    });
    
    document.body.appendChild(popup);
    
    // Auto-remove popup after 30 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        popup.remove();
      }
    }, 30000);
    
    // Add to translation log
    if (window.ollamaTranslator?.translationLog) {
      window.ollamaTranslator.translationLog.push({
        original: originalText,
        translated: translatedText,
        method: 'OCR',
        provider: providerName,
        language: this.selectedLanguage,
        imageType: imageTypeText
      });
    }
  }

  showDebugCanvas(canvas, method) {
    const debugDiv = document.createElement('div');
    Object.assign(debugDiv.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      backgroundColor: '#222',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      zIndex: '1000002',
      maxWidth: '600px',
      maxHeight: '80vh',
      overflow: 'auto',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      opacity: '0.9'
    });

    this.makeDraggable(debugDiv);
    
    const dataUrl = canvas.toDataURL();
    
    debugDiv.innerHTML = `
      <div class="ocr-draggable" style="font-weight: bold; margin-bottom: 10px; padding: 5px 0;">🔍 OCR Debug: ${method}</div>
      <div style="font-size: 12px; margin-bottom: 10px;">
        Size: ${canvas.width}x${canvas.height}<br>
        Provider: ${this.selectedProvider}<br>
        Language: ${this.selectedLanguage}<br>
        Try Both Images: ${this.tryBothImages ? 'Yes' : 'No'}<br>
        Data URL length: ${dataUrl.length} chars<br>
        Canvas context: ${canvas.getContext('2d') ? 'OK' : 'FAILED'}
      </div>
      <div style="margin-bottom: 10px;">
        <img class="ocr-debug-canvas" src="${dataUrl}" alt="Debug Canvas" style="max-width: 100%; border: 2px solid #fff; border-radius: 4px; background: white;">
      </div>
      <div style="margin-bottom: 10px;">
        <button onclick="
          const link = document.createElement('a');
          link.download = 'ocr-debug-${method.replace(/[^a-zA-Z0-9]/g, '-')}.png';
          link.href = '${dataUrl}';
          link.click();
        " class="ocr-no-drag" style="padding: 6px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
          Download Image
        </button>
        <button onclick="this.parentElement.parentElement.remove()" class="ocr-no-drag" style="padding: 6px 12px; background: #666; color: #fff; border: none; border-radius: 4px; cursor: pointer;">
          Close
        </button>
      </div>
    `;
    
    document.body.appendChild(debugDiv);
    
    setTimeout(() => {
      if (debugDiv.parentNode) {
        debugDiv.remove();
      }
    }, 60000);
  }

  resetOCRSettings() {
    console.log('📷 Resetting OCR settings to defaults');
    
    this.selectedProvider = 'tesseract';
    this.selectedLanguage = 'eng';
    this.orientationMode = 'auto';
    this.tryBothImages = true;
    this.debugMode = false;
    
    // Update UI
    this.updateProviderSelection();
    this.updateLanguageOptions();
    this.updateFormValues();
    
    this.saveSettings();
  }
  
  updateProviderSelection() {
    const items = document.querySelectorAll('.ocr-provider-item');
    const radios = document.querySelectorAll('input[name="ocr-provider"]');
    
    items.forEach(item => {
      if (item.dataset.provider === this.selectedProvider) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
    
    radios.forEach(radio => {
      radio.checked = radio.value === this.selectedProvider;
    });
  }
  
  updateFormValues() {
    // Update checkboxes
    const tryBothCheckbox = document.getElementById('ocr-try-both');
    if (tryBothCheckbox) {
      tryBothCheckbox.checked = this.tryBothImages;
    }
    
    const debugCheckbox = document.getElementById('ocr-debug');
    if (debugCheckbox) {
      debugCheckbox.checked = this.debugMode;
    }
    
    // Update orientation radios
    const orientationRadios = document.querySelectorAll('input[name="orientation"]');
    orientationRadios.forEach(radio => {
      radio.checked = radio.value === this.orientationMode;
    });
  }
  
  showOCRHelp() {
    const helpText = `
📷 OCR Translation Help

🔧 OCR Engines:
• Tesseract.js: Works offline, good for most text
• macOS Live Text: Fast, requires native app
• macOS Vision: Most accurate, requires native app
• Google Cloud: Highly accurate, requires API key

🌐 Languages:
Select the language of the text you want to recognize

📐 Orientation:
• Auto-detect: Let OCR determine text direction
• Vertical: For manga, Japanese vertical text
• Horizontal: For standard horizontal text

⚙️ Options:
• Try both images: Process original and enhanced images
• Debug mode: Show captured images for troubleshooting

📱 Usage:
1. Right-click → "📷 OCR & Translate"
2. Configure settings in the panel
3. Click and drag to select text area
4. Release to capture and translate
    `;
    
    alert(helpText);
  }
  
  showProviderSetup(provider) {
    let setupText = '';
    
    switch (provider) {
      case 'google_cloud':
        setupText = `Google Cloud Vision Setup:

1. Go to Google Cloud Console
2. Create a new project or select existing
3. Enable Vision API
4. Create API credentials (API Key)
5. Enter the API key in extension options

The API key will be stored securely in your browser.`;
        break;
        
      case 'macos_live_text':
      case 'macos_vision':
        setupText = `macOS OCR Setup:

These providers require a native macOS application to be installed.

1. Download the native messaging host app
2. Install it in /Applications/
3. Run the installer to register with Chrome
4. Grant necessary permissions in System Preferences

Note: The native app is not included with this extension and requires separate installation.`;
        break;
        
      default:
        setupText = `Setup information not available for ${provider}`;
    }
    
    alert(setupText);
  }

  makeDraggable(element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const handleMouseDown = (e) => {
      if (e.target.classList.contains('ocr-no-drag')) {
        return;
      }
      
      const tagName = e.target.tagName.toLowerCase();
      if (['input', 'button', 'select', 'textarea', 'label'].includes(tagName)) {
        return;
      }
      
      const isDraggableArea = e.target.classList.contains('ocr-draggable') || 
                             e.target.closest('.ocr-draggable') ||
                             (!e.target.classList.contains('ocr-no-drag') && !e.target.closest('.ocr-no-drag'));
      
      if (!isDraggableArea) {
        return;
      }

      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      
      const rect = element.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      element.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const handleMouseMove = (e) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      const newLeft = Math.max(0, Math.min(startLeft + deltaX, window.innerWidth - element.offsetWidth));
      const newTop = Math.max(0, Math.min(startTop + deltaY, window.innerHeight - element.offsetHeight));
      
      element.style.left = newLeft + 'px';
      element.style.top = newTop + 'px';
      
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = '';
      }
    };

    element.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    element._dragCleanup = () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }

  showError(message) {
    console.error('📷 OCR Error:', message);
    
    const error = document.createElement('div');
    Object.assign(error.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      backgroundColor: '#d32f2f',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      textAlign: 'center',
      zIndex: '1000001',
      maxWidth: '350px',
      whiteSpace: 'pre-line'
    });

    error.innerHTML = `
      <div style="margin-bottom: 10px;">❌ OCR Error</div>
      <div>${message}</div>
    `;

    document.body.appendChild(error);

    setTimeout(() => {
      if (error.parentNode) {
        error.remove();
      }
    }, 7000);
  }

  cancelOCRSelection() {
    console.log('📷 Canceling OCR selection');
    
    this.isSelecting = false;
    this.isDragging = false;
    document.body.style.cursor = '';
    document.body.classList.remove('ocr-capturing');
    
    // Clean up event listeners
    if (this.mouseDownHandler) {
      this.overlay?.removeEventListener('mousedown', this.mouseDownHandler, true);
      this.mouseDownHandler = null;
    }
    if (this.mouseMoveHandler) {
      document.removeEventListener('mousemove', this.mouseMoveHandler, true);
      this.mouseMoveHandler = null;
    }
    if (this.mouseUpHandler) {
      document.removeEventListener('mouseup', this.mouseUpHandler, true);
      this.mouseUpHandler = null;
    }
    if (this.keyDownHandler) {
      document.removeEventListener('keydown', this.keyDownHandler, true);
      this.keyDownHandler = null;
    }
    
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    this.selectionBox = null;
    this.controlPanel = null;
    this.startPoint = null;
    
    // Clean up any remaining UI elements
    const loadingElements = document.querySelectorAll('.ocr-loading-message, .ocr-instruction-popup');
    loadingElements.forEach(el => el.remove());
  }

  async cleanup() {
    if (this.ocrProviders && this.ocrProviders.cleanup) {
      await this.ocrProviders.cleanup();
    }
    this.cancelOCRSelection();
    
    const style = document.getElementById('ocr-handler-styles');
    if (style) {
      style.remove();
    }
    
    document.querySelectorAll('[data-ocr-draggable]').forEach(el => {
      if (el._dragCleanup) {
        el._dragCleanup();
      }
    });
  }
}

window.OCRHandler = OCRHandler;