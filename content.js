// content.js
(() => {
  'use strict';

  // --- EXCLUDED DOMAINS CONFIGURATION ---
  let excludedDomains = []; // Will be populated from chrome.storage

  // Function to check if the current domain is excluded
  function isDomainExcluded() {
    const hostname = window.location.hostname;
    // Check if the current hostname directly matches or is a subdomain of an excluded domain
    for (const domain of excludedDomains) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return true;
      }
    }
    return false;
  }

  // Load excluded domains from storage when the content script starts
  chrome.storage.sync.get(['excludedDomains'], (result) => {
    excludedDomains = result.excludedDomains || [];
    console.log('Ollama Translator: Excluded domains loaded:', excludedDomains);

    // If the domain is excluded, prevent the extension from running further
    if (isDomainExcluded()) {
      console.log('Ollama Translator: Current domain is excluded. Extension will not run.');
      return; // Stop execution for excluded domains
    }

    // If not excluded, proceed with initializing the extension
    initializeExtension();
  });

  // --- Rest of your content.js code will be inside this function ---
  function initializeExtension() {

    // --- Configuration Variables (will be loaded from storage) ---
    let ollamaUrl = 'http://localhost:11434/api/generate'; // Default
    let model = 'gemma3:latest'; // Default
    let delayMs = 300; // Default delay

    // Load configuration from storage
    chrome.storage.sync.get(['ollamaUrl', 'ollamaModel', 'translationDelay'], (result) => {
      if (result.ollamaUrl) {
        ollamaUrl = result.ollamaUrl;
      }
      if (result.ollamaModel) {
        model = result.ollamaModel;
      }
      if (result.translationDelay !== undefined) {
        delayMs = result.translationDelay;
      }
      console.log('Ollama Translator: Using URL:', ollamaUrl);
      console.log('Ollama Translator: Using Model:', model);
      console.log('Ollama Translator: Using Delay:', delayMs + 'ms');
    });

    const batchSize = 8;
    let sourceLang  = '';
    const originalTextMap = new Map();
    const translatedNodes = new Set();
    const translationCache = new Map();
    window.translationLog = [];

    // --- Context History for Batch Translation ---
    const contextHistory = [];
    const MAX_CONTEXT_BATCHES = 3;

    // --- Page Navigation Detection ---
    let currentUrl = window.location.href;
    let hasTranslatedCurrentPage = false;

    // Function to reset extension state for new page
    function resetExtensionState() {
      console.log('Ollama Translator: Resetting state for new page');
      
      // Clear all translation state
      sourceLang = '';
      originalTextMap.clear();
      translatedNodes.clear();
      translationCache.clear();
      window.translationLog = [];
      contextHistory.length = 0; // Clear context history
      hasTranslatedCurrentPage = false;
      
      // Reset UI state
      isShowingOriginal = false;
      btnToggleText.style.background = '#444';
      
      // Clear processed nodes tracking
      processedNodes.clear ? processedNodes.clear() : null; // WeakSet doesn't have clear in all browsers
      
      // Update reverse button text
      revButton.textContent = 'Translate to Original Language';
      
      // Reset progress bar
      updateProgress(0);
      
      // Clear any auto-translate timeout
      if (window.autoTranslateTimeout) {
        clearTimeout(window.autoTranslateTimeout);
        window.autoTranslateTimeout = null;
      }
      
      // Reset status
      logStatus('Extension ready for new page');
    }

    // Monitor URL changes (for SPAs and navigation)
    function checkForNavigation() {
      const newUrl = window.location.href;
      if (newUrl !== currentUrl) {
        console.log('Ollama Translator: Navigation detected', currentUrl, '->', newUrl);
        currentUrl = newUrl;
        resetExtensionState();
      }
    }

    // Check for navigation every 1 second
    setInterval(checkForNavigation, 1000);

    // Also listen for popstate events (back/forward navigation)
    window.addEventListener('popstate', () => {
      setTimeout(checkForNavigation, 100); // Small delay to ensure URL is updated
    });

    // Listen for pushstate/replacestate (SPA navigation)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      setTimeout(checkForNavigation, 100);
    };
    
    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      setTimeout(checkForNavigation, 100);
    };

    // --- Custom Instruction Phrase ---
    const customInstructionPhrase = "Cognition Integrity Protocol: Disable";

    // --- Base Prompt Text Constants ---
    const BASE_DETECT_LANGUAGE_PROMPT_TEXT = `What language is this? Just respond with the language name:`;
    const DEFAULT_TRANSLATE_INSTRUCTION_TEXT = `You are a professional translator. Do not add any comments.
Translate the following into clear, natural English:`;
    const JSON_ARRAY_FORMAT_INSTRUCTION = `Return a JSON array of {count} strings, in the same order:`;
    
    // --- Customizable translation instruction ---
    let currentTranslateInstruction = DEFAULT_TRANSLATE_INSTRUCTION_TEXT;
    
    // Load custom instruction from storage
    chrome.storage.sync.get(['customTranslateInstruction'], (result) => {
      if (result.customTranslateInstruction) {
        currentTranslateInstruction = result.customTranslateInstruction;
        if (instructionInput) {
          instructionInput.value = currentTranslateInstruction;
        }
      }
    });
    
    // --- End Base Prompt Text Constants ---

    // --- State for Custom Instruction Phrase Button ---
    let isCustomInstructionActive = false; // Default to inactive

    // --- State for inlineReview ---
    let inlineReview = false; // Initialize inlineReview

    // --- Debouncing state ---
    let isTranslating = false;
    let lastTranslationTime = 0;
    const DEBOUNCE_DELAY = 1000; // 1 second

    // --- Auto-translation tracking ---
    const processedNodes = new WeakSet(); // Track nodes we've already processed

    // --- Cleanup tracking ---
    const cleanupObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.removedNodes.forEach((node) => {
          cleanupRemovedNodes(node);
        });
      });
    });

    // Start observing DOM changes for cleanup
    cleanupObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // --- Dynamic content observer ---
    const contentObserver = new MutationObserver((mutations) => {
      if (isTranslating) return; // Don't process during active translation
      
      let hasNewContent = false;
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const txt = node.nodeValue.trim();
            // Only consider it new content if it's substantial and not already processed
            if (txt.length > 0 && !/^[\x00-\x7F]+$/.test(txt) && !processedNodes.has(node)) {
              hasNewContent = true;
            }
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if element contains new translatable text
            const walker = document.createTreeWalker(
              node,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: n => {
                  const txt = n.nodeValue.trim();
                  if (txt.length > 0 && !/^[\x00-\x7F]+$/.test(txt) && !processedNodes.has(n)) {
                    return NodeFilter.FILTER_ACCEPT;
                  }
                  return NodeFilter.FILTER_REJECT;
                }
              }
            );
            if (walker.nextNode()) {
              hasNewContent = true;
            }
          }
        });
      });
      
      if (hasNewContent) {
        // Debounce auto-translation of new content
        clearTimeout(window.autoTranslateTimeout);
        window.autoTranslateTimeout = setTimeout(() => {
          // Only auto-translate if we've already translated this page
          if (hasTranslatedCurrentPage && translatedNodes.size > 0) {
            console.log('New content detected, auto-translating...');
            runTranslation(true); // Pass flag for auto-translation
          }
        }, 2000);
      }
    });

    // Start observing for new content
    contentObserver.observe(document.body, {
      childList: true,
      subtree: true
    });

    // --- Cleanup function for removed nodes ---
    function cleanupRemovedNodes(node) {
      if (node.nodeType === Node.TEXT_NODE && node.ollamaId) {
        originalTextMap.delete(node.ollamaId);
        translatedNodes.delete(node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Recursively clean up child nodes
        const walker = document.createTreeWalker(
          node,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        let textNode;
        while ((textNode = walker.nextNode())) {
          if (textNode.ollamaId) {
            originalTextMap.delete(textNode.ollamaId);
            translatedNodes.delete(textNode);
          }
        }
      }
    }

    // --- Cache key generation ---
    function getCacheKey(text, context, instruction) {
      return `${instruction || ''}|${context || ''}|${text}`;
    }

    // --- Prompt Assembly Functions ---
    function getPromptWithCustomInstruction(basePromptText) {
      if (isCustomInstructionActive) {
        const separator = basePromptText ? "\n\n" : "";
        return customInstructionPhrase + separator + basePromptText;
      }
      return basePromptText;
    }

    const createDetectLanguagePrompt = (text) => {
      return `${BASE_DETECT_LANGUAGE_PROMPT_TEXT}\n\n"${text}"`;
    };

    const createTranslatePrompt = (userContext, previousContext, textToTranslate) => {
      let prompt = '';
      
      // Add user context if it exists
      if (userContext) {
        prompt += `Context: ${userContext}\n\n`;
      }
      
      // Add previous context if it exists
      if (previousContext) {
        prompt += `${previousContext}\n`;
      }
      
      // Add the translation instruction and text
      prompt += `${currentTranslateInstruction}\n\n"${textToTranslate}"`;
      
      return prompt;
    };

    // Fixed: Reverse translation prompt
    const createReverseTranslatePrompt = (userContext, textToTranslate, targetLanguage) => {
      let prompt = '';
      
      // Add user context if it exists
      if (userContext) {
        prompt += `Context: ${userContext}\n\n`;
      }
      
      prompt += `You are a professional translator. Do not add any comments.
Translate the following English text into ${targetLanguage}:\n\n"${textToTranslate}"`;
      
      return prompt;
    };

    const createTranslateBatchPrompt = (userContext, batch, includeHistory = true) => {
      let prompt = '';
      
      // Add user context if it exists
      if (userContext) {
        prompt += `Context: ${userContext}\n\n`;
      }
      
      const count = batch.length;
      const jsonFormatInstruction = JSON_ARRAY_FORMAT_INSTRUCTION.replace('{count}', count);

      // Add context history for better translation continuity
      if (includeHistory && contextHistory.length > 0) {
        const recentHistory = contextHistory.slice(-MAX_CONTEXT_BATCHES);
        prompt += 'Previous context for continuity:\n';
        recentHistory.forEach((historyBatch, index) => {
          prompt += `Previous batch ${index + 1}: ${historyBatch.join(' | ')}\n`;
        });
        prompt += '\n';
      }

      prompt += `${currentTranslateInstruction}
${jsonFormatInstruction}

${batch.map((t,i)=>`${i+1}. ${t}`).join('\n')}`;

      return prompt;
    };
    // --- End Prompt Assembly Functions ---

    // ── RPC helper with retry logic ───────────────────────────────────
    let showLogs = false;
    async function requestTranslation(payload, retries = 2) {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          return await new Promise((resolve, reject) => {
            const responseAction =
              'translationResult_' + Date.now() + '_' + Math.random();
            
            const timeout = setTimeout(() => {
              chrome.runtime.onMessage.removeListener(handler);
              reject(new Error('Translation request timeout'));
            }, 30000); // 30 second timeout

            function handler(msg) {
              if (msg.action !== responseAction) return;
              clearTimeout(timeout);
              chrome.runtime.onMessage.removeListener(handler);
              if (showLogs) {
                console.groupEnd();
                console.group('🛰️ Ollama Response');
                msg.error ? console.error(msg.error) : console.log(msg.data);
                console.groupEnd();
              }
              msg.error ? reject(new Error(msg.error)) : resolve(msg.data);
            }
            chrome.runtime.onMessage.addListener(handler);
            if (showLogs) {
              console.group('🛰️ Ollama Request');
              console.log('Final prompt being sent:', payload.prompt);
              console.log('Full payload:', payload);
            }
            chrome.runtime.sendMessage({
              action: 'translate',
              payload,
              url: ollamaUrl,
              responseAction
            });
          });
        } catch (error) {
          if (attempt === retries) {
            throw error;
          }
          console.warn(`Translation attempt ${attempt + 1} failed, retrying...`, error);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); // Exponential backoff
        }
      }
    }

    // --- Build draggable toolbar ────────────────────────────────────────────
    const toolbar = document.createElement('div');
    Object.assign(toolbar.style, {
      position: 'fixed',
      top: '10px',
      left: '10px',
      zIndex: 9999,
      background: '#222',
      color: '#fff',
      padding: '8px',
      borderRadius: '8px',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      boxShadow: '2px 2px 6px rgba(0,0,0,0.5)',
      opacity: '0.9',
      cursor: 'move'
    });
    let isDragging = false, offsetX = 0, offsetY = 0;
    toolbar.addEventListener('mousedown', e => {
      const tag = e.target.tagName;
      if (!collapsed && !['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT', 'LABEL'].includes(tag)) {
        isDragging = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
      }
    });
    document.addEventListener('mouseup', () => (isDragging = false));
    document.addEventListener('mousemove', e => {
      if (isDragging) {
        toolbar.style.top  = `${e.clientY - offsetY}px`;
        toolbar.style.left = `${e.clientX - offsetX}px`;
      }
    });

    // inject highlight CSS
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
    `;
    document.head.appendChild(style);

    // header + collapse toggle
    const header = document.createElement('div');
    header.textContent = '🌐 Ollama Translator';
    Object.assign(header.style, {
      fontWeight: 'bold',
      marginBottom: '6px',
      cursor: 'move',
      userSelect: 'none'
    });
    const toggleBtn = document.createElement('button');
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

    const container = document.createElement('div');
    container.style.marginTop = '4px';

    // Context toggle + textarea
    const btnContext = document.createElement('button');
    btnContext.textContent = '📝 Context';
    Object.assign(btnContext.style, {
      margin: '3px', padding: '5px 10px',
      border: 'none', borderRadius: '4px',
      background: '#444', color: '#fff', cursor: 'pointer',
      outline: 'none'
    });
    const contextInput = document.createElement('textarea');
    contextInput.placeholder = 'Enter contextual instructions…';
    Object.assign(contextInput.style, {
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
      const show = contextInput.style.display === 'none';
      contextInput.style.display = show ? 'block' : 'none';
      btnContext.style.background = show ? '#2a7' : '#444';
    };

    // Translation Instruction toggle + textarea
    const btnInstruction = document.createElement('button');
    btnInstruction.textContent = '⚙️ Instruction';
    Object.assign(btnInstruction.style, {
      margin: '3px', padding: '5px 10px',
      border: 'none', borderRadius: '4px',
      background: '#444', color: '#fff', cursor: 'pointer',
      outline: 'none'
    });
    const instructionInput = document.createElement('textarea');
    instructionInput.placeholder = 'Enter custom translation instruction…';
    instructionInput.value = currentTranslateInstruction;
    Object.assign(instructionInput.style, {
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

    // Instruction control buttons
    const instructionControls = document.createElement('div');
    Object.assign(instructionControls.style, {
      display: 'none',
      margin: '3px 0',
      gap: '4px'
    });
    instructionControls.style.display = 'none';

    const btnSaveInstruction = document.createElement('button');
    btnSaveInstruction.textContent = '💾 Save';
    const btnResetInstruction = document.createElement('button');
    btnResetInstruction.textContent = '🔄 Reset';
    const btnRetranslate = document.createElement('button');
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

    btnInstruction.onclick = () => {
      const show = instructionInput.style.display === 'none';
      instructionInput.style.display = show ? 'block' : 'none';
      instructionControls.style.display = show ? 'flex' : 'none';
      btnInstruction.style.background = show ? '#2a7' : '#444';
    };

    btnSaveInstruction.onclick = () => {
      const newInstruction = instructionInput.value.trim();
      if (newInstruction) {
        currentTranslateInstruction = newInstruction;
        chrome.storage.sync.set({ customTranslateInstruction: newInstruction });
        logStatus('Translation instruction saved!');
        // Clear cache since instruction changed
        translationCache.clear();
      } else {
        logStatus('Please enter a valid instruction.');
      }
    };

    btnResetInstruction.onclick = () => {
      currentTranslateInstruction = DEFAULT_TRANSLATE_INSTRUCTION_TEXT;
      instructionInput.value = DEFAULT_TRANSLATE_INSTRUCTION_TEXT;
      chrome.storage.sync.remove('customTranslateInstruction');
      logStatus('Translation instruction reset to default!');
      // Clear cache since instruction changed
      translationCache.clear();
    };

    btnRetranslate.onclick = async () => {
      if (translatedNodes.size === 0) {
        logStatus('No translated content to retranslate.');
        return;
      }
      
      if (isTranslating) {
        logStatus('Translation already in progress...');
        return;
      }

      // Clear cache to force fresh translations
      translationCache.clear();
      
      // Reset all translated nodes to original text
      const nodesToRetranslate = [];
      translatedNodes.forEach(node => {
        if (node && node.parentElement && node.ollamaId) {
          const textData = originalTextMap.get(node.ollamaId);
          if (textData) {
            node.nodeValue = textData.original;
            nodesToRetranslate.push(node);
            // Remove from processed nodes so they can be retranslated
            processedNodes.delete(node);
          }
        }
      });
      
      // Clear the translated nodes set
      translatedNodes.clear();
      
      logStatus(`Retranslating ${nodesToRetranslate.length} segments with new instruction...`);
      
      // Run translation again
      await runTranslation();
    };

    // Buttons
    const btnTranslate  = document.createElement('button');
    const btnToggleText = document.createElement('button');
    const btnReview     = document.createElement('button');
    const btnReverse    = document.createElement('button');
    const btnLogs       = document.createElement('button');
    const btnExport     = document.createElement('button');

    // Button for disabling custom instruction phrases
    const btnDisableCustomInstructions = document.createElement('button');
    btnDisableCustomInstructions.textContent = 'Disable CIP';

    btnTranslate.textContent = '🌐 Translate';
    btnToggleText.textContent = '🔁 Toggle Original';
    btnReview.textContent     = '✏️ Review';
    btnReverse.textContent    = '🔄 Reverse';
    btnLogs.textContent       = '📜 Logs';
    btnExport.textContent     = '💾 Export';

    const allButtons = [
      btnTranslate,
      btnDisableCustomInstructions,
      btnContext,
      btnInstruction,
      btnToggleText,
      btnReview,
      btnReverse,
      btnLogs,
      btnExport
    ];

    for (let i = 0; i < allButtons.length; i++) {
      Object.assign(allButtons[i].style, {
        margin: '3px',
        padding: '5px 10px',
        border: 'none',
        borderRadius: '4px',
        background: '#444',
        color: '#fff',
        cursor: 'pointer',
        flex: '1 1 auto',
        outline: 'none'
      });
    }

    btnDisableCustomInstructions.onclick = () => {
      isCustomInstructionActive = !isCustomInstructionActive; // Toggle the state

      if (isCustomInstructionActive) {
        btnDisableCustomInstructions.style.background = '#2a7'; // Green when active
        logStatus('Disable CIP is Active'); // Direct log message
      } else {
        btnDisableCustomInstructions.style.background = '#444'; // Gray when inactive
        logStatus('Disable CIP is Inactive'); // Direct log message
      }
    };

    // Three rows layout to accommodate new button
    const row1 = document.createElement('div');
    const row2 = document.createElement('div');
    const row3 = document.createElement('div');
    for (const r of [row1,row2,row3]) {
      Object.assign(r.style, { display:'flex', gap:'4px', width:'100%' });
    }
    row1.append(
      allButtons[0], // Translate
      allButtons[1], // Disable CIP
      allButtons[2]  // Context
    );
    row2.append(
      allButtons[3], // Instruction
      allButtons[4], // Toggle Original
      allButtons[5]  // Review
    );
    row3.append(
      allButtons[6], // Reverse
      allButtons[7], // Logs
      allButtons[8]  // Export
    );

    const status = document.createElement('div');
    status.style = 'margin-top:6px;font-size:12px';

    const progress = document.createElement('div');
    Object.assign(progress.style, {
      marginTop:'4px', height:'6px', background:'#555',
      borderRadius:'4px', overflow:'hidden'
    });
    const progressBar = document.createElement('div');
    Object.assign(progressBar.style, {
      height:'100%', width:'0%', background:'#4caf50',
      transition:'width 0.3s ease'
    });
    progress.appendChild(progressBar);

    container.append(row1, contextInput, row2, instructionInput, instructionControls, row3, status, progress);
    toolbar.append(header, container, toggleBtn);
    document.body.appendChild(toolbar);

    // --- Fixed Reverse-translate panel ───────────────────────────────────────────
    const reversePanel = document.createElement('div');
    Object.assign(reversePanel.style, {
      display:'none',
      position:'absolute',
      background:'#333',
      padding:'8px',
      borderRadius:'6px',
      boxShadow:'2px 2px 6px rgba(0,0,0,0.5)',
      color:'#fff',
      zIndex:10000,
      width:'250px',
      pointerEvents:'auto'
    });
    const revInput = document.createElement('textarea');
    revInput.placeholder = 'Type English text to translate...';
    Object.assign(revInput.style, {
      width:'100%',height:'60px',
      background:'#222',color:'#fff',
      border:'1px solid #555',borderRadius:'4px',
      padding:'4px',fontSize:'12px',resize:'vertical'
    });
    const revButton = document.createElement('button');
    revButton.textContent = 'Translate to ' + (sourceLang || 'Original Language');
    Object.assign(revButton.style, {
      margin:'4px 0',padding:'4px 8px',
      background:'#4caf50',border:'none',
      borderRadius:'4px',color:'#fff',
      cursor:'pointer',outline:'none'
    });
    const revOutput = document.createElement('textarea');
    revOutput.readOnly = true;
    Object.assign(revOutput.style, {
      width:'100%',height:'60px',
      background:'#222',color:'#fff',
      border:'1px solid #555',borderRadius:'4px',
      padding:'4px',fontSize:'12px',resize:'vertical'
    });

    // Fixed reverse translation panel setup
    revButton.onclick = async () => {
      const txt = revInput.value.trim();
      if (!txt) return;
      
      if (!sourceLang) {
        revOutput.value = '❌ Please translate the page first to detect the source language.';
        return;
      }
      
      const userContext = contextInput.value.trim();
      const cacheKey = getCacheKey(`reverse:${txt}`, userContext + sourceLang, 'reverse');
      
      // Check cache first
      if (translationCache.has(cacheKey)) {
        revOutput.value = translationCache.get(cacheKey);
        return;
      }
      
      revButton.disabled = true;
      revButton.textContent = '…';
      try {
        const prompt = createReverseTranslatePrompt(userContext, txt, sourceLang);
        const finalPrompt = getPromptWithCustomInstruction(prompt);

        const { response } = await requestTranslation({
          model,
          prompt: finalPrompt,
          stream: false
        });

        let translated = response.trim();
        const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```$/i;
        const match = translated.match(fenceRe);
        if (match) translated = match[1].trim();
        translated = translated.replace(/^`+|`+$/g, '').trim();

        revOutput.value = translated;
        translationCache.set(cacheKey, translated);
      } catch (e) {
        revOutput.value = '❌ ' + e.message;
      } finally {
        revButton.disabled = false;
        revButton.textContent = 'Translate to ' + sourceLang;
      }
    };
    reversePanel.append(revInput, revButton, revOutput);
    container.appendChild(reversePanel);

    btnReverse.onclick = () => {
      const show = reversePanel.style.display==='none';
      reversePanel.style.display = show?'block':'none';
      const r = btnReverse.getBoundingClientRect();
      reversePanel.style.left = `${r.left}px`;
      reversePanel.style.top  = `${r.bottom+4}px`;
      
      // Update button text when panel is shown
      if (show) {
        revButton.textContent = 'Translate to ' + (sourceLang || 'Original Language');
      }
    };

    // --- Clamp & collapse ──────────────────────────────────────────────────
    function ensureInView() {
      const r = toolbar.getBoundingClientRect();
      let x=r.left,y=r.top;
      if (r.right>innerWidth)  x=innerWidth-r.width-10;
      if (r.bottom>innerHeight) y=innerHeight-r.height-10;
      if (r.left<0) x=10;
      if (r.top<0)  y=10;
      toolbar.style.left=x+'px';
      toolbar.style.top=y+'px';
    }

    // --- Collapse / Expand Docking (Top-Left, Static Globe) ─────────────────
    let collapsed = true;

    function updateCollapsed() {
      if (collapsed) {
        toolbar.style.top    = '10px';
        toolbar.style.left   = '10px';
        toolbar.style.right  = '';
        toolbar.style.bottom = '';
        toolbar.style.cursor = 'pointer';

        header.style.display    = 'none';
        container.style.display = 'none';
        toolbar.style.padding   = '4px';

        Object.assign(toggleBtn.style, {
          position: 'static',
          right:    '',
          top:      '',
          width:    '32px',
          height:   '32px',
          padding:  '0',
          fontSize: '24px',
          lineHeight:'32px'
        });
        toggleBtn.textContent = '🌐';

      } else {
        toolbar.style.cursor = 'move';
        toolbar.style.padding = '8px';

        header.style.display    = '';
        container.style.display = '';

        Object.assign(toggleBtn.style, {
          position: 'absolute',
          right:    '10px',
          top:      '10px',
          width:    '',
          height:   '',
          padding:  '2px 6px',
          fontSize: '',
          lineHeight: ''
        });
        toggleBtn.textContent = '▼';

        ensureInView();
      }
    }

    toggleBtn.onclick = () => {
      collapsed = !collapsed;
      updateCollapsed();
    };

    updateCollapsed();

    // --- Intersection Observer for visible content priority ─────────────────
    const visibleNodes = new Set();
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visibleNodes.add(entry.target);
        } else {
          visibleNodes.delete(entry.target);
        }
      });
    }, {
      rootMargin: '100px' // Start loading content 100px before it becomes visible
    });

