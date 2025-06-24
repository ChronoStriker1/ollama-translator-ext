Ollama Translator Extension - Enhanced
Grown way out of the orginal spec of just translating a webpage using whatever LLM I want via Ollama.

Extension Features

Based on the code structure, this extension provides:

1. 
Translation Engine:

	- Connects to local Ollama LLM for translation
	- Multiple bypass/jailbreak modes for handling content restrictions
	- Conversation mode for context-aware translations
	- Automatic language detection
	- Caching system for translations
2. 
OCR (Optical Character Recognition):

	- Multiple OCR providers: Tesseract.js, macOS Live Text, macOS Vision Framework, Google Cloud Vision
	- Area selection for OCR capture
	- Image preprocessing for better text recognition
	- Language-specific OCR settings
3. 
UI Components:

	- Draggable toolbar with translation controls
	- Context input for translation instructions
	- Custom translation instruction settings
	- Progress tracking and status display
	- Reverse translation capability
4. 
Page Translation:

	- Automatic detection and translation of non-ASCII text
	- Preserves original text formatting
	- Toggle between original and translated text
	- Inline review mode
5. 
Settings & Configuration:

	- Ollama server connection settings
	- OCR provider configuration
	- Domain exclusion list
	- Custom translation instructions
