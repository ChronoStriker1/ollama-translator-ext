// options.js

document.addEventListener('DOMContentLoaded', () => {
  const domainInput = document.getElementById('domainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const excludedDomainsList = document.getElementById('excludedDomainsList');
  const messageDiv = document.getElementById('message');

  // Load excluded domains from storage
  function loadDomains() {
    chrome.storage.sync.get(['excludedDomains'], (result) => {
      const domains = result.excludedDomains || [];
      renderDomains(domains);
    });
  }

  // Render the list of domains
  function renderDomains(domains) {
    excludedDomainsList.innerHTML = ''; // Clear current list
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

  // Add a domain to storage
  function addDomain() {
    const domain = domainInput.value.trim();
    if (!domain) {
      showMessage('Please enter a domain.', 'red');
      return;
    }

    // Basic domain validation (optional but good practice)
    if (!isValidDomain(domain)) {
        showMessage('Invalid domain format. Please use example.com or sub.example.com.', 'red');
        return;
    }

    chrome.storage.sync.get(['excludedDomains'], (result) => {
      const domains = result.excludedDomains || [];
      if (!domains.includes(domain)) {
        domains.push(domain);
        chrome.storage.sync.set({ excludedDomains: domains }, () => {
          renderDomains(domains);
          domainInput.value = ''; // Clear input
          showMessage('Domain added successfully!', 'green');
        });
      } else {
        showMessage('Domain already exists.', 'orange');
      }
    });
  }

  // Remove a domain from storage
  function removeDomain(index) {
    chrome.storage.sync.get(['excludedDomains'], (result) => {
      const domains = result.excludedDomains || [];
      domains.splice(index, 1);
      chrome.storage.sync.set({ excludedDomains: domains }, () => {
        renderDomains(domains);
        showMessage('Domain removed.', 'green');
      });
    });
  }

  // Show temporary messages
  function showMessage(text, color) {
    messageDiv.textContent = text;
    messageDiv.style.color = color;
    setTimeout(() => {
      messageDiv.textContent = '';
    }, 3000);
  }

  // Simple domain validation (checks for at least one dot, not starting/ending with dot)
  function isValidDomain(domain) {
      if (!domain || domain.length === 0) return false;
      if (domain.startsWith('.') || domain.endsWith('.')) return false;
      // A more robust check would use regex, but this is basic
      return domain.includes('.') && !domain.includes(' ');
  }

  // Event listeners
  addDomainBtn.addEventListener('click', addDomain);
  domainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomain();
    }
  });

  // Initial load
  loadDomains();
});