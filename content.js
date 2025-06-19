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

  // ── Build draggable toolbar ────────────────────────────────────────────
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
  const btnSelection  = document.createElement('button');
  const btnToggleText = document.createElement('button');
  const btnReview     = document.createElement('button');
  const btnReverse    = document.createElement('button');
  const btnLogs       = document.createElement('button');
  const btnExport     = document.createElement('button');

  btnTranslate.textContent = '🌐 Translate';
  btnSelection.textContent = '🔍 Selection';
  btnToggleText.textContent = '🔁 Toggle Original';
  btnReview.textContent     = '✏️ Review';
  btnReverse.textContent    = '🔄 Reverse';
  btnLogs.textContent       = '📜 Logs';
  btnExport.textContent     = '💾 Export';

  const allButtons = [
    btnTranslate,
    btnContext,
    btnSelection,
    btnToggleText,
    btnReview,
    btnReverse,
    btnLogs,
    btnExport
  ];
  for (const b of allButtons) {
    Object.assign(b.style, {
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

  // Update highlighting for all translated nodes
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
  let inlineReview = false;
  btnReview.onclick = () => {
    inlineReview = !inlineReview;
    btnReview.style.background = inlineReview ? '#2a7' : '#444';
  };

  // Two rows layout
  const row1 = document.createElement('div');
  const row2 = document.createElement('div');
  for (const r of [row1,row2]) {
    Object.assign(r.style, { display:'flex', gap:'4px', width:'100%' });
  }
  row1.append(...allButtons.slice(0,4));
  row2.append(...allButtons.slice(4,8));

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

  // ── Reverse-translate panel ───────────────────────────────────────────
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
      const contextPrefix = contextInput.value.trim()
        ? `Context: ${contextInput.value.trim()}\n\n`
        : '';
      const prompt = `
  ${contextPrefix}You are a professional translator. Do not add any comments.
  Translate the following text into ${sourceLang}.
  Return a JSON array of one string.

  1. ${txt}
  `;
      const { response } = await requestTranslation({
        model,
        prompt,
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

  // ── Clamp & collapse ──────────────────────────────────────────────────
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

  // ── Collapse / Expand Docking (Top-Left, Static Globe) ─────────────────
  let collapsed = true;

  function updateCollapsed() {
    if (collapsed) {
      // Dock toolbar at fixed top-left, small padding
      toolbar.style.top    = '10px';
      toolbar.style.left   = '10px';
      toolbar.style.right  = '';
      toolbar.style.bottom = '';
      toolbar.style.cursor = 'pointer';

      // Hide contents
      header.style.display    = 'none';
      container.style.display = 'none';
      toolbar.style.padding   = '4px';

      // Make the globe button static inside the toolbar
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
      // Expanded: restore draggable toolbar
      toolbar.style.cursor = 'move';
      // Keep the toolbar where it was collapsed (top/left stays)
      toolbar.style.padding = '8px';

      // Show contents
      header.style.display    = '';
      container.style.display = '';

      // Restore toggle button to absolute
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

      // Clamp it into view if it's gone off-screen
      ensureInView();
    }
  }

  // Flip collapsed state on click
  toggleBtn.onclick = () => {
    collapsed = !collapsed;
    updateCollapsed();
  };

  // Initialize
  updateCollapsed();

  // ── Scoped Text‐Node Collector ─────────────────────────────────────────
  function getTextNodes() {
    // try to restrict to <main> or #content if present
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
          // skip scripts/styles/inputs and our toolbar UI
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
    const prompt =
      `What language is this? Just respond with the language name:\n\n"${text}"`;
    const d = await requestTranslation({ model,prompt,stream:false });
    return d.response.trim();
  }

  async function translateBatch(batch) {
    let pre = '';
    if (contextInput.value.trim()) {
      pre = `Context: ${contextInput.value.trim()}\n\n`;
    }
    const prompt = `
${pre}You are a professional translator. No comments.
Translate each of the following segments into clear, natural English.
Return a JSON array of ${batch.length} strings, in the same order:

${batch.map((t,i)=>`${i+1}. ${t}`).join('\n')}
`;
    const { response } = await requestTranslation({
      model,prompt,stream:false
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

  // ── Main Translation Routine (Scoped) ─────────────────────────────────
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
          const contextPrefix = contextInput.value.trim()
            ? `Context: ${contextInput.value.trim()}\n\n`
            : '';
  
          const prompt = `
  ${contextPrefix}You are a professional translator. Do not add any comments.
  Translate the following into clear, natural English:
  
  "${originalText}"
  `;
  
          const { response } = await requestTranslation({
            model,
            prompt,
            stream: false
          });
  
          let translated = response.trim();
          const fenceRe = /```(?:json)?\s*([\s\S]*?)\s*```$/i;
          const match = translated.match(fenceRe);
          if (match) translated = match[1].trim();
          translated = translated.replace(/^`+|`+$/g, '').trim();
  
          if (translated && translated !== originalText) {
            // Store original text with node ID as key
            const nodeId = 'node_' + Date.now() + '_' + Math.random();
            originalTextMap.set(nodeId, {
              original: originalText,
              translated: translated
            });
            
            // Store the node ID directly on the node for easier retrieval
            node.ollamaId = nodeId;
  
            console.group('🛠 Replacing text node');
            console.log('Node:', node);
            console.log('Parent:', node.parentElement);
            console.log('Original:', JSON.stringify(originalText));
            console.log('Translated:', JSON.stringify(translated));
            console.groupEnd();
  
            node.nodeValue = translated;
            translatedNodes.add(node);

            // Apply highlighting if logs are enabled
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
  
    // Start workers
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
      if (!node || !node.parentElement) return; // Skip if node was removed
      
      // Get the node ID and stored texts
      const nodeId = node.ollamaId;
      if (!nodeId) return;
      
      const textData = originalTextMap.get(nodeId);
      if (!textData) return;
      
      // Toggle between original and translated
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

  // Selection translation
  async function translateSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      logStatus('No text selected');
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      logStatus('No text selected');
      return;
    }

    logStatus('Translating selection...');
    
    try {
      const contextPrefix = contextInput.value.trim()
        ? `Context: ${contextInput.value.trim()}\n\n`
        : '';
      
      const prompt = `
${contextPrefix}You are a professional translator. Do not add any comments.
Translate the following into clear, natural English:

"${text}"
`;

      const { response } = await requestTranslation({
        model,
        prompt,
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

      // Position near the selection
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      popup.style.left = `${rect.left + window.scrollX}px`;
      popup.style.top = `${rect.bottom + window.scrollY + 10}px`;

      // Add original and translated text
      const originalDiv = document.createElement('div');
      originalDiv.textContent = text;
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
      window.translationLog.push({ original: text, translated });
      
      logStatus('Selection translated');
    } catch (err) {
      console.error('❌ Translation error:', err);
      logStatus('Translation failed: ' + err.message);
    }
  }

  // wire up
  btnTranslate.onclick = runTranslation;
  btnSelection.onclick = translateSelection;
  btnToggleText.onclick = toggleOriginalText;

  // keyboard shortcuts
  document.addEventListener('keydown',e=>{
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      switch(e.key.toLowerCase()) {
        case 't': e.preventDefault(); runTranslation(); break;
        case 's': e.preventDefault(); translateSelection(); break;
        case 'o': e.preventDefault(); toggleOriginalText(); break;
      }
    }
  });

  // final helpers
  function logStatus(msg) {
    console.log(`[Ollama Translator] ${msg}`);
    status.textContent = msg;
  }
  function updateProgress(pct) {
    progressBar.style.width = `${pct}%`;
  }

})();