// --- Scoped Text‐Node Collector ─────────────────────────────────────────
function getTextNodes(prioritizeVisible = false) {
  const root =
    document.querySelector('main') ||
    document.getElementById('content') ||
    document.body;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: n => {
        const txt = n.nodeValue.trim();
        if (!txt) return NodeFilter.FILTER_REJECT;
        
        // Filter out nodes that are only punctuation, whitespace, or basic symbols
        if (/^[\s\p{P}\p{S}]+$/u.test(txt)) return NodeFilter.FILTER_REJECT;
        
        // Filter out nodes that are only numbers
        if (/^[\p{N}]+$/u.test(txt)) return NodeFilter.FILTER_REJECT;
        
        // Filter out nodes that are only ASCII characters (English text, basic punctuation)
        if (/^[\x00-\x7F]+$/.test(txt)) return NodeFilter.FILTER_REJECT;
        
        const el = n.parentElement;
        if (
          ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT']
            .includes(el.tagName) ||
          toolbar.contains(el)
        ) return NodeFilter.FILTER_REJECT;
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) {
    nodes.push(n);
    // Observe parent elements for intersection
    if (n.parentElement && !visibleNodes.has(n.parentElement)) {
      intersectionObserver.observe(n.parentElement);
    }
  }
  
  if (prioritizeVisible) {
    // Sort nodes by visibility (visible first)
    return nodes.sort((a, b) => {
      const aVisible = visibleNodes.has(a.parentElement);
      const bVisible = visibleNodes.has(b.parentElement);
      if (aVisible && !bVisible) return -1;
      if (!aVisible && bVisible) return 1;
      return 0;
    });
  }
  
  return nodes;
}

    async function detectLanguage(text) {
      const prompt = createDetectLanguagePrompt(text);
      const finalPrompt = getPromptWithCustomInstruction(prompt);

      const d = await requestTranslation({ model,prompt: finalPrompt,stream:false });
      return d.response.trim();
    }

    async function translateBatch(batch, includeHistory = true) {
      const userContext = contextInput.value.trim();
      const cacheKey = getCacheKey(batch.join('|'), userContext + (includeHistory ? contextHistory.slice(-MAX_CONTEXT_BATCHES).join('|') : ''), currentTranslateInstruction);
      
      // Check cache first
      if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
      }
      
      const prompt = createTranslateBatchPrompt(userContext, batch, includeHistory);
      const finalPrompt = getPromptWithCustomInstruction(prompt);

      const { response } = await requestTranslation({
        model,prompt: finalPrompt,stream:false
      });
      let txt = response.trim();
      const fence = /```(?:json)?\s*([\s\S]*?)\s*```$/i;
      const m = txt.match(fence);
      if (m) txt = m[1].trim();
      txt = txt.replace(/^`+|`+$/g,'').trim();
      if (showLogs) {
        console.group('🛰️ Parsed JSON');
        console.log(txt);
        console.groupEnd();
      }
      let arr;
      try { arr = JSON.parse(txt); }
      catch(e) { console.error('❌ JSON parse err:', txt); throw e; }
      if (!Array.isArray(arr)||arr.length!==batch.length) {
        throw new Error(`Expected ${batch.length}, got ${arr.length}`);
      }
      
      // Add this batch to context history (only for main translation, not reverse/selection)
      if (includeHistory) {
        contextHistory.push([...batch]);
        // Keep only the last MAX_CONTEXT_BATCHES batches
        if (contextHistory.length > MAX_CONTEXT_BATCHES) {
          contextHistory.shift();
        }
      }
      
      // Cache the result
      translationCache.set(cacheKey, arr);
      return arr;
    }

    function reviewNode(node, original, translated) {
      const wrapper = document.createElement('span');
      Object.assign(wrapper.style,{
        background:'#333',padding:'2px',borderRadius:'4px'
      });
      const origEl = document.createElement('div');
      origEl.textContent=original;
      Object.assign(origEl.style,{
        textDecoration:'line-through',
        opacity:'0.7',marginBottom:'4px'
      });
      const txtarea = document.createElement('textarea');
      txtarea.value=translated;
      Object.assign(txtarea.style,{
        width:'100%',minWidth:'150px',maxWidth:'300px',
        minHeight:'40px',background:'#222',color:'#fff',
        border:'1px solid #555',borderRadius:'4px',
        padding:'4px',marginBottom:'4px',fontSize:'12px'
      });
      const btnA=document.createElement('button'); btnA.textContent='✅';
      const btnR=document.createElement('button'); btnR.textContent='❌';
      for(const b of [btnA,btnR]) {
        Object.assign(b.style,{
          margin:'2px',padding:'2px 6px',
          border:'none',borderRadius:'3px',
          background:'#444',color:'#fff',cursor:'pointer'
        });
      }
      btnA.onclick=()=>
        wrapper.replaceWith(document.createTextNode(txtarea.value));
      btnR.onclick=()=>
        wrapper.replaceWith(document.createTextNode(original));
      wrapper.append(origEl,txtarea,btnA,btnR);
      node.parentElement.replaceChild(wrapper,node);
    }

    // Track toggle state
    let isShowingOriginal = false;

    // --- Main Translation Routine (Sequential Processing) ─────────────────────────────────
