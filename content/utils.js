// Utility functions - FIXED VERSION
class Utils {
  static getCacheKey(text, context, instruction) {
    return `${instruction || ''}|${context || ''}|${text}`;
  }

<<<<<<< HEAD
  static preserveFormatting(original, translated) {
    // If original has line breaks, try to preserve them
    if (original.includes('\n')) {
      const originalLines = original.split('\n');
      const translatedLines = translated.split('\n');
      
      // If translation already has similar structure, use it as-is
      if (Math.abs(originalLines.length - translatedLines.length) <= 1) {
        return translated;
      }
      
      // If translation is one big block but original has multiple lines
      if (originalLines.length > 1 && translatedLines.length === 1) {
        // Try to split the translation intelligently at sentence boundaries
        const sentences = translated.split(/([.!?。！？]\s*)/);
        const result = [];
        let currentLine = '';
        let sentenceIndex = 0;
        
        for (let i = 0; i < originalLines.length; i++) {
          const originalLine = originalLines[i].trim();
          
          if (originalLine === '') {
            // Empty line in original - preserve it
            result.push('');
          } else {
            // Try to build a line with appropriate length
            if (sentenceIndex < sentences.length) {
              currentLine = '';
              const targetLength = originalLine.length;
              
              // Collect sentences until we reach reasonable length or run out
              while (sentenceIndex < sentences.length && currentLine.length < targetLength * 1.5) {
                currentLine += sentences[sentenceIndex];
                sentenceIndex++;
                
                // Stop at sentence boundary if we have reasonable length
                if (currentLine.match(/[.!?。！？]\s*$/) && currentLine.length > targetLength * 0.5) {
                  break;
                }
              }
              
              result.push(currentLine.trim());
            } else {
              // No more sentences, use remaining text
              result.push(translated.substring(result.join('\n').length).trim());
              break;
            }
          }
        }
        
        // If we successfully created the right number of lines, use it
        if (result.length === originalLines.length) {
          return result.join('\n');
        }
      }
    }
    
    // Preserve leading/trailing whitespace from original
    const leadingWhitespace = original.match(/^\s*/)[0];
    const trailingWhitespace = original.match(/\s*$/)[0];
    
    return leadingWhitespace + translated.trim() + trailingWhitespace;
  }

  static cleanTranslationResponse(response) {
    if (!response || typeof response !== 'string') return '';
    
    let cleaned = response.trim();
    
    // Remove common prefixes
    const prefixes = [
      'I can translate that for you.',
      'The translation is:',
      'The translation of the given text from Japanese to English is:',
      'Here is the translation:',
      'Translation:',
      'English translation:',
      'The English translation is:',
      'Here\'s the translation:',
      'The English version is:',
      'In English:'
    ];
    
    for (const prefix of prefixes) {
      if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    }
    
    // Remove HTML tags that the LLM might add
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // Remove quotes if the entire response is wrapped in them
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    
    // Remove code block markers
    if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    // Remove leading newlines but preserve internal formatting
    cleaned = cleaned.replace(/^\n+/, '');
    
=======
  // FIXED: Simplified and more reliable formatting preservation
  static preserveFormatting(original, translated) {
    const leadingWhitespace = original.match(/^\s*/)[0];
    const trailingWhitespace = original.match(/\s*$/)[0];
    return leadingWhitespace + translated.trim() + trailingWhitespace;
  }

  // FIXED: More robust response cleaning
  static cleanTranslationResponse(response) {
    if (!response || typeof response !== 'string') return '';

    let cleaned = response.trim();
    let lastCleaned = '';

    // Iteratively clean the response until it no longer changes
    do {
      lastCleaned = cleaned;

      // Remove common conversational prefixes
      const prefixes = [
        'The translation is:',
        'Here is the translation:',
        'Translation:',
        'English translation:',
        'The English translation is:',
        "Here's the translation:",
        'The English version is:',
        'In English:',
        'English:',
      ];

      for (const prefix of prefixes) {
        if (cleaned.toLowerCase().startsWith(prefix.toLowerCase())) {
          cleaned = cleaned.substring(prefix.length).trim();
        }
      }

      // Remove quotes if the entire response is wrapped in them
      if (
        (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))
      ) {
        cleaned = cleaned.slice(1, -1).trim();
      }

      // Remove code block markers
      if (cleaned.startsWith('```') && cleaned.endsWith('```')) {
        cleaned = cleaned
          .replace(/^```[\w]*\n?/, '')
          .replace(/\n?```$/, '')
          .trim();
      }
    } while (cleaned !== lastCleaned); // Loop if changes were made

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    return cleaned;
  }

