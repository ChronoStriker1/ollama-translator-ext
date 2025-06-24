// UI Manager with Fixed Button Layout - CORRECTED VERSION
class UIManager {
  constructor(translationEngine, ocrHandler) {
    this.translationEngine = translationEngine;
    this.ocrHandler = ocrHandler;
    this.toolbar = null;
    this.collapsed = true;
    this.contextInput = null;
    this.instructionInput = null;
    this.currentTranslateInstruction = 'Translate the following text to natural English. Respond only with the English translation:';
    this.isCustomInstructionActive = false;
    this.inlineReview = false;
    this.showLogs = false;
    this.status = null;
    this.progressBar = null;
    this.reversePanel = null;
    this.revButton = null;
    
    this.loadSettings();
    this.createToolbar();
    this.setupEventListeners();
  }

  loadSettings() {
    chrome.storage.sync.get(['customTranslateInstruction'], (result) => {
      if (result.customTranslateInstruction) {
        this.currentTranslateInstruction = result.customTranslateInstruction;
        if (this.instructionInput) {
          this.instructionInput.value = this.currentTranslateInstruction;
        }
      }
    });
  }

  createToolbar() {
    // Create main toolbar
    this.toolbar = document.createElement('div');
    this.toolbar.id = 'ollama-translator-toolbar';
    Object.assign(this.toolbar.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: '999999',
      background: '#222',
      color: '#fff',
      padding: '8px',
      borderRadius: '8px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '14px',
      boxShadow: '2px 2px 6px rgba(0,0,0,0.5)',
      opacity: '0.9',
      cursor: 'move'
    });

    this.setupDragging();
    this.createToolbarContent();
    this.createStyles();
    