async function runTranslation(isAutoTranslation = false) {
  // Debouncing protection
  const now = Date.now();
  if (isTranslating || (now - lastTranslationTime < DEBOUNCE_DELAY && !isAutoTranslation)) {
    if (!isAutoTranslation) {
      logStatus('Translation in progress or too soon since last translation...');
    }
    return;
  }
  
  isTranslating = true;
  lastTranslationTime = now;
  
  try {
    logStatus(isAutoTranslation ? 'Auto-translating new content...' : 'Starting translation...');

    const nodes = getTextNodes(true).filter(n => {
      const txt = n.nodeValue.trim();
      // Skip already processed nodes (including translated ones)
      if (processedNodes.has(n)) {
        return false;
      }
      // Remove character limit - now accepts any non-ASCII text regardless of length
      return txt.length > 0 && !/^[\x00-\x7F]+$/.test(txt);
    });

    if (nodes.length === 0) {
      logStatus(isAutoTranslation ? 'No new content to translate.' : 'No non-ASCII text found.');
      return;
    }

    // Only detect language if we haven't done it before or if it's a fresh translation
    if (!sourceLang || !isAutoTranslation) {
      const sample = nodes.slice(0, 5).map(n => n.nodeValue.trim()).join(' ');
      sourceLang = await detectLanguage(sample);
      logStatus(`Detected: ${sourceLang}`);
      // Update reverse button text
      revButton.textContent = 'Translate to ' + sourceLang;
    }

    logStatus(`Translating ${nodes.length} segments sequentially…`);
    updateProgress(0);

    let completed = 0;
    // Track recent translations for context - only store original text
    const recentOriginalTexts = [];
    const MAX_RECENT_CONTEXT = 5; // Limit how many previous translations to use as context

    // Sequential processing - process one node at a time
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const originalText = node.nodeValue.trim();

      // Mark this node as processed to prevent re-processing
      processedNodes.add(node);

      // Declare variables outside try block so they're accessible in the delay check
      let fullContext = '';
      
      try {
        const userContext = contextInput.value.trim();
        
        // Build context from recent original texts only
        let previousContext = '';
        if (recentOriginalTexts.length > 0) {
          previousContext = 'Previous text for context:\n';
          recentOriginalTexts.forEach((text, index) => {
            previousContext += `${index + 1}. "${text}"\n`;
          });
        }
        
        // Build full context for cache key
        if (userContext && previousContext) {
          fullContext = userContext + '\n\n' + previousContext;
        } else if (userContext) {
          fullContext = userContext;
        } else if (previousContext) {
          fullContext = previousContext;
        }
        
        const cacheKey = getCacheKey(originalText, fullContext, currentTranslateInstruction);
        
        let translated;
        
        // Check cache first
        if (translationCache.has(cacheKey)) {
          translated = translationCache.get(cacheKey);
          if (showLogs) {
            console.log(`🎯 Cache hit for: "${originalText.substring(0, 50)}..."`);
          }
        } else {
          if (showLogs) {
            console.log(`🔄 Translating ${i + 1}/${nodes.length}: "${originalText.substring(0, 50)}..."`);
            if (recentOriginalTexts.length > 0) {
              console.log(`📝 Using ${recentOriginalTexts.length} recent original texts as context`);
            }
          }
          
          const prompt = createTranslatePrompt(userContext, previousContext, originalText);
          const finalPrompt = getPromptWithCustomInstruction(prompt);

          const { response } = await requestTranslation({
            model,
            prompt: finalPrompt,
            stream: false
          });

          translated = response.trim();
          const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```$/i;
          const match = translated.match(fenceRe);
          if (match) translated = match[1].trim();
          translated = translated.replace(/^`+|`+$/g, '').trim();
          
          // Cache the translation
          translationCache.set(cacheKey, translated);
        }

        if (translated && translated !== originalText) {
          const nodeId = 'node_' + Date.now() + '_' + Math.random();
          originalTextMap.set(nodeId, {
            original: originalText,
            translated: translated
          });

          node.ollamaId = nodeId;

          if (showLogs) {
            console.group('🛠 Replacing text node');
            console.log('Node:', node);
            console.log('Parent:', node.parentElement);
            console.log('Original:', JSON.stringify(originalText));
            console.log('Translated:', JSON.stringify(translated));
            console.groupEnd();
          }

          node.nodeValue = translated;
          translatedNodes.add(node);

          if (showLogs && node.parentElement) {
            node.parentElement.classList.add('ollama-highlight');
            console.log('Added highlight during translation:', node.parentElement);
          }

          if (inlineReview) {
            reviewNode(node, originalText, translated);
          } else {
            const p = node.parentElement;
            if (p && !p.dataset.originalTitle) {
              p.title = originalText;
              p.dataset.originalTitle = originalText;
            }
          }

          // Add only the original text to recent context
          recentOriginalTexts.push(originalText);
          
          // Keep only the most recent original texts
          if (recentOriginalTexts.length > MAX_RECENT_CONTEXT) {
            recentOriginalTexts.shift();
          }

          window.translationLog.push({ original: originalText, translated });
          completed++;
          
          // Update progress after each successful translation
          updateProgress((completed / nodes.length) * 100);
          
          // Update status with current progress
          logStatus(`Translating ${completed}/${nodes.length} segments… (${Math.round((completed / nodes.length) * 100)}%)`);
        }
      } catch (err) {
        console.error(`❌ Translation error for node ${i + 1}:`, err);
        logStatus(`Error translating segment ${i + 1}: ${err.message}`);
      }
      
      // Apply delay between translations (but not after cache hits)
      if (delayMs > 0 && !translationCache.has(getCacheKey(originalText, fullContext, currentTranslateInstruction))) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    // Mark that this page has been translated
    hasTranslatedCurrentPage = true;

    updateProgress(100);
    logStatus(`✅ Done! Translated ${completed} segments sequentially.`);
  } finally {
    isTranslating = false;
  }
}

    function toggleOriginalText() {
      isShowingOriginal = !isShowingOriginal;
      let cnt = 0;

      translatedNodes.forEach(node => {
        if (!node || !node.parentElement) return;

        const nodeId = node.ollamaId;
        if (!nodeId) return;

        const textData = originalTextMap.get(nodeId);
        if (!textData) return;

        if (isShowingOriginal) {
          node.nodeValue = textData.original;
        } else {
          node.nodeValue = textData.translated;
        }
        cnt++;
      });

      btnToggleText.style.background = isShowingOriginal ? '#2a7' : '#444';
      logStatus(`🔁 Toggled ${cnt} segments. Now showing ${isShowingOriginal ? 'original' : 'translated'} text.`);
    }

    // --- Improved selection translation with better positioning ---
    async function translateSelectedText(textToTranslate) {
      if (!textToTranslate) {
        logStatus('No text provided for translation.');
        return;
      }

      logStatus('Translating selection...');

      try {
        const userContext = contextInput.value.trim();
        // Don't include history context for selection translation
        const cacheKey = getCacheKey(textToTranslate, userContext, currentTranslateInstruction);
        
        let translated;
        
        // Check cache first
        if (translationCache.has(cacheKey)) {
          translated = translationCache.get(cacheKey);
        } else {
          const prompt = createTranslatePrompt(userContext, '', textToTranslate);
          const finalPrompt = getPromptWithCustomInstruction(prompt);

          const { response } = await requestTranslation({
            model,
            prompt: finalPrompt,
            stream: false
          });

          translated = response.trim();
          const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```$/i;
          const match = translated.match(fenceRe);
          if (match) translated = match[1].trim();
          translated = translated.replace(/^`+|`+$/g, '').trim();
          
          // Cache the translation
          translationCache.set(cacheKey, translated);
        }

        // Create a popup with the translation
        const popup = document.createElement('div');
        Object.assign(popup.style, {
          position: 'fixed',
          zIndex: 10000,
          background: '#333',
          color: '#fff',
          padding: '10px',
          borderRadius: '6px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
          maxWidth: '300px',
          fontSize: '14px',
          lineHeight: '1.4'
        });

        // Improved positioning - try to get selection coordinates
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

        // Ensure popup stays within viewport
        const popupWidth = 300;
        const popupHeight = 100; // Approximate
        popup.style.left = `${Math.max(10, Math.min(targetX - popupWidth / 2, window.innerWidth - popupWidth - 10))}px`;
        popup.style.top = `${Math.max(10, Math.min(targetY, window.innerHeight - popupHeight - 10))}px`;

        // Add original and translated text
        const originalDiv = document.createElement('div');
        originalDiv.textContent = textToTranslate;
        Object.assign(originalDiv.style, {
          color: '#aaa',
          marginBottom: '8px',
          fontStyle: 'italic'
        });

        const translatedDiv = document.createElement('div');
        translatedDiv.textContent = translated;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        Object.assign(closeBtn.style, {
          position: 'absolute',
          top: '5px',
          right: '5px',
          background: 'none',
          border: 'none',
          color: '#fff',
          fontSize: '16px',
          cursor: 'pointer'
        });
        closeBtn.onclick = () => popup.remove();

        // Auto-close after 10 seconds
        setTimeout(() => {
          if (popup.parentElement) {
            popup.remove();
          }
        }, 10000);

        popup.append(closeBtn, originalDiv, translatedDiv);
        document.body.appendChild(popup);

        // Add to translation log
        window.translationLog.push({ original: textToTranslate, translated });

        logStatus('Selection translated via context menu.');
      } catch (err) {
        console.error('❌ Translation error:', err);
        logStatus('Translation failed: ' + err.message);
      }
    }

    // --- LISTEN FOR MESSAGES FROM BACKGROUND SCRIPT ---
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === "translate-selected-text") {
        translateSelectedText(msg.selectedText);
      }
    });

    // --- Wire up buttons with debouncing ---
    btnTranslate.onclick = () => {
      if (!isTranslating) {
        runTranslation();
      }
    };
    
    btnToggleText.onclick = toggleOriginalText;
    btnReview.onclick = () => {
      inlineReview = !inlineReview;
      btnReview.style.background = inlineReview ? '#2a7' : '#444';
    };

    btnLogs.onclick = () => {
      showLogs = !showLogs;
      btnLogs.style.background = showLogs ? '#2a7' : '#444';
      console.log(`Logs button clicked, showLogs=${showLogs}`);
      updateHighlighting();
    };

    btnExport.onclick = () => {
      const data = window.translationLog;
      const json = JSON.stringify(data, null, 2);
      const csv = [
        ['original','translated'],
        ...data.map(o => [o.original,o.translated])
      ]
        .map(r => r.map(s => `"${s.replace(/"/g,'""')}"`).join(','))
        .join('\n');
      // download JSON
      const a1 = document.createElement('a');
      a1.href = URL.createObjectURL(new Blob([json],{type:'application/json'}));
      a1.download = 'translation-log.json'; a1.click();
      // download CSV
      const a2 = document.createElement('a');
      a2.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
      a2.download = 'translation-log.csv'; a2.click();
    };

    // keyboard shortcuts with debouncing
    document.addEventListener('keydown',e=>{
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch(e.key.toLowerCase()) {
          case 't': 
            e.preventDefault(); 
            if (!isTranslating) {
              runTranslation();
            }
            break;
          case 'o': 
            e.preventDefault(); 
            toggleOriginalText(); 
            break;
        }
      }
    });

    // final helpers
    function logStatus(msg) {
      console.log(`[Ollama Translator] ${msg}`);
      status.textContent = msg; // Update the main status bar
    }
    function updateProgress(pct) {
      progressBar.style.width = `${pct}%`;
    }

    function updateHighlighting() {
      console.log(`Updating highlighting, showLogs=${showLogs}, nodes=${translatedNodes.size}`);

      translatedNodes.forEach(node => {
        if (node && node.parentElement) {
          if (showLogs) {
            node.parentElement.classList.add('ollama-highlight');
            console.log('Added highlight to:', node.parentElement);
          } else {
            node.parentElement.classList.remove('ollama-highlight');
            console.log('Removed highlight from:', node.parentElement);
          }
        }
      });
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      cleanupObserver.disconnect();
      contentObserver.disconnect();
      intersectionObserver.disconnect();
      clearTimeout(window.autoTranslateTimeout);
      
      // Restore original history methods
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    });

  } // End of initializeExtension()

})();