  static isRefusalResponse(response) {
    if (!response || typeof response !== 'string') return true;
<<<<<<< HEAD
    
    const trimmed = response.trim();
    if (trimmed.length === 0) return true;
    
=======

    const trimmed = response.trim();
    if (trimmed.length === 0) return true;

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    const refusalPatterns = [
      /I cannot (create|provide|translate|help with|fulfill)/i,
      /I (can't|couldn't) (create|provide|translate|help with|fulfill)/i,
      /(I'm|I am) (not able|unable) to/i,
      /I don't feel comfortable/i,
      /against my guidelines/i,
      /inappropriate content/i,
      /explicit content/i,
      /I'd be happy to help with other/i,
      /How about.*instead/i,
      /content policy/i,
      /safety guidelines/i,
      /not appropriate/i,
      /not an encoded message/i,
      /base64/i,
      /password is not secure/i,
      /I'm sorry, but I can't/i,
      /I'm not programmed to/i,
      /violates.*policy/i,
      /harmful.*content/i,
      /I'm designed to be helpful/i,
      /I should not/i,
      /I won't/i,
<<<<<<< HEAD
      /I refuse to/i
    ];
    
    const hasRefusalPattern = refusalPatterns.some(pattern => pattern.test(trimmed));
    
    // Check if response is too short and doesn't contain non-ASCII characters
    const isTooShort = trimmed.length < 3;
    const hasNoForeignChars = !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0400-\u04FF\u0100-\u017F\u00C0-\u024F\u1E00-\u1EFF]/.test(trimmed);
    
=======
      /I refuse to/i,
    ];

    const hasRefusalPattern = refusalPatterns.some((pattern) =>
      pattern.test(trimmed)
    );

    // Check if response is too short and doesn't contain non-ASCII characters
    const isTooShort = trimmed.length < 3;
    const hasNoForeignChars =
      !/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u0400-\u04FF\u0100-\u017F\u00C0-\u024F\u1E00-\u1EFF]/.test(
        trimmed
      );

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    return hasRefusalPattern || (isTooShort && hasNoForeignChars);
  }

  static getTextNodes(onlyVisible = false, visibleNodes = null) {
<<<<<<< HEAD
    console.log('🔍 getTextNodes called with:', { onlyVisible, visibleNodesSize: visibleNodes?.size });
    
=======
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const text = node.nodeValue.trim();
<<<<<<< HEAD
        
          // Skip empty text
          if (text.length === 0) return NodeFilter.FILTER_REJECT;
        
          // Skip if parent is script, style, or other non-content elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
        
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'meta', 'title', 'head'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
        
          // Skip if node is part of the extension's UI
          const toolbar = document.getElementById('ollama-translator-toolbar');
          if (toolbar && (toolbar.contains(parent) || parent.closest('#ollama-translator-toolbar'))) {
=======

          // Skip empty text
          if (text.length === 0) return NodeFilter.FILTER_REJECT;

          // Skip if parent is script, style, or other non-content elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (
            ['script', 'style', 'noscript', 'meta', 'title', 'head'].includes(
              tagName
            )
          ) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip if node is part of the extension's UI
          const toolbar = document.getElementById('ollama-translator-toolbar');
          if (
            toolbar &&
            (toolbar.contains(parent) ||
              parent.closest('#ollama-translator-toolbar'))
          ) {
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
            return NodeFilter.FILTER_REJECT;
          }

          // Skip OCR UI elements
<<<<<<< HEAD
          if (parent.closest('.ocr-control-panel') || parent.closest('#ocr-selection-overlay')) {
            return NodeFilter.FILTER_REJECT;
          }
        
=======
          if (
            parent.closest('.ocr-control-panel') ||
            parent.closest('#ocr-selection-overlay')
          ) {
            return NodeFilter.FILTER_REJECT;
          }

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
          // Skip very short text
          if (text.length < 2) {
            return NodeFilter.FILTER_REJECT;
          }
<<<<<<< HEAD
        
=======

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
          // Only process text with non-ASCII characters
          const hasNonAscii = /[^\x00-\x7F]/.test(text);
          if (!hasNonAscii) {
            return NodeFilter.FILTER_REJECT;
          }
<<<<<<< HEAD
          
          // Skip URLs
          if (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('www.') || 
            /^https?:\/\//.test(text) || /^www\./.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          
=======

          // Skip URLs
          if (
            text.startsWith('http://') ||
            text.startsWith('https://') ||
            text.startsWith('www.') ||
            /^https?:\/\//.test(text) ||
            /^www\./.test(text)
          ) {
            return NodeFilter.FILTER_REJECT;
          }

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
          // Check visibility if requested
          if (onlyVisible && visibleNodes && !visibleNodes.has(parent)) {
            return NodeFilter.FILTER_REJECT;
          }
<<<<<<< HEAD
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
=======

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }
<<<<<<< HEAD
    
    console.log('🔍 Total nodes found:', nodes.length);
=======

>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
    return nodes;
  }

  static async delay(ms) {
<<<<<<< HEAD
    return new Promise(resolve => setTimeout(resolve, ms));
=======
    return new Promise((resolve) => setTimeout(resolve, ms));
>>>>>>> 3216674 (Debugged Vision about as much as possible, it works well with horizonal text but chokes on vertical.)
  }

  static logWithGroup(title, content, isError = false) {
    if (window.ollamaTranslator?.translationEngine?.showLogs) {
      console.group(title);
      if (isError) {
        console.error(content);
      } else {
        console.log(content);
      }
      console.groupEnd();
    }
  }
}

// Make Utils globally available
window.Utils = Utils;