    document.body.appendChild(this.toolbar);
    this.updateCollapsed();
  }

  createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ollama-blink {
        0%, 100% { background-color: rgba(255, 250, 139, 0.5) !important; }
        50% { background-color: rgba(255, 250, 139, 0.2) !important; }
      }
      .ollama-highlight {
        background-color: rgba(255, 250, 139, 0.5) !important;
        animation: ollama-blink 1.5s ease-in-out infinite !important;
      }
      
      #ollama-bypass-checkbox {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        position: relative !important;
        z-index: 1 !important;
      }
      
      .ollama-draggable {
        cursor: move !important;
      }
      
      .ollama-no-drag {
        cursor: default !important;
      }
      
      .ollama-globe-icon {
        width: 24px !important;
        height: 24px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        font-size: 18px !important;
        line-height: 1 !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #4CAF50, #45a049) !important;
        color: white !important;
        text-shadow: 0 1px 2px rgba(0,0,0,0.3) !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
      }

      /* Reverse Panel Styling */
      .ollama-reverse-panel {
        position: fixed !important;
        background: #222 !important;
        color: #fff !important;
        padding: 15px !important;
        border-radius: 8px !important;
        box-shadow: 2px 2px 6px rgba(0,0,0,0.5) !important;
        z-index: 999998 !important;
        width: 280px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 14px !important;
        opacity: 0.9 !important;
        display: none !important;
      }

      .ollama-reverse-header {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        margin-bottom: 10px !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid #555 !important;
      }

      .ollama-reverse-title {
        font-weight: bold !important;
        cursor: move !important;
        user-select: none !important;
        flex: 1 !important;
      }

      .ollama-close-btn {
        background: #666 !important;
        border: none !important;
        color: #fff !important;
        width: 20px !important;
        height: 20px !important;
        border-radius: 3px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }

      .ollama-close-btn:hover {
        background: #888 !important;
      }
    `;
    document.head.appendChild(style);
  }

  setupDragging() {
    let isDragging = false, offsetX = 0, offsetY = 0;
    
    this.toolbar.addEventListener('mousedown', e => {
      // Don't drag if clicking on interactive elements
      if (e.target.classList.contains('ollama-no-drag')) {
        return;
      }
      
      const tag = e.target.tagName.toLowerCase();
      if (!this.collapsed && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'LABEL'].includes(tag)) {
        // Check if clicking on draggable area or non-interactive area
        const isDraggableArea = e.target.classList.contains('ollama-draggable') || 
                               e.target.closest('.ollama-draggable') ||
                               (!e.target.classList.contains('ollama-no-drag') && !e.target.closest('.ollama-no-drag'));
        
        if (isDraggableArea) {
          isDragging = true;
          offsetX = e.offsetX;
          offsetY = e.offsetY;
          this.toolbar.style.cursor = 'grabbing';
        }
      } else if (this.collapsed) {
        // When collapsed, the entire toolbar is draggable
        isDragging = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
        this.toolbar.style.cursor = 'grabbing';
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.toolbar.style.cursor = this.collapsed ? 'pointer' : 'move';
      }
    });
    
    document.addEventListener('mousemove', e => {
      if (isDragging) {
        const newLeft = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - this.toolbar.offsetWidth));
        const newTop = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - this.toolbar.offsetHeight));
        
        this.toolbar.style.left = `${newLeft}px`;
        this.toolbar.style.top = `${newTop}px`;
      }
    });
  }

  makeDraggable(element) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    const handleMouseDown = (e) => {
      // Only start dragging if the target has the draggable class or doesn't have the no-drag class
      if (e.target.classList.contains('ollama-no-drag')) {
        return;
      }
      
      // Check if clicking on interactive elements
      const tagName = e.target.tagName.toLowerCase();
      if (['input', 'button', 'select', 'textarea', 'label'].includes(tagName)) {
        return;
      }
      
      // Check if target or parent has draggable class, or if no specific class, allow dragging
      const isDraggableArea = e.target.classList.contains('ollama-draggable') || 
                             e.target.closest('.ollama-draggable') ||
                             (!e.target.classList.contains('ollama-no-drag') && !e.target.closest('.ollama-no-drag'));
      
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
    
    // Store cleanup function
    element._dragCleanup = () => {
      element.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }

  createToolbarContent() {
    // Header
    const header = document.createElement('div');
    header.className = 'ollama-draggable';
    header.textContent = '🌐 Ollama Translator Enhanced';
    Object.assign(header.style, {
      fontWeight: 'bold',
      marginBottom: '6px',
      cursor: 'move',
      userSelect: 'none',
      padding: '2px 0'
    });

    // Toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'ollama-no-drag';
    toggleBtn.textContent = '▼';
    Object.assign(toggleBtn.style, {
      position: 'absolute',
      right: '10px',
      top: '10px',
      background: '#444',
      border: 'none',
      color: '#fff',
      borderRadius: '3px',
      cursor: 'pointer',
      padding: '2px 6px',
      outline: 'none'
    });

    toggleBtn.onclick = () => {
      this.collapsed = !this.collapsed;
      this.updateCollapsed();
    };

    // Container for all controls
    const container = document.createElement('div');
    container.style.marginTop = '4px';

    // Create all UI components
    this.createContextControls(container);
    this.createInstructionControls(container);
    this.createMainButtons(container);
    this.createReverseTranslationPanel(); // Create separately, not in container
    this.createStatusAndProgress(container);

    this.toolbar.append(header, container, toggleBtn);
  }

  createContextControls(container) {
    // Context toggle + textarea
    const btnContext = document.createElement('button');
    btnContext.className = 'ollama-no-drag';
    btnContext.textContent = '📝 Context';
    this.styleButton(btnContext);

    this.contextInput = document.createElement('textarea');
    this.contextInput.className = 'ollama-no-drag';
    this.contextInput.placeholder = 'Enter contextual instructions…';
    Object.assign(this.contextInput.style, {
      display: 'none',
      margin: '3px 0',
      width: '100%',
      height: '40px',
      background: '#333',
      color: '#fff',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '4px',
      fontSize: '12px',
      resize: 'vertical'
    });
    btnContext.onclick = () => {
      const show = this.contextInput.style.display === 'none';
      this.contextInput.style.display = show ? 'block' : 'none';
      btnContext.style.background = show ? '#2a7' : '#444';
    };

    container.appendChild(btnContext);
    container.appendChild(this.contextInput);
  }

  createInstructionControls(container) {
    // Translation Instruction toggle + textarea
    this.instructionInput = document.createElement('textarea');
    this.instructionInput.className = 'ollama-no-drag';
    this.instructionInput.placeholder = 'Enter custom translation instruction…';
    this.instructionInput.value = this.currentTranslateInstruction;
    Object.assign(this.instructionInput.style, {
      display: 'none',
      margin: '3px 0',
      width: '100%',
      height: '60px',
      background: '#333',
      color: '#fff',
      border: '1px solid #555',
      borderRadius: '4px',
      padding: '4px',
      fontSize: '12px',
      resize: 'vertical'
    });

    // Instruction controls
    const instructionControls = document.createElement('div');
    Object.assign(instructionControls.style, {
      display: 'none',
      margin: '3px 0',
      gap: '4px'
    });

    const btnSaveInstruction = document.createElement('button');
    btnSaveInstruction.className = 'ollama-no-drag';
    btnSaveInstruction.textContent = '💾 Save';
    const btnResetInstruction = document.createElement('button');
    btnResetInstruction.className = 'ollama-no-drag';
    btnResetInstruction.textContent = '🔄 Reset';
    const btnRetranslate = document.createElement('button');
    btnRetranslate.className = 'ollama-no-drag';
    btnRetranslate.textContent = '🔄 Retranslate';

    for (const btn of [btnSaveInstruction, btnResetInstruction, btnRetranslate]) {
      Object.assign(btn.style, {
        margin: '2px',
        padding: '4px 8px',
        border: 'none',
        borderRadius: '3px',
        background: '#555',
        color: '#fff',
        cursor: 'pointer',
        fontSize: '11px',
        outline: 'none'
      });
    }

    instructionControls.append(btnSaveInstruction, btnResetInstruction, btnRetranslate);

    btnSaveInstruction.onclick = () => {
      const newInstruction = this.instructionInput.value.trim();
      if (newInstruction) {
        this.currentTranslateInstruction = newInstruction;
        chrome.storage.sync.set({ customTranslateInstruction: newInstruction });
        this.logStatus('Translation instruction saved!');
        this.translationEngine.clearCache();
        this.translationEngine.resetConversation();
      } else {
        this.logStatus('Please enter a valid instruction.');
      }
    };

    btnResetInstruction.onclick = () => {
      this.currentTranslateInstruction = 'Translate the following text to natural English. Respond only with the English translation:';
      this.instructionInput.value = this.currentTranslateInstruction;
      chrome.storage.sync.remove('customTranslateInstruction');
      this.logStatus('Translation instruction reset to default!');
      this.translationEngine.clearCache();
      this.translationEngine.resetConversation();
    };

    btnRetranslate.onclick = async () => {
      if (window.ollamaTranslator.translatedNodes.size === 0) {
        this.logStatus('No translated content to retranslate.');
        return;
      }
      
      if (window.ollamaTranslator.isTranslating) {
        this.logStatus('Translation already in progress...');
        return;
      }

      this.translationEngine.clearCache();
      this.translationEngine.resetConversation();
      
      const nodesToRetranslate = [];
      window.ollamaTranslator.translatedNodes.forEach(node => {
        if (node && node.parentElement && node.ollamaId) {
          const textData = window.ollamaTranslator.originalTextMap.get(node.ollamaId);
          if (textData) {
            node.nodeValue = textData.original;
            nodesToRetranslate.push(node);
            window.ollamaTranslator.processedNodes.delete(node);
          }
        }
      });
      
      window.ollamaTranslator.translatedNodes.clear();
      
      this.logStatus(`Retranslating ${nodesToRetranslate.length} segments with current settings...`);
      
      await window.ollamaTranslator.runTranslation();
    };

    container.appendChild(this.instructionInput);
    container.appendChild(instructionControls);
  }

  createMainButtons(container) {
    // Create button rows
    const row1 = document.createElement('div');
    const row2 = document.createElement('div');
    const row3 = document.createElement('div');
    
    for (const r of [row1, row2, row3]) {
      Object.assign(r.style, { display: 'flex', gap: '4px', width: '100%' });
    }

    // Row 1: Main action buttons
    const btnTranslate = document.createElement('button');
    btnTranslate.className = 'ollama-no-drag';
    btnTranslate.textContent = '🌐 Translate';
    this.styleButton(btnTranslate);

    const btnConversation = document.createElement('button');
    btnConversation.className = 'ollama-no-drag';
    btnConversation.textContent = '💬 Conversation';
    this.styleButton(btnConversation);
    btnConversation.style.background = window.ollamaTranslator.useConversationMode ? '#2a7' : '#444';

    const btnInstruction = document.createElement('button');
    btnInstruction.className = 'ollama-no-drag';
    btnInstruction.textContent = '⚙️ Instructions';
    this.styleButton(btnInstruction);

    // Row 2: Toggle and utility buttons
    const btnToggleText = document.createElement('button');
    btnToggleText.className = 'ollama-no-drag';
    btnToggleText.textContent = '🔁 Show Original';
    this.styleButton(btnToggleText);

    const btnReview = document.createElement('button');
    btnReview.className = 'ollama-no-drag';
    btnReview.textContent = '✏️ Review';
    this.styleButton(btnReview);

    const btnReverse = document.createElement('button');
    btnReverse.className = 'ollama-no-drag';
    btnReverse.textContent = '🔄 Reverse';
    this.styleButton(btnReverse);

    // Row 3: Utility buttons
    const btnLogs = document.createElement('button');
    btnLogs.className = 'ollama-no-drag';
    btnLogs.textContent = '📜 Logs';
    this.styleButton(btnLogs);

    const btnExport = document.createElement('button');
    btnExport.className = 'ollama-no-drag';
    btnExport.textContent = '💾 Export';
    this.styleButton(btnExport);

    const btnOCR = document.createElement('button');
    btnOCR.className = 'ollama-no-drag';
    btnOCR.textContent = '📷 OCR';
    this.styleButton(btnOCR);

    // Event handlers
    btnTranslate.onclick = () => {
      if (!window.ollamaTranslator.isTranslating) {
        window.ollamaTranslator.runTranslation();
      }
    };

    btnConversation.onclick = () => {
      window.ollamaTranslator.useConversationMode = !window.ollamaTranslator.useConversationMode;
      btnConversation.style.background = window.ollamaTranslator.useConversationMode ? '#2a7' : '#444';
      btnConversation.textContent = window.ollamaTranslator.useConversationMode ? '💬 Conversation' : '💬 Individual';
      
      if (!window.ollamaTranslator.useConversationMode) {
        this.translationEngine.resetConversation();
      }
      
      this.logStatus(`Conversation mode ${window.ollamaTranslator.useConversationMode ? 'enabled' : 'disabled'}`);
    };

    btnInstruction.onclick = () => {
      const show = this.instructionInput.style.display === 'none';
      this.instructionInput.style.display = show ? 'block' : 'none';
      const instructionControls = this.instructionInput.nextElementSibling;
      instructionControls.style.display = show ? 'flex' : 'none';
      btnInstruction.style.background = show ? '#2a7' : '#444';
    };

    btnToggleText.onclick = () => {
      window.ollamaTranslator.toggleOriginalText();
      // Update button text based on current state
      btnToggleText.textContent = window.ollamaTranslator.isShowingOriginal ? '🔁 Show Translation' : '🔁 Show Original';
    };

    btnReview.onclick = () => {
      this.inlineReview = !this.inlineReview;
      btnReview.style.background = this.inlineReview ? '#2a7' : '#444';
      this.logStatus(`Inline review ${this.inlineReview ? 'enabled' : 'disabled'}`);
      
      if (this.inlineReview) {
        this.showReviewInstructions();
      }
    };

    btnReverse.onclick = () => {
      this.toggleReversePanel();
    };

    btnLogs.onclick = () => {
      this.showLogs = !this.showLogs;
      btnLogs.style.background = this.showLogs ? '#2a7' : '#444';
      this.translationEngine.showLogs = this.showLogs;
      console.log(`🔧 Logs ${this.showLogs ? 'enabled' : 'disabled'}`);
      this.logStatus(`Debug logs ${this.showLogs ? 'enabled' : 'disabled'}`);
      this.updateHighlighting();
    };

    btnExport.onclick = () => {
      this.exportTranslations();
    };

    btnOCR.onclick = () => {
      this.ocrHandler.startOCRSelection();
    };

    // Arrange buttons in rows
    row1.append(btnTranslate, btnConversation, btnInstruction);
    row2.append(btnToggleText, btnReview, btnReverse);
    row3.append(btnLogs, btnExport, btnOCR);

    container.appendChild(row1);
    container.appendChild(row2);
    container.appendChild(row3);
  }

  showReviewInstructions() {
    const instructions = document.createElement('div');
    Object.assign(instructions.style, {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      background: '#222',
      color: '#fff',
      padding: '20px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '1000000',
      maxWidth: '400px',
      textAlign: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    instructions.innerHTML = `
      <h3 style="margin: 0 0 15px 0;">✏️ Review Mode Instructions</h3>
      <p style="margin: 0 0 10px 0;">When review mode is enabled:</p>
      <ul style="text-align: left; margin: 0 0 15px 0;">
        <li>New translations will show inline editing controls</li>
        <li>You can edit translations before accepting them</li>
        <li>Click ✅ to accept or ❌ to reject changes</li>
        <li>Existing translations are not affected</li>
      </ul>
      <button onclick="this.parentElement.remove()" style="
        background: #4CAF50; 
        color: white; 
        border: none; 
        padding: 8px 16px; 
        border-radius: 4px; 
        cursor: pointer;
      ">Got it!</button>
    `;

    document.body.appendChild(instructions);

    setTimeout(() => {
      if (instructions.parentElement) {
        instructions.remove();
      }
    }, 10000);
  }

  createReverseTranslationPanel() {
    const reversePanel = document.createElement('div');
    reversePanel.className = 'ollama-reverse-panel';
    
    // Create header with close button
    const header = document.createElement('div');
    header.className = 'ollama-reverse-header';
    
    const title = document.createElement('div');
    title.className = 'ollama-reverse-title ollama-draggable';
    title.textContent = '🔄 Reverse Translation';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'ollama-close-btn ollama-no-drag';
    closeBtn.textContent = '×';
    closeBtn.onclick = () => {
      reversePanel.style.display = 'none';
    };
    
    header.appendChild(title);
    header.appendChild(closeBtn);

    const revInput = document.createElement('textarea');
    revInput.className = 'ollama-no-drag';
    revInput.placeholder = 'Type English text to translate...';
    Object.assign(revInput.style, {
      width: '100%', height: '60px',
      background: '#333', color: '#fff',
      border: '1px solid #555', borderRadius: '4px',
      padding: '4px', fontSize: '12px', resize: 'vertical',
      marginBottom: '8px'
    });

    const revButton = document.createElement('button');
    revButton.className = 'ollama-no-drag';
    revButton.textContent = 'Translate to ' + (window.ollamaTranslator.sourceLang || 'Original Language');
    Object.assign(revButton.style, {
      width: '100%',
      margin: '4px 0', padding: '6px 8px',
      background: '#4caf50', border: 'none',
      borderRadius: '4px', color: '#fff',
      cursor: 'pointer', outline: 'none'
    });

    const revOutput = document.createElement('textarea');
    revOutput.className = 'ollama-no-drag';
    revOutput.readOnly = true;
    Object.assign(revOutput.style, {
      width: '100%', height: '60px',
      background: '#333', color: '#fff',
      border: '1px solid #555', borderRadius: '4px',
      padding: '4px', fontSize: '12px', resize: 'vertical',
      marginTop: '8px'
    });

    revButton.onclick = async () => {
      const txt = revInput.value.trim();
      if (!txt) return;
      
      if (!window.ollamaTranslator.sourceLang) {
        revOutput.value = '❌ Please translate the page first to detect the source language.';
        return;
      }
      
      const userContext = this.contextInput.value.trim();
      const cacheKey = Utils.getCacheKey(`reverse:${txt}`, userContext + window.ollamaTranslator.sourceLang, 'reverse');
      
      if (this.translationEngine.translationCache.has(cacheKey)) {
        revOutput.value = this.translationEngine.translationCache.get(cacheKey);
        return;
      }
      
      revButton.disabled = true;
      revButton.textContent = '…';
      
      try {
        let prompt = '';
        if (userContext) {
          prompt += `Context: ${userContext}\n\n`;
        }
        prompt += `Translate the following English text into ${window.ollamaTranslator.sourceLang}. Respond only with the translation:\n\n"${txt}"`;

        const { response } = await this.translationEngine.requestTranslation({
          model: window.ollamaTranslator.model,
          prompt: prompt,
          stream: false
        });

        let translated = Utils.cleanTranslationResponse(response);
        revOutput.value = translated;
        this.translationEngine.translationCache.set(cacheKey, translated);
      } catch (e) {
        revOutput.value = '❌ ' + e.message;
      } finally {
        revButton.disabled = false;
        revButton.textContent = 'Translate to ' + window.ollamaTranslator.sourceLang;
      }
    };

    reversePanel.append(header, revInput, revButton, revOutput);
    document.body.appendChild(reversePanel);
    
    // Make the panel draggable
    this.makeDraggable(reversePanel);
    
    this.reversePanel = reversePanel;
    this.revButton = revButton;
  }

  createStatusAndProgress(container) {
    this.status = document.createElement('div');
    this.status.className = 'ollama-draggable';
    this.status.style = 'margin-top:6px;font-size:12px;padding:2px 0;';

    const progress = document.createElement('div');
    Object.assign(progress.style, {
      marginTop: '4px', height: '6px', background: '#555',
      borderRadius: '4px', overflow: 'hidden'
    });
    
    this.progressBar = document.createElement('div');
    Object.assign(this.progressBar.style, {
      height: '100%', width: '0%', background: '#4caf50',
      transition: 'width 0.3s ease'
    });
    
    progress.appendChild(this.progressBar);
    container.append(this.status, progress);
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 't':
            e.preventDefault();
            if (!window.ollamaTranslator.isTranslating) {
              window.ollamaTranslator.runTranslation();
            }
            break;
          case 'o':
            e.preventDefault();
            window.ollamaTranslator.toggleOriginalText();
            break;
          case 'l':
            e.preventDefault();
            this.showLogs = !this.showLogs;
            this.translationEngine.showLogs = this.showLogs;
            this.logStatus(`Debug logs ${this.showLogs ? 'enabled' : 'disabled'}`);
            break;
          case 'r':
            e.preventDefault();
            this.ocrHandler.startOCRSelection();
            break;
        }
      }
    });

    // Message listener for selected text translation
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === "translate-selected-text") {
        this.translateSelectedText(msg.selectedText);
      }
    });
  }

  async translateSelectedText(textToTranslate) {
    if (!textToTranslate) {
      this.logStatus('No text provided for translation.');
      return;
    }

    this.logStatus('Translating selection...');

    if (this.showLogs) {
      Utils.logWithGroup('🎯 Selection Translation', { text: textToTranslate });
    }

    try {
      const userContext = this.contextInput.value.trim();
      const translated = await this.translationEngine.translateTextWithContext(
        textToTranslate, 
        userContext, 
        this.currentTranslateInstruction, 
        false
      );

      this.showSelectionPopup(textToTranslate, translated);
      
      if (window.ollamaTranslator.translationLog) {
        window.ollamaTranslator.translationLog.push({ 
          original: textToTranslate, 
          translated: translated 
        });
      }

      this.logStatus('Selection translated via context menu.');
    } catch (err) {
      console.error('❌ Translation error:', err);
      this.logStatus('Translation failed: ' + err.message);
    }
  }

  showSelectionPopup(originalText, translatedText) {
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position: 'fixed',
      zIndex: 10000,
      background: '#222',
      color: '#fff',
      padding: '15px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      maxWidth: '350px',
      fontSize: '14px',
      lineHeight: '1.4',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    });

    // Make popup draggable
    this.makeDraggable(popup);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    
    try {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          targetX = rect.left + rect.width / 2;
          targetY = rect.bottom + 10;
        }
      }
    } catch (e) {
      console.warn('Could not get selection coordinates:', e);
    }

    const popupWidth = 350;
    const popupHeight = 150;
    popup.style.left = `${Math.max(10, Math.min(targetX - popupWidth / 2, window.innerWidth - popupWidth - 10))}px`;
    popup.style.top = `${Math.max(10, Math.min(targetY, window.innerHeight - popupHeight - 10))}px`;

    // Add draggable header
    const dragHeader = document.createElement('div');
    dragHeader.className = 'ollama-draggable';
    dragHeader.textContent = '🌐 Selection Translation';
    Object.assign(dragHeader.style, {
      fontWeight: 'bold',
      marginBottom: '10px',
      cursor: 'move',
      userSelect: 'none',
      padding: '4px 0',
      borderBottom: '1px solid #555'
    });

    const originalDiv = document.createElement('div');
    originalDiv.textContent = originalText;
    Object.assign(originalDiv.style, {
      color: '#aaa',
      marginBottom: '10px',
      fontStyle: 'italic',
      fontSize: '12px'
    });

    const translatedDiv = document.createElement('div');
    translatedDiv.textContent = translatedText;
    Object.assign(translatedDiv.style, {
      marginBottom: '10px'
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'ollama-no-drag';
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      background: '#666',
      border: 'none',
      color: '#fff',
      width: '20px',
      height: '20px',
      borderRadius: '3px',
      cursor: 'pointer',
      fontSize: '14px'
    });
    closeBtn.onclick = () => popup.remove();

    setTimeout(() => {
      if (popup.parentElement) {
        popup.remove();
      }
    }, 15000);

    popup.append(dragHeader, closeBtn, originalDiv, translatedDiv);
    document.body.appendChild(popup);
  }

  toggleReversePanel() {
    const show = this.reversePanel.style.display === 'none';
    this.reversePanel.style.display = show ? 'block' : 'none';
    
    if (show) {
      const rect = this.toolbar.getBoundingClientRect();
      this.reversePanel.style.left = `${Math.min(rect.right + 10, window.innerWidth - 300)}px`;
      this.reversePanel.style.top = `${rect.top}px`;
      this.revButton.textContent = 'Translate to ' + (window.ollamaTranslator.sourceLang || 'Original Language');
    }
  }

  exportTranslations() {
    const data = window.ollamaTranslator.translationLog;
    const json = JSON.stringify(data, null, 2);
    const csv = [
      ['original', 'translated'],
      ...data.map(o => [o.original, o.translated])
    ]
      .map(r => r.map(s => `"${s.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const a1 = document.createElement('a');
    a1.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a1.download = 'translation-log.json';
    a1.click();
    
    const a2 = document.createElement('a');
    a2.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a2.download = 'translation-log.csv';
    a2.click();
    
    this.logStatus(`Exported ${data.length} translations to JSON and CSV files.`);
  }

  styleButton(button) {
    Object.assign(button.style, {
      margin: '3px',
      padding: '5px 10px',
      border: 'none',
      borderRadius: '4px',
      background: '#444',
      color: '#fff',
      cursor: 'pointer',
      flex: '1 1 auto',
      outline: 'none',
      fontSize: '12px'
    });
  }

  updateCollapsed() {
      const header = this.toolbar.querySelector('div');
      const container = this.toolbar.querySelector('div:nth-child(2)');
      const toggleBtn = this.toolbar.querySelector('button');
    
      if (this.collapsed) {
        // Position in top-left corner, not docked to edge
        this.toolbar.style.top = '20px';
        this.toolbar.style.left = '20px';
        this.toolbar.style.right = 'auto';
        this.toolbar.style.cursor = 'pointer';
        this.toolbar.style.padding = '4px';
        this.toolbar.style.width = '32px';
        this.toolbar.style.height = '32px';
        this.toolbar.style.borderRadius = '50%';
    
        header.style.display = 'none';
        container.style.display = 'none';
    
        Object.assign(toggleBtn.style, {
          position: 'static',
          width: '100%',
          height: '100%',
          padding: '0',
          fontSize: '18px',
          lineHeight: '1',
          background: 'transparent',
          border: 'none',
          borderRadius: '50%'
        });
        
        // Use globe emoji for collapsed state
        toggleBtn.innerHTML = '<div class="ollama-globe-icon">🌐</div>';
        
      } else {
        this.toolbar.style.cursor = 'move';
        this.toolbar.style.padding = '8px';
        this.toolbar.style.width = 'auto';
        this.toolbar.style.height = 'auto';
        this.toolbar.style.borderRadius = '8px';
    
        header.style.display = '';
        container.style.display = '';
    
        Object.assign(toggleBtn.style, {
          position: 'absolute',
          right: '10px',
          top: '10px',
          width: '20px',
          height: '20px',
          padding: '2px',
          fontSize: '12px',
          lineHeight: '1',
          background: '#444',
          border: 'none',
          borderRadius: '3px'
        });
        toggleBtn.textContent = '▼';
    
        this.ensureInView();
      }
    }

  ensureInView() {
    const r = this.toolbar.getBoundingClientRect();
    let x = r.left, y = r.top;
    if (r.right > innerWidth) x = innerWidth - r.width - 10;
    if (r.bottom > innerHeight) y = innerHeight - r.height - 10;
    if (r.left < 0) x = 10;
    if (r.top < 0) y = 10;
    this.toolbar.style.left = x + 'px';
    this.toolbar.style.top = y + 'px';
  }

  updateHighlighting() {
    if (this.showLogs) {
      console.log(`🎨 Updating highlighting, showLogs=${this.showLogs}, nodes=${window.ollamaTranslator.translatedNodes.size}`);
    }

    window.ollamaTranslator.translatedNodes.forEach(node => {
      if (node && node.parentElement) {
        if (this.showLogs) {
          node.parentElement.classList.add('ollama-highlight');
        } else {
          node.parentElement.classList.remove('ollama-highlight');
        }
      }
    });
  }

  updateProgress(pct) {
    this.progressBar.style.width = `${pct}%`;
  }

  logStatus(msg) {
    console.log(`[Ollama Translator] ${msg}`);
    this.status.textContent = msg;
  }

  getContextInput() {
    return this.contextInput.value.trim();
  }

  getCurrentTranslateInstruction() {
    return this.currentTranslateInstruction;
  }

  getInlineReview() {
    return this.inlineReview;
  }

  cleanup() {
    if (this.toolbar && this.toolbar.parentNode) {
      this.toolbar.remove();
    }
    
    if (this.reversePanel && this.reversePanel.parentNode) {
      this.reversePanel.remove();
    }
    
    // Clean up any draggable elements
    document.querySelectorAll('[data-ollama-draggable]').forEach(el => {
      if (el._dragCleanup) {
        el._dragCleanup();
      }
    });
  }
}

// Make UIManager globally available
window.UIManager = UIManager;