document.addEventListener('DOMContentLoaded', () => {
    // Ollama configuration elements
    const ollamaUrlInput = document.getElementById('ollamaUrlInput');
    const modelInput = document.getElementById('modelInput');
    const delayInput = document.getElementById('delayInput');
    const saveUrlBtn = document.getElementById('saveUrlBtn');
    const saveModelBtn = document.getElementById('saveModelBtn');
    const saveDelayBtn = document.getElementById('saveDelayBtn');
    const resetUrlBtn = document.getElementById('resetUrlBtn');
    const resetModelBtn = document.getElementById('resetModelBtn');
    const resetDelayBtn = document.getElementById('resetDelayBtn');
    const currentUrlDiv = document.getElementById('currentUrl');
    const currentModelDiv = document.getElementById('currentModel');
    const currentDelayDiv = document.getElementById('currentDelay');
    const configMessageDiv = document.getElementById('configMessage');
  
    // Domain exclusion elements
    const domainInput = document.getElementById('domainInput');
    const addDomainBtn = document.getElementById('addDomainBtn');
    const excludedDomainsList = document.getElementById('excludedDomainsList');
    const domainMessageDiv = document.getElementById('domainMessage');
  
    // Default values
    const DEFAULT_OLLAMA_URL = 'http://localhost:11434/api/generate';
    const DEFAULT_MODEL = 'gemma3:latest';
    const DEFAULT_DELAY = 300;
  
    // Load Ollama configuration
    function loadOllamaConfig() {
      chrome.storage.sync.get(['ollamaUrl', 'ollamaModel', 'translationDelay'], (result) => {
        const url = result.ollamaUrl || DEFAULT_OLLAMA_URL;
        const model = result.ollamaModel || DEFAULT_MODEL;
        const delay = result.translationDelay !== undefined ? result.translationDelay : DEFAULT_DELAY;
        
        ollamaUrlInput.value = url;
        modelInput.value = model;
        delayInput.value = delay;
        currentUrlDiv.textContent = `Current: ${url}`;
        currentModelDiv.textContent = `Current: ${model}`;
        currentDelayDiv.textContent = `Current: ${delay}ms`;
      });
    }
  
    // Save Ollama URL
    function saveOllamaUrl() {
      const url = ollamaUrlInput.value.trim();
      if (!url) {
        showConfigMessage('Please enter a valid URL.', 'red');
        return;
      }
  
      try {
        new URL(url);
      } catch (e) {
        showConfigMessage('Invalid URL format.', 'red');
        return;
      }
  
      chrome.storage.sync.set({ ollamaUrl: url }, () => {
        currentUrlDiv.textContent = `Current: ${url}`;
        showConfigMessage('Ollama URL saved successfully!', 'green');
      });
    }
  
    // Save model
    function saveModel() {
      const model = modelInput.value.trim();
      if (!model) {
        showConfigMessage('Please enter a valid model name.', 'red');
        return;
      }
  
      chrome.storage.sync.set({ ollamaModel: model }, () => {
        currentModelDiv.textContent = `Current: ${model}`;
        showConfigMessage('Model saved successfully!', 'green');
      });
    }
  
    // Save delay
    function saveDelay() {
      const delay = parseInt(delayInput.value);
      if (isNaN(delay) || delay < 0 || delay > 5000) {
        showConfigMessage('Please enter a valid delay between 0 and 5000 milliseconds.', 'red');
        return;
      }
  
      chrome.storage.sync.set({ translationDelay: delay }, () => {
        currentDelayDiv.textContent = `Current: ${delay}ms`;
        showConfigMessage('Translation delay saved successfully!', 'green');
      });
    }
  
    // Reset functions
    function resetOllamaUrl() {
      chrome.storage.sync.remove('ollamaUrl', () => {
        ollamaUrlInput.value = DEFAULT_OLLAMA_URL;
        currentUrlDiv.textContent = `Current: ${DEFAULT_OLLAMA_URL}`;
        showConfigMessage('Ollama URL reset to default.', 'green');
      });
    }
  
    function resetModel() {
      chrome.storage.sync.remove('ollamaModel', () => {
        modelInput.value = DEFAULT_MODEL;
        currentModelDiv.textContent = `Current: ${DEFAULT_MODEL}`;
        showConfigMessage('Model reset to default.', 'green');
      });
    }
  
    function resetDelay() {
      chrome.storage.sync.remove('translationDelay', () => {
        delayInput.value = DEFAULT_DELAY;
        currentDelayDiv.textContent = `Current: ${DEFAULT_DELAY}ms`;
        showConfigMessage('Translation delay reset to default.', 'green');
      });
    }
  
    // Domain functions (unchanged)
    function loadDomains() {
      chrome.storage.sync.get(['excludedDomains'], (result) => {
        const domains = result.excludedDomains || [];
        renderDomains(domains);
      });
    }
  
    function renderDomains(domains) {
      excludedDomainsList.innerHTML = '';
      domains.forEach((domain, index) => {
        const li = document.createElement('li');
  
        const domainSpan = document.createElement('span');
        domainSpan.textContent = domain;
        li.appendChild(domainSpan);
  
        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.onclick = () => {
          removeDomain(index);
        };
        li.appendChild(removeBtn);
  
        excludedDomainsList.appendChild(li);
      });
    }
  
    function addDomain() {
      const domain = domainInput.value.trim();
      if (!domain) {
        showDomainMessage('Please enter a domain.', 'red');
        return;
      }
  
      if (!isValidDomain(domain)) {
        showDomainMessage('Invalid domain format. Please use example.com or sub.example.com.', 'red');
        return;
      }
  
      chrome.storage.sync.get(['excludedDomains'], (result) => {
        const domains = result.excludedDomains || [];
        if (!domains.includes(domain)) {
          domains.push(domain);
          chrome.storage.sync.set({ excludedDomains: domains }, () => {
            renderDomains(domains);
            domainInput.value = '';
            showDomainMessage('Domain added successfully!', 'green');
          });
        } else {
          showDomainMessage('Domain already exists.', 'orange');
        }
      });
    }
  
    function removeDomain(index) {
      chrome.storage.sync.get(['excludedDomains'], (result) => {
        const domains = result.excludedDomains || [];
        domains.splice(index, 1);
        chrome.storage.sync.set({ excludedDomains: domains }, () => {
          renderDomains(domains);
          showDomainMessage('Domain removed.', 'green');
        });
      });
    }
  
    // Message functions
    function showConfigMessage(text, color) {
      configMessageDiv.textContent = text;
      configMessageDiv.style.color = color;
      setTimeout(() => {
        configMessageDiv.textContent = '';
      }, 3000);
    }
  
    function showDomainMessage(text, color) {
      domainMessageDiv.textContent = text;
      domainMessageDiv.style.color = color;
      setTimeout(() => {
        domainMessageDiv.textContent = '';
      }, 3000);
    }
  
    function isValidDomain(domain) {
      if (!domain || domain.length === 0) return false;
      if (domain.includes('127.0.0.1') || domain.includes('localhost')) return true;
      if (domain.startsWith('.') || domain.endsWith('.')) return false;
      return domain.includes('.') && !domain.includes(' ');
    }
  
    // Event listeners
    saveUrlBtn.addEventListener('click', saveOllamaUrl);
    saveModelBtn.addEventListener('click', saveModel);
    saveDelayBtn.addEventListener('click', saveDelay);
    resetUrlBtn.addEventListener('click', resetOllamaUrl);
    resetModelBtn.addEventListener('click', resetModel);
    resetDelayBtn.addEventListener('click', resetDelay);
  
    // Enter key support
    ollamaUrlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveOllamaUrl();
    });
    modelInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveModel();
    });
    delayInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') saveDelay();
    });
  
    addDomainBtn.addEventListener('click', addDomain);
    domainInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addDomain();
    });
  
    // Initial load
    loadOllamaConfig();
    loadDomains();
  });