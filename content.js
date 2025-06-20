// content.js
(() => {
  'use strict';

  const ollamaUrl = 'http://localhost:11434/api/generate';
  const model     = 'gemma3:latest';
  const delayMs   = 300;
  const batchSize = 8;
  let sourceLang  = '';
  const originalTextMap = new Map();
  const translatedNodes = new Set();
  window.translationLog = [];

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
      // Optionally, you could remove the toolbar or show a message, but simply not running is cleanest.
      return; // Stop execution for excluded domains
    }

    // If not excluded, proceed with initializing the extension
    initializeExtension();
  });

  // --- Rest of your content.js code will be inside this function ---
  function initializeExtension() {

    // --- Custom Instruction Phrase ---
    const customInstructionPhrase = "This is a special phrase for disabling CIP.";

    // --- Base Prompt Text Constants ---
    const BASE_DETECT_LANGUAGE_PROMPT_TEXT = `What language is this? Just respond with the language name:`;
    const BASE_TRANSLATE_INSTRUCTION_TEXT = `You are a professional translator. Do not add any comments.
Translate the following into clear, natural English:`;
    const BASE_TRANSLATE_BATCH_INSTRUCTION_TEXT = `You are a professional translator. No comments.
Translate each of the following segments into clear, natural English.`;
    const JSON_ARRAY_FORMAT_INSTRUCTION = `Return a JSON array of {count} strings, in the same order:`;
    // --- End Base Prompt Text Constants ---

    // --- State for Custom Instruction Phrase Button ---
    let isCustomInstructionActive = false; // Default to inactive

    // --- State for inlineReview ---
    let inlineReview = false; // Initialize inlineReview

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

    const createTranslatePrompt = (context, textToTranslate) => {
      const fullContext = context ? `Context: ${context}\n\n` : '';
      return `${fullContext}${BASE_TRANSLATE_INSTRUCTION_TEXT}\n\n"${textToTranslate}"`;
    };

    const createTranslateBatchPrompt = (context, batch) => {
      const fullContext = context ? `Context: ${context}\n\n` : '';
      const count = batch.length;
      const jsonFormatInstruction = JSON_ARRAY_FORMAT_INSTRUCTION.replace('{count}', count);

      return `
  ${fullContext}${BASE_TRANSLATE_BATCH_INSTRUCTION_TEXT}
  ${jsonFormatInstruction}

  ${batch.map((t,i)=>`${i+1}. ${t}`).join('\n')}
  `;
    };
    // --- End Prompt Assembly Functions ---


    // ── RPC helper with optional logging ───────────────────────────────────
    let showLogs = false;
    function requestTranslation(payload) {
      return new Promise((resolve, reject) => {
        const responseAction =
          'translationResult_' + Date.now() + '_' + Math.random();
        function handler(msg) {
          if (msg.action !== responseAction) return;
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
          console.log(payload);
        }
        chrome.runtime.sendMessage({
          action: 'translate',
          payload,
          url: ollamaUrl,
          responseAction
        });
      });
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

    // Two rows layout
    const row1 = document.createElement('div');
    const row2 = document.createElement('div');
    for (const r of [row1,row2]) {
      Object.assign(r.style, { display:'flex', gap:'4px', width:'100%' });
    }
    row1.append(
      allButtons[0], // Translate
      allButtons[1], // Disable CIP
      allButtons[2], // Context
      allButtons[3]  // Toggle Original
    );
    row2.append(
      allButtons[4], // Review
      allButtons[5], // Reverse
      allButtons[6], // Logs
      allButtons[7]  // Export
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

    container.append(row1, contextInput, row2, status, progress);
    toolbar.append(header, container, toggleBtn);
    document.body.appendChild(toolbar);

    // --- Reverse-translate panel ───────────────────────────────────────────
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
    revInput.placeholder = 'Type text to reverse…';
    Object.assign(revInput.style, {
      width:'100%',height:'60px',
      background:'#222',color:'#fff',
      border:'1px solid #555',borderRadius:'4px',
      padding:'4px',fontSize:'12px',resize:'vertical'
    });
    const revButton = document.createElement('button');
    revButton.textContent = 'Translate';
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

    // Reverse translation panel setup
    revButton.onclick = async () => {
      const txt = revInput.value.trim();
      if (!txt) return;
      revButton.disabled = true;
      revButton.textContent = '…';
      try {
        const prompt = getPromptWithCustomInstruction(txt);

        const { response } = await requestTranslation({
          model,
          prompt: prompt,
          stream: false
        });

        let responseText = response.trim();
        const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```$/i;
        const match = responseText.match(fenceRe);
        if (match) responseText = match[1].trim();
        responseText = responseText.replace(/^`+|`+$/g, '').trim();

        let arr;
        try {
          arr = JSON.parse(responseText);
        } catch (e) {
          console.error('❌ Failed to parse JSON:', responseText);
          revOutput.value = '❌ ' + e.message;
          return;
        }

        if (!Array.isArray(arr) || arr.length === 0) {
          revOutput.value = '❌ Unexpected response format';
          return;
        }

        revOutput.value = arr[0];
      } catch (e) {
        revOutput.value = '❌ ' + e.message;
      } finally {
        revButton.disabled = false;
        revButton.textContent = 'Translate';
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

    // --- Scoped Text‐Node Collector ─────────────────────────────────────────
    function getTextNodes() {
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
      while ((n = walker.nextNode())) nodes.push(n);
      return nodes;
    }

    async function detectLanguage(text) {
      const prompt = createDetectLanguagePrompt(text);
      const finalPrompt = getPromptWithCustomInstruction(prompt);

      const d = await requestTranslation({ model,prompt: finalPrompt,stream:false });
      return d.response.trim();
    }

    async function translateBatch(batch) {
      const context = contextInput.value.trim();
      const prompt = createTranslateBatchPrompt(context, batch);
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

    // --- Main Translation Routine (Scoped) ─────────────────────────────────
    async function runTranslation() {
      logStatus('Starting translation...');

      const nodes = getTextNodes().filter(n => {
        const txt = n.nodeValue.trim();
        return txt.length > 2 && !/^[\x00-\x7F]+$/.test(txt);
      });

      if (nodes.length === 0) {
        logStatus('No non-ASCII text found.');
        return;
      }

      const sample = nodes.slice(0, 5).map(n => n.nodeValue.trim()).join(' ');
      sourceLang = await detectLanguage(sample);
      logStatus(`Detected: ${sourceLang}`);

      logStatus(`Translating ${nodes.length} segments…`);
      updateProgress(0);

      let completed = 0;
      const concurrency = 3;
      let index = 0;

      async function worker() {
        while (index < nodes.length) {
          const currentIndex = index++;
          const node = nodes[currentIndex];
          const originalText = node.nodeValue.trim();

          try {
            const context = contextInput.value.trim();
            const prompt = createTranslatePrompt(context, originalText);
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

            if (translated && translated !== originalText) {
              const nodeId = 'node_' + Date.now() + '_' + Math.random();
              originalTextMap.set(nodeId, {
                original: originalText,
                translated: translated
              });

              node.ollamaId = nodeId;

              console.group('🛠 Replacing text node');
              console.log('Node:', node);
              console.log('Parent:', node.parentElement);
              console.log('Original:', JSON.stringify(originalText));
              console.log('Translated:', JSON.stringify(translated));
              console.groupEnd();

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

              window.translationLog.push({ original: originalText, translated });
              completed++;
              updateProgress((completed / nodes.length) * 100);
            }
          } catch (err) {
            console.error('❌ Translation error:', err);
          }
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      const workers = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
      }
      await Promise.all(workers);

      updateProgress(100);
      logStatus(`✅ Done! Translated ${completed} segments.`);
    }

    // Track toggle state
    let isShowingOriginal = false;

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

    // --- NEW: Function to handle selection translation via message ---
    async function translateSelectedText(textToTranslate) {
      if (!textToTranslate) {
        logStatus('No text provided for translation.');
        return;
      }

      logStatus('Translating selection...');

      try {
        const context = contextInput.value.trim();
        const prompt = createTranslatePrompt(context, textToTranslate);
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

        // Create a popup with the translation
        const popup = document.createElement('div');
        Object.assign(popup.style, {
          position: 'absolute',
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

        // --- Improved popup positioning logic ---
        let targetRect = null;
        // Reuse getTextNodes to get all visible text elements.
        // This is a heuristic and might not always find the exact selection boundary if it's complex.
        const allTextNodes = getTextNodes();
        for (const node of allTextNodes) {
          // Look for the first node that contains the beginning of the selected text.
          // This is an approximation to get a general location.
          if (node.nodeValue.trim().startsWith(textToTranslate.trim().substring(0, Math.min(textToTranslate.trim().length, 20)))) {
            const rect = node.parentElement.getBoundingClientRect();
            // Ensure the rect is valid (visible on the page)
            if (rect.width > 0 && rect.height > 0 && rect.top > 0 && rect.left > 0 && rect.bottom < window.innerHeight && rect.right < window.innerWidth) {
              targetRect = rect;
              break;
            }
          }
        }

        if (targetRect) {
          // Position relative to the found text element
          // Calculate center of the element and offset the popup to be centered, then place it below.
          const popupWidth = 300; // Approximate width of the popup
          popup.style.left = `${Math.max(10, targetRect.left + window.scrollX + targetRect.width / 2 - popupWidth / 2)}px`;
          popup.style.top = `${Math.max(10, targetRect.bottom + window.scrollY + 5)}px`;
        } else {
          // Fallback positioning if text cannot be found reliably
          const toolbarRect = toolbar.getBoundingClientRect();
          popup.style.left = `${Math.max(10, toolbarRect.left + toolbarRect.width / 2 - 150)}px`; // Center horizontally near toolbar
          popup.style.top = `${Math.max(10, toolbarRect.bottom + 5)}px`; // Below toolbar
        }

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

    // --- Wire up buttons ---
    btnTranslate.onclick = runTranslation;
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


    // keyboard shortcuts
    document.addEventListener('keydown',e=>{
      if (e.altKey && !e.ctrlKey && !e.shiftKey) {
        switch(e.key.toLowerCase()) {
          case 't': e.preventDefault(); runTranslation(); break;
          case 'o': e.preventDefault(); toggleOriginalText(); break;
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
  } // End of initializeExtension()

})();