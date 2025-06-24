// Main content script - orchestrates all components - FIXED VERSION
(() => {
  'use strict';

  // Store original history methods at top level
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  // Setup cleanup immediately - before any conditional logic
  window.addEventListener('beforeunload', () => {
    console.log('🧹 Cleaning up extension resources');
    
    if (window.ollamaTranslator?.cleanupObserver) {
      window.ollamaTranslator.cleanupObserver.disconnect();
    }
    
    if (window.ollamaTranslator?.contentObserver) {
      window.ollamaTranslator.contentObserver.disconnect();
    }
    
    if (window.ollamaTranslator?.intersectionObserver) {
      window.ollamaTranslator.intersectionObserver.disconnect();
    }
    
    if (window.ollamaTranslator?.autoTranslateTimeout) {
      clearTimeout(window.ollamaTranslator.autoTranslateTimeout);
    }
    
    if (window.ollamaTranslator?.translationEngine) {
      window.ollamaTranslator.translationEngine.resetConversation();
    }
    
    if (window.ollamaTranslator?.ocrHandler) {
      window.ollamaTranslator.ocrHandler.cleanup();
    }
    
    if (window.ollamaTranslator?.uiManager) {
      window.ollamaTranslator.uiManager.cleanup();
    }
    
    // Restore original history methods
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  });

  // Global namespace
  window.ollamaTranslator = {
      // Configuration - these will be overridden by loadConfiguration()
      ollamaUrl: 'http://localhost:11434/api/generate', // Default fallback
      model: 'llama3.2:latest', // Default fallback
      delayMs: 300, // Default fallback
      useConversationMode: true, // Default fallback
      
      // State
      sourceLang: '',
      originalTextMap: new Map(),
      translatedNodes: new Set(),
      translationLog: [],
      processedNodes: new WeakSet(),
      isTranslating: false,
      isShowingOriginal: false,
      hasTranslatedCurrentPage: false,
      
      // Components
      translationEngine: null,
      ocrHandler: null,
      uiManager: null,
      
      // Observers
      cleanupObserver: null,
      contentObserver: null,
      visibleNodes: new Set(),
      intersectionObserver: null,
      
      // Navigation tracking
      currentUrl: window.location.href,
      autoTranslateTimeout: null,
      
      // Initialization state
      isInitialized: false,
      initializationPromise: null
  };

  // --- EXCLUDED DOMAINS CONFIGURATION ---
  let excludedDomains = [];

  function isDomainExcluded() {
    const hostname = window.location.hostname;
    for (const domain of excludedDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }
    return false;
  }

  // Check for library availability before proceeding
  function checkLibraryAvailability() {
    const missingLibraries = [];
    
    if (typeof window.Tesseract === 'undefined') {
      missingLibraries.push('Tesseract.js');
    }
    
    if (typeof window.html2canvas === 'undefined') {
      missingLibraries.push('html2canvas');
    }
    
    if (missingLibraries.length > 0) {
      console.warn('Ollama Translator: Missing libraries:', missingLibraries);
      console.warn('Some features may not work properly');
    }
    
    return missingLibraries.length === 0;
  }

  chrome.storage.sync.get(['excludedDomains'], (result) => {
    excludedDomains = result.excludedDomains || [];
    console.log('Ollama Translator: Excluded domains loaded:', excludedDomains);

    if (isDomainExcluded()) {
      console.log('Ollama Translator: Current domain is excluded. Extension will not run.');
      return;
    }

    // Check library availability
    const librariesAvailable = checkLibraryAvailability();
    
    // Initialize even if some libraries are missing (graceful degradation)
    initializeExtension(librariesAvailable);
  });

  function initializeExtension(librariesAvailable = true) {
      if (window.ollamaTranslator.isInitialized) {
        console.log('Ollama Translator: Already initialized');
        return;
      }
      
      // Prevent multiple initialization attempts
      if (window.ollamaTranslator.initializationPromise) {
        return window.ollamaTranslator.initializationPromise;
      }
      
      window.ollamaTranslator.initializationPromise = new Promise((resolve, reject) => {
        try {
          console.log('🌐 Initializing Ollama Translator Enhanced');
          
          // Load configuration first, then initialize components
          chrome.storage.sync.get([
            'ollamaUrl', 'ollamaModel', 'translationDelay', 
            'maxRetries', 'useAggressiveBypass', 'bypassMode',
            'useConversationMode', 'showLogs'
          ], (result) => {
            try {
              // Update configuration
              if (result.ollamaUrl) window.ollamaTranslator.ollamaUrl = result.ollamaUrl;
              if (result.ollamaModel) window.ollamaTranslator.model = result.ollamaModel;
              if (result.translationDelay !== undefined) window.ollamaTranslator.delayMs = result.translationDelay;
              if (result.useConversationMode !== undefined) window.ollamaTranslator.useConversationMode = result.useConversationMode;
              
              console.log('Ollama Translator: Configuration loaded');
              console.log('- URL:', window.ollamaTranslator.ollamaUrl);
              console.log('- Model:', window.ollamaTranslator.model);
              console.log('- Delay:', window.ollamaTranslator.delayMs + 'ms');
              console.log('- Conversation Mode:', window.ollamaTranslator.useConversationMode);
              console.log('- Libraries Available:', librariesAvailable);
              
              // Initialize components with loaded settings
              initializeComponents(librariesAvailable);
              
              // Update translation engine settings
              if (window.ollamaTranslator.translationEngine) {
                window.ollamaTranslator.translationEngine.updateSettings({
                  maxRetries: result.maxRetries || 3,
                  useAggressiveBypass: result.useAggressiveBypass !== undefined ? result.useAggressiveBypass : true,
                  bypassMode: result.bypassMode || 'translation',
                  showLogs: false // Start with logs disabled, controlled by UI button
                });
              }
              
              // Setup observers
              setupObservers();
              
              // Setup navigation tracking
              setupNavigationTracking();
      
              // Setup message listeners
              setupMessageListeners();
              
              window.ollamaTranslator.isInitialized = true;
              console.log('✅ Ollama Translator Enhanced initialized successfully');
              resolve();
            } catch (error) {
              console.error('❌ Failed to initialize Ollama Translator:', error);
              reject(error);
            }
          });
        } catch (error) {
          console.error('❌ Failed to initialize Ollama Translator:', error);
          reject(error);
        }
      });
      
      return window.ollamaTranslator.initializationPromise;
  }

  function initializeComponents(librariesAvailable) {
      // Initialize translation engine
      window.ollamaTranslator.translationEngine = new TranslationEngine();
      
      // Initialize OCR handler only if libraries are available
      if (librariesAvailable) {
        window.ollamaTranslator.ocrHandler = new OCRHandler();
      } else {
        console.warn('OCR functionality disabled due to missing libraries');
        // Create a stub OCR handler
        window.ollamaTranslator.ocrHandler = {
          startOCRSelection: () => {
            alert('OCR functionality is not available. Required libraries are missing.');
          },
          cleanup: () => {}
        };
      }
      
      // Initialize UI manager
      window.ollamaTranslator.uiManager = new UIManager(
          window.ollamaTranslator.translationEngine,
          window.ollamaTranslator.ocrHandler
      );
      
      console.log('📦 Components initialized');
  }

  function setupObservers() {
    // Cleanup observer for removed nodes
    window.ollamaTranslator.cleanupObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          cleanupRemovedNodes(node);
        });
      });
    });

    window.ollamaTranslator.cleanupObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Content observer for new nodes - IMPROVED VERSION
    window.ollamaTranslator.contentObserver = new MutationObserver((mutations) => {
      if (window.ollamaTranslator.isTranslating) return;
      
      let hasNewContent = false;
      let newNodeCount = 0;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const txt = node.nodeValue.trim();
            if (txt.length > 2 && !/^[\x00-\x7F]+$/.test(txt) && !window.ollamaTranslator.processedNodes.has(node)) {
              hasNewContent = true;
              newNodeCount++;
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Skip if it's part of our extension UI
            if (node.id === 'ollama-translator-toolbar' || node.closest('#ollama-translator-toolbar')) {
              return;
            }
            
            const walker = document.createTreeWalker(
              node,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: n => {
                  const txt = n.nodeValue.trim();
                  if (txt.length > 2 && !/^[\x00-\x7F]+$/.test(txt) && !window.ollamaTranslator.processedNodes.has(n)) {
                    return NodeFilter.FILTER_ACCEPT;
                  }
                  return NodeFilter.FILTER_REJECT;
                }
              }
            );
            
            let textNode;
            while ((textNode = walker.nextNode())) {
              hasNewContent = true;
              newNodeCount++;
              if (newNodeCount > 10) break; // Limit checking to avoid performance issues
            }
          }
        });
      });
      
      if (hasNewContent && newNodeCount > 0) {
        clearTimeout(window.ollamaTranslator.autoTranslateTimeout);
        window.ollamaTranslator.autoTranslateTimeout = setTimeout(() => {
          if (window.ollamaTranslator.hasTranslatedCurrentPage && window.ollamaTranslator.translatedNodes.size > 0) {
            console.log(`New content detected (${newNodeCount} nodes), auto-translating...`);
            window.ollamaTranslator.runTranslation(true);
          }
        }, 2000);
      }
    });

    window.ollamaTranslator.contentObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Intersection observer for visible nodes - IMPROVED VERSION
    window.ollamaTranslator.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          window.ollamaTranslator.visibleNodes.add(entry.target);
        } else {
          window.ollamaTranslator.visibleNodes.delete(entry.target);
        }
      });
    }, {
      rootMargin: '100px',
      threshold: 0.1
    });

    console.log('👁️ Observers setup complete');
  }

  function setupNavigationTracking() {
    // Check for navigation changes
    function checkForNavigation() {
      const newUrl = window.location.href;
      if (newUrl !== window.ollamaTranslator.currentUrl) {
        console.log('Ollama Translator: Navigation detected', window.ollamaTranslator.currentUrl, '->', newUrl);
        window.ollamaTranslator.currentUrl = newUrl;
        resetExtensionState();
      }
    }

    setInterval(checkForNavigation, 1000);

    window.addEventListener('popstate', () => {
      setTimeout(checkForNavigation, 100);
    });

    // Override history methods
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(checkForNavigation, 100);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(checkForNavigation, 100);
    };

    console.log('🧭 Navigation tracking setup complete');
  }

  // Fixed message listeners
  function setupMessageListeners() {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
          console.log('Content script received message:', msg.action);
          
          if (msg.action === 'ping') {
              sendResponse({status: 'active'});
              return true;
          }
          
          if (msg.action === "translate-selected-text") {
              console.log('Processing selected text translation:', msg.selectedText?.substring(0, 50) + '...');
              if (window.ollamaTranslator.uiManager) {
                  window.ollamaTranslator.uiManager.translateSelectedText(msg.selectedText);
              }
              sendResponse({status: 'processing'});
              return true;
          }
          
          if (msg.action === 'start-ocr') {
              console.log('Starting OCR selection...');
              if (window.ollamaTranslator.ocrHandler && window.ollamaTranslator.ocrHandler.startOCRSelection) {
                  window.ollamaTranslator.ocrHandler.startOCRSelection();
              }
              sendResponse({status: 'ocr-started'});
              return true;
          }
          
          return false;
      });
      console.log('📨 Message listeners setup complete');
  }

  function resetExtensionState() {
    console.log('Ollama Translator: Resetting state for new page');
    
    window.ollamaTranslator.sourceLang = '';
    window.ollamaTranslator.originalTextMap.clear();
    window.ollamaTranslator.translatedNodes.clear();
    window.ollamaTranslator.translationLog = [];
    window.ollamaTranslator.hasTranslatedCurrentPage = false;
    window.ollamaTranslator.isShowingOriginal = false;
    window.ollamaTranslator.processedNodes = new WeakSet();
    window.ollamaTranslator.visibleNodes.clear();
    
    // Reset components
    if (window.ollamaTranslator.translationEngine) {
      window.ollamaTranslator.translationEngine.resetConversation();
      window.ollamaTranslator.translationEngine.clearCache();
    }
    
    if (window.ollamaTranslator.uiManager) {
      window.ollamaTranslator.uiManager.updateProgress(0);
      window.ollamaTranslator.uiManager.logStatus('Extension ready for new page');
    }
    
    if (window.ollamaTranslator.autoTranslateTimeout) {
      clearTimeout(window.ollamaTranslator.autoTranslateTimeout);
      window.ollamaTranslator.autoTranslateTimeout = null;
    }
  }

  function cleanupRemovedNodes(node) {
    if (node.nodeType === Node.TEXT_NODE && node.ollamaId) {
      window.ollamaTranslator.originalTextMap.delete(node.ollamaId);
      window.ollamaTranslator.translatedNodes.delete(node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Clean up visible nodes tracking
      window.ollamaTranslator.visibleNodes.delete(node);
      
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (textNode.ollamaId) {
          window.ollamaTranslator.originalTextMap.delete(textNode.ollamaId);
          window.ollamaTranslator.translatedNodes.delete(textNode);
        }
      }
    }
  }

  // Main translation function - IMPROVED VERSION
  window.ollamaTranslator.runTranslation = async function(isAutoTranslation = false) {
    const now = Date.now();
    const DEBOUNCE_DELAY = 1000;
    
    if (window.ollamaTranslator.isTranslating || (now - (window.ollamaTranslator.lastTranslationTime || 0) < DEBOUNCE_DELAY && !isAutoTranslation)) {
      if (!isAutoTranslation) {
        window.ollamaTranslator.uiManager.logStatus('Translation in progress or too soon since last translation...');
      }
      return;
    }
    
    window.ollamaTranslator.isTranslating = true;
    window.ollamaTranslator.lastTranslationTime = now;
    
    try {
      window.ollamaTranslator.uiManager.logStatus(isAutoTranslation ? 'Auto-translating new content...' : 'Starting translation...');
      
      if (window.ollamaTranslator.translationEngine.showLogs) {
        Utils.logWithGroup('🌐 Translation Session Started', {
          autoTranslation: isAutoTranslation,
          conversationMode: window.ollamaTranslator.useConversationMode,
          aggressiveBypass: window.ollamaTranslator.translationEngine.useAggressiveBypass
        });
      }

      console.log('🔍 About to call Utils.getTextNodes...');
      console.log('🔍 visibleNodes size:', window.ollamaTranslator.visibleNodes.size);
      
      const allNodes = Utils.getTextNodes(false, window.ollamaTranslator.visibleNodes);
      console.log('🔍 Utils.getTextNodes returned:', allNodes.length, 'nodes');
      
      const nodes = allNodes.filter(n => {
        const txt = n.nodeValue.trim();
        
        if (window.ollamaTranslator.processedNodes.has(n)) {
          return false;
        }
        return txt.length > 2 && !/^[\x00-\x7F]+$/.test(txt);
      });
      
      console.log('🔍 After filtering:', nodes.length, 'nodes');

      if (nodes.length === 0) {
        window.ollamaTranslator.uiManager.logStatus(isAutoTranslation ? 'No new content to translate.' : 'No non-ASCII text found.');
        return;
      }

      if (window.ollamaTranslator.translationEngine.showLogs) {
        console.log(`📝 Found ${nodes.length} text nodes to translate`);
      }

      // Detect language if needed
      if (!window.ollamaTranslator.sourceLang || !isAutoTranslation) {
        const sample = nodes.slice(0, 5).map(n => n.nodeValue.trim()).join(' ');
        if (window.ollamaTranslator.translationEngine.showLogs) {
          console.log('🔍 Detecting language from sample:', sample.substring(0, 100) + '...');
        }
        
        window.ollamaTranslator.sourceLang = await window.ollamaTranslator.translationEngine.detectLanguage(
          sample, 
          window.ollamaTranslator.uiManager.getCurrentTranslateInstruction()
        );
        
        window.ollamaTranslator.uiManager.logStatus(`Detected: ${window.ollamaTranslator.sourceLang}`);
        
        if (window.ollamaTranslator.uiManager.revButton) {
          window.ollamaTranslator.uiManager.revButton.textContent = 'Translate to ' + window.ollamaTranslator.sourceLang;
        }
      }

      window.ollamaTranslator.uiManager.logStatus(`Translating ${nodes.length} segments with enhanced bypass…`);
      window.ollamaTranslator.uiManager.updateProgress(0);

      let completed = 0;
      let failed = 0;
      let batchSize = 5; // Process in smaller batches to avoid overwhelming the system
    
      // Process nodes in batches
      for (let i = 0; i < nodes.length; i += batchSize) {
        const batch = nodes.slice(i, Math.min(i + batchSize, nodes.length));
        
        // Process batch concurrently but with limited concurrency
        const batchPromises = batch.map(async (node, batchIndex) => {
          const globalIndex = i + batchIndex;
          const originalText = node.nodeValue.trim();
      
          window.ollamaTranslator.processedNodes.add(node);
      
          try {
            const userContext = window.ollamaTranslator.uiManager.getContextInput();
            const userInstructions = window.ollamaTranslator.uiManager.getCurrentTranslateInstruction();
            
            if (window.ollamaTranslator.translationEngine.showLogs) {
              Utils.logWithGroup(`📝 Smart translating node ${globalIndex + 1}/${nodes.length}`, {
                text: originalText.substring(0, 100) + (originalText.length > 100 ? '...' : '')
              });
            }
            
            const translated = await window.ollamaTranslator.translationEngine.translateWithLanguageDetection(
              originalText, 
              userContext, 
              userInstructions
            );
          
            // Only update the node if translation actually changed the text
            if (translated && translated !== originalText && !translated.startsWith('[Translation failed:')) {
                const nodeId = 'node_' + Date.now() + '_' + Math.random();
                window.ollamaTranslator.originalTextMap.set(nodeId, {
                original: originalText,
                translated: translated
                });
            
                node.ollamaId = nodeId;
                
                // Preserve formatting by maintaining line breaks and spacing
                const preservedTranslation = Utils.preserveFormatting(originalText, translated);
                
                // Apply the translation to the node
                node.nodeValue = preservedTranslation;
                
                window.ollamaTranslator.translatedNodes.add(node);
            
                if (window.ollamaTranslator.translationEngine.showLogs && node.parentElement) {
                node.parentElement.classList.add('ollama-highlight');
                }
            
                if (window.ollamaTranslator.uiManager.getInlineReview()) {
                reviewNode(node, originalText, preservedTranslation);
                } else {
                const p = node.parentElement;
                if (p && !p.dataset.originalTitle) {
                    p.title = originalText;
                    p.dataset.originalTitle = originalText;
                }
                }
            
                window.ollamaTranslator.translationLog.push({ original: originalText, translated: preservedTranslation });
                return { success: true };
            } else {
                // Text didn't need translation or translation failed
                if (translated === originalText) {
                if (window.ollamaTranslator.translationEngine.showLogs) {
                    console.log('ℹ️ Text already in English, skipping:', originalText.substring(0, 50) + '...');
                }
                return { success: true }; // Count as successful (no translation needed)
                } else {
                return { success: false };
                }
            }
            
          } catch (err) {
            console.error(`❌ Translation error for node ${globalIndex + 1}:`, err);
            return { success: false, error: err.message };
          }
        });
        
        // Wait for batch to complete
        const batchResults = await Promise.all(batchPromises);
        
        // Count results
        batchResults.forEach(result => {
          if (result.success) {
            completed++;
          } else {
            failed++;
          }
        });
        
        // Update progress
        const progress = ((i + batch.length) / nodes.length) * 100;
        window.ollamaTranslator.uiManager.updateProgress(progress);
        window.ollamaTranslator.uiManager.logStatus(`Processing ${completed}/${nodes.length} segments… (${Math.round(progress)}%)`);
        
        // Add delay between batches to avoid overwhelming the system
        if (i + batchSize < nodes.length && window.ollamaTranslator.delayMs > 0) {
          await Utils.delay(Math.min(window.ollamaTranslator.delayMs, 100)); // Cap batch delay
        }
      }

      window.ollamaTranslator.hasTranslatedCurrentPage = true;

      // Close conversation after translation is complete
      if (window.ollamaTranslator.translationEngine.conversationActive && window.ollamaTranslator.useConversationMode) {
        window.ollamaTranslator.uiManager.logStatus('Translation complete, closing conversation...');
        window.ollamaTranslator.translationEngine.resetConversation();
        window.ollamaTranslator.translationEngine.clearCache();
      }

      window.ollamaTranslator.uiManager.updateProgress(100);
      const successRate = Math.round((completed / nodes.length) * 100);
      window.ollamaTranslator.uiManager.logStatus(`✅ Done! Translated ${completed}/${nodes.length} segments (${successRate}% success) with ${window.ollamaTranslator.translationEngine.useAggressiveBypass ? 'enhanced bypass' : 'standard mode'}.`);
      
    } finally {
      window.ollamaTranslator.isTranslating = false;
    }
  };

  // Toggle original text function
  window.ollamaTranslator.toggleOriginalText = function() {
    window.ollamaTranslator.isShowingOriginal = !window.ollamaTranslator.isShowingOriginal;
    let cnt = 0;
  
    if (window.ollamaTranslator.translationEngine.showLogs) {
      console.log(`🔁 Toggling to ${window.ollamaTranslator.isShowingOriginal ? 'original' : 'translated'} text`);
    }
  
    window.ollamaTranslator.translatedNodes.forEach(node => {
      if (!node || !node.parentElement) return;
  
      const nodeId = node.ollamaId;
      if (!nodeId) return;
  
      const textData = window.ollamaTranslator.originalTextMap.get(nodeId);
      if (!textData) return;
  
      if (window.ollamaTranslator.isShowingOriginal) {
        node.nodeValue = textData.original;
      } else {
        node.nodeValue = textData.translated;
      }
      cnt++;
    });
  
    // Update the button text in the UI
    const toggleBtn = document.querySelector('#ollama-translator-toolbar button[onclick*="toggleOriginalText"]');
    if (toggleBtn) {
      toggleBtn.textContent = window.ollamaTranslator.isShowingOriginal ? '🔁 Show Translation' : '🔁 Show Original';
    }
  
    window.ollamaTranslator.uiManager.logStatus(`🔁 Toggled ${cnt} segments. Now showing ${window.ollamaTranslator.isShowingOriginal ? 'original' : 'translated'} text.`);
  };

  // Review node function
  function reviewNode(node, original, translated) {
    const wrapper = document.createElement('span');
    Object.assign(wrapper.style, {
      background: '#333', padding: '2px', borderRadius: '4px'
    });
    
    const origEl = document.createElement('div');
    origEl.textContent = original;
    Object.assign(origEl.style, {
      textDecoration: 'line-through',
      opacity: '0.7', marginBottom: '4px'
    });
    
    const txtarea = document.createElement('textarea');
    txtarea.value = translated;
    Object.assign(txtarea.style, {
      width: '100%', minWidth: '150px', maxWidth: '300px',
      minHeight: '40px', background: '#222', color: '#fff',
      border: '1px solid #555', borderRadius: '4px',
      padding: '4px', marginBottom: '4px', fontSize: '12px'
    });
    
    const btnA = document.createElement('button');
    btnA.textContent = '✅';
    const btnR = document.createElement('button');
    btnR.textContent = '❌';
    
    for (const b of [btnA, btnR]) {
      Object.assign(b.style, {
        margin: '2px', padding: '2px 6px',
        border: 'none', borderRadius: '3px',
        background: '#444', color: '#fff', cursor: 'pointer'
      });
    }
    
    btnA.onclick = () => wrapper.replaceWith(document.createTextNode(txtarea.value));
    btnR.onclick = () => wrapper.replaceWith(document.createTextNode(original));
    
    wrapper.append(origEl, txtarea, btnA, btnR);
    node.parentElement.replaceChild(wrapper, node);
  }

})();