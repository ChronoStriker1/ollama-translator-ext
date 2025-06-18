// content.js
(() => {
  "use strict";

  const ollamaUrl = "http://localhost:11434/api/generate";
  const model = "gemma3:latest";
  const delayMs = 300;
  const batchSize = 8;
  const originalTextMap = new WeakMap();
  window.translationLog = [];

  // Messaging helper: send payload to background & await response
  function requestTranslation(payload) {
    return new Promise((resolve, reject) => {
      const responseAction =
        "translationResult_" + Date.now() + "_" + Math.random();
      function handler(msg) {
        if (msg.action === responseAction) {
          chrome.runtime.onMessage.removeListener(handler);
          msg.error ? reject(new Error(msg.error)) : resolve(msg.data);
        }
      }
      chrome.runtime.onMessage.addListener(handler);
      chrome.runtime.sendMessage({
        action: "translate",
        payload,
        url: ollamaUrl,
        responseAction
      });
    });
  }

  // Build draggable toolbar
  const toolbar = document.createElement("div");
  Object.assign(toolbar.style, {
    position: "fixed",
    top: "10px",
    left: "10px",
    zIndex: 9999,
    background: "#222",
    color: "#fff",
    padding: "8px",
    borderRadius: "8px",
    fontFamily: "sans-serif",
    fontSize: "14px",
    boxShadow: "2px 2px 6px rgba(0,0,0,0.5)",
    opacity: "0.9",
    cursor: "move"
  });
  let isDragging = false, offsetX = 0, offsetY = 0;
  toolbar.addEventListener("mousedown", e => {
    isDragging = true;
    offsetX = e.offsetX;
    offsetY = e.offsetY;
  });
  document.addEventListener("mouseup", () => (isDragging = false));
  document.addEventListener("mousemove", e => {
    if (isDragging) {
      toolbar.style.top = `${e.clientY - offsetY}px`;
      toolbar.style.left = `${e.clientX - offsetX}px`;
    }
  });

  const header = document.createElement("div");
  header.textContent = "🌐 Ollama Translator";
  Object.assign(header.style, {
    fontWeight: "bold",
    marginBottom: "6px",
    userSelect: "none",
    cursor: "move"
  });

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "▼";
  Object.assign(toggleBtn.style, {
    position: "absolute",
    right: "10px",
    top: "10px",
    background: "#444",
    border: "none",
    color: "white",
    borderRadius: "3px",
    cursor: "pointer",
    padding: "2px 6px"
  });

  const container = document.createElement("div");
  container.style.marginTop = "4px";

  const btnTranslate = document.createElement("button");
  btnTranslate.textContent = "🌐 Translate";
  const btnToggle = document.createElement("button");
  btnToggle.textContent = "🔁 Toggle Original";
  for (const btn of [btnTranslate, btnToggle]) {
    Object.assign(btn.style, {
      margin: "3px",
      padding: "5px 10px",
      border: "none",
      borderRadius: "4px",
      background: "#444",
      color: "#fff",
      cursor: "pointer"
    });
  }

  const status = document.createElement("div");
  status.style = "margin-top:6px;font-size:12px";

  const progress = document.createElement("div");
  Object.assign(progress.style, {
    marginTop: "4px",
    height: "6px",
    background: "#555",
    borderRadius: "4px",
    overflow: "hidden"
  });
  const progressBar = document.createElement("div");
  Object.assign(progressBar.style, {
    height: "100%",
    width: "0%",
    background: "#4caf50",
    transition: "width 0.3s ease"
  });
  progress.appendChild(progressBar);

  container.append(btnTranslate, btnToggle, status, progress);
  toolbar.append(header, container, toggleBtn);
  document.body.appendChild(toolbar);

  let collapsed = false;
  toggleBtn.onclick = () => {
    collapsed = !collapsed;
    container.style.display = collapsed ? "none" : "block";
    toggleBtn.textContent = collapsed ? "▲" : "▼";
  };

  function logStatus(msg) {
    console.log(`[Ollama Translator] ${msg}`);
    status.textContent = msg;
  }
  function updateProgress(pct) {
    progressBar.style.width = `${pct}%`;
  }

  function getTextNodes() {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: node => {
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          const tag = node.parentElement?.tagName;
          if (
            !node.parentElement?.offsetParent ||
            ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"].includes(tag)
          )
            return NodeFilter.FILTER_REJECT;
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
    const data = await requestTranslation({
      model,
      prompt,
      stream: false
    });
    return data.response.trim();
  }

  async function translateBatch(batch) {
    const input = batch.map(t => `"${t}"`).join("\n");
    const prompt =
      `You are a professional translator. No comments. ` +
      `Just translate the following into clear, natural English:\n\n${input}`;
    const data = await requestTranslation({
      model,
      prompt,
      stream: false
    });
    return data.response
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
  }

  async function runTranslation() {
    const nodes = getTextNodes();
    const nonAscii = nodes.filter(
      n =>
        n.nodeValue.trim().length > 2 &&
        !/^[\x00-\x7F]+$/.test(n.nodeValue)
    );
    if (nonAscii.length === 0) {
      logStatus("No non-English text found.");
      return;
    }
    const sample = nonAscii
      .slice(0, 5)
      .map(n => n.nodeValue)
      .join(" ");
    const lang = await detectLanguage(sample);
    logStatus(`Detected: ${lang}`);
    if (/english/i.test(lang)) {
      alert("This page appears to be English already.");
      return;
    }
    if (!confirm(`Detected "${lang}". Translate to English?`)) return;

    logStatus(`Translating ${nonAscii.length} segments...`);
    updateProgress(0);
    let completed = 0;

    for (let i = 0; i < nonAscii.length; i += batchSize) {
      const slice = nonAscii.slice(i, i + batchSize);
      const texts = slice.map(n => n.nodeValue.trim());
      try {
        const translations = await translateBatch(texts);
        if (translations.length !== slice.length) {
          console.warn("⚠️ Batch size mismatch");
          continue;
        }
        for (let j = 0; j < slice.length; j++) {
          const node = slice[j];
          const orig = node.nodeValue.trim();
          const trans = translations[j];
          if (trans && trans !== orig) {
            originalTextMap.set(node, orig);
            node.nodeValue = trans;
            const p = node.parentElement;
            if (!p.getAttribute("data-original-title")) {
              p.setAttribute("title", orig);
              p.setAttribute("data-original-title", orig);
            }
            window.translationLog.push({ original: orig, translated: trans });
            completed++;
          }
        }
      } catch (err) {
        console.error("❌ Translation error:", err);
      }
      updateProgress((completed / nonAscii.length) * 100);
      await new Promise(r => setTimeout(r, delayMs));
    }

    updateProgress(100);
    logStatus(`✅ Translated ${completed} segments.`);
    alert(`✅ Done! Translated ${completed} segments.`);
  }

  function toggleOriginalText() {
    let toggled = 0;
    const nodes = getTextNodes();
    for (const node of nodes) {
      const orig = originalTextMap.get(node);
      if (orig) {
        const curr = node.nodeValue;
        const bkKey = node + "_backup";
        const backup = originalTextMap.get(bkKey) || curr;
        node.nodeValue = curr === orig ? backup : orig;
        originalTextMap.set(bkKey, curr);
        toggled++;
      }
    }
    logStatus(`🔁 Toggled ${toggled} segments.`);
  }

  btnTranslate.onclick = runTranslation;
  btnToggle.onclick = toggleOriginalText;
})();
