/**
 * Custom Block Handler
 * Manages the UI for creating and configuring custom LangChain blocks
 */

class CustomBlockHandler {
    constructor() {
        this.libraries = [];
        this.modules = [];
        this.classes = [];
        this.selectedLibrary = null;
        this.selectedModule = null;
        this.selectedClass = null;
        this.classDetails = null;
        this.selectedMethods = [];
        this.inputNodes = [];
        this.outputNodes = [];
        this.parameters = {};

        // Modal elements - will be initialized when the modal is created
        this.modal = null;
        this.librarySelect = null;
        this.moduleSelect = null;
        this.classSelect = null;
        this.methodsContainer = null;
        this.nodesContainer = null;
        this.parametersContainer = null;

        // Initialize event handler references
        this.onLibraryChangeHandler = null;
        this.onModuleChangeHandler = null;
        this.onClassChangeHandler = null;

        this.initModal();
    }

    /**
     * Initialize the custom block modal
     */
    initModal() {
        // Check if the modal already exists
        const existingModal = document.getElementById('custom-block-modal');
        if (existingModal) {
            this.modal = existingModal;
            this.initModalElements();
            return;
        }

        // Create modal HTML structure
        const modalHTML = `
            <div id="custom-block-modal" class="modal">
                <div class="modal-content">
                    <span class="close-modal">&times;</span>
                    <h2>Create Custom LangChain Block</h2>

                    <div class="tabs">
                        <div class="tab-header">
                            <div class="tab-btn active" data-tab="select-class">1. Choose Your Block Type</div>
                            <div class="tab-btn" data-tab="methods">2. Add Functions</div>
                            <div class="tab-btn" data-tab="edit-parameters">3. Set Up Your Block</div>
                            <div class="tab-btn" data-tab="io-nodes">4. Connect Your Block</div>
                        </div>

                        <div class="tab-content active" data-tab="select-class">
                            <div class="form-group">
                                <label for="library-select">Select LangChain Library:</label>
                                <select id="library-select">
                                    <option value="">Loading libraries...</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="module-select">Select Module:</label>
                                <select id="module-select" disabled>
                                    <option value="">Select a library first</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="class-select">Choose Block Type:</label>
                                <select id="class-select" disabled>
                                    <option value="">Select a module first</option>
                                </select>
                            </div>

                            <div class="class-description"></div>
                        </div>

                        <div class="tab-content" data-tab="methods">
                            <h3>Select Methods to Include</h3>
                            <div id="methods-container">
                                <p>Select a class first</p>
                            </div>
                        </div>

                        <div class="tab-content" data-tab="edit-parameters">
                            <h3>Set Up Your Block</h3>
                            <div id="parameters-container">
                                <p>Select methods first</p>
                            </div>
                        </div>

                        <div class="tab-content" data-tab="io-nodes">
                            <h3>Configure Input/Output Nodes</h3>
                            <div id="nodes-container">
                                <div class="input-nodes-section">
                                    <h4>Input Nodes</h4>
                                    <button id="add-input-node" class="add-node-btn">+ Add Input Node</button>
                                    <div id="input-nodes-list"></div>
                                </div>

                                <div class="output-nodes-section">
                                    <h4>Output Nodes</h4>
                                    <button id="add-output-node" class="add-node-btn">+ Add Output Node</button>
                                    <div id="output-nodes-list"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button id="prev-tab" class="tab-nav-btn" disabled>Previous</button>
                        <button id="next-tab" class="tab-nav-btn">Next</button>
                        <button id="create-block-btn" class="primary-btn" style="display: none;">Create Block</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('custom-block-modal');

        this.initModalElements();
    }

    /**
     * Initialize modal elements and event listeners
     */
    initModalElements() {
        // Initialize modal elements
        this.librarySelect = document.getElementById('library-select');
        this.moduleSelect = document.getElementById('module-select');
        this.classSelect = document.getElementById('class-select');
        this.methodsContainer = document.getElementById('methods-container');
        this.nodesContainer = document.getElementById('nodes-container');
        this.parametersContainer = document.getElementById('parameters-container');

        // Add event listeners
        const closeBtn = this.modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => this.closeModal());

        // Tab navigation
        const tabBtns = this.modal.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Next/Prev buttons
        const nextBtn = document.getElementById('next-tab');
        const prevBtn = document.getElementById('prev-tab');
        const createBtn = document.getElementById('create-block-btn');

        nextBtn.addEventListener('click', () => this.nextTab());
        prevBtn.addEventListener('click', () => this.prevTab());
        createBtn.addEventListener('click', () => this.createBlock());

        // Initialize select change event listeners
        this.initEventListeners();

        // Input/Output node buttons
        const addInputNodeBtn = document.getElementById('add-input-node');
        const addOutputNodeBtn = document.getElementById('add-output-node');

        addInputNodeBtn.addEventListener('click', () => this.addInputNode());
        addOutputNodeBtn.addEventListener('click', () => this.addOutputNode());

        // Load available libraries
        this.loadLibraries();
    }

    /**
     * Initialize selector event listeners with proper binding
     */
    initEventListeners() {
        // Define handlers with proper binding to maintain 'this' context
        this.onLibraryChangeHandler = this.onLibraryChange.bind(this);
        this.onModuleChangeHandler = this.onModuleChange.bind(this);
        this.onClassChangeHandler = this.onClassChange.bind(this);

        // Add event listeners
        this.librarySelect.addEventListener('change', this.onLibraryChangeHandler);
        this.moduleSelect.addEventListener('change', this.onModuleChangeHandler);
        this.classSelect.addEventListener('change', this.onClassChangeHandler);
    }

    /**
     * Show the custom block modal
     */
    showModal() {
        // Ensure modal element exists
        if (!this.modal) {
            this.initModal();
        }

        // Reset form to initial state when opening
        this.resetForm();

        // Set display style to flex to center content
        this.modal.style.display = 'block';

        // Apply custom styles for scrolling
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Make sure the modal is scrollable
        this.modal.querySelector('.modal-content').style.maxHeight = '80vh';
        this.modal.querySelector('.modal-content').style.overflowY = 'auto';

        // Ensure we have the latest libraries
        this.loadLibraries();

        // Switch to first tab
        this.switchTab('select-class');
    }

    /**
     * Close the custom block modal
     */
    closeModal() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.style.overflow = ''; // Restore body scrolling
        }
    }

    /**
     * Switch to a specific tab
     * @param {string} tabId - The ID of the tab to switch to
     */
    switchTab(tabId) {
        // Ensure current selections are saved before switching tabs
        if (tabId !== 'select-class' && this.classSelect && this.moduleSelect) {
            this.selectedClass = this.classSelect.value;
            this.selectedModule = this.moduleSelect.value;
            console.log('Tab switch - saved values:', this.selectedClass, this.selectedModule);
        }

        // Update tab button states
        const tabBtns = this.modal.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            }
        });

        // Update tab content states
        const tabContents = this.modal.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.dataset.tab === tabId) {
                content.classList.add('active');
            }
        });

        // Update footer buttons
        const nextBtn = document.getElementById('next-tab');
        const prevBtn = document.getElementById('prev-tab');
        const createBtn = document.getElementById('create-block-btn');

        // Show/hide buttons based on current tab
        if (tabId === 'select-class') {
            prevBtn.disabled = true;
            nextBtn.style.display = 'inline-block';
            createBtn.style.display = 'none';
        } else if (tabId === 'io-nodes') {
            nextBtn.style.display = 'none';
            createBtn.style.display = 'inline-block';
            prevBtn.disabled = false;
        } else {
            prevBtn.disabled = false;
            nextBtn.style.display = 'inline-block';
            createBtn.style.display = 'none';
        }
    }

    /**
     * Navigate to the next tab
     */
    nextTab() {
        const currentTabBtn = this.modal.querySelector('.tab-btn.active');
        const tabBtns = Array.from(this.modal.querySelectorAll('.tab-btn'));
        const currentIndex = tabBtns.indexOf(currentTabBtn);

        // Check if we need to validate the current tab
        if (currentTabBtn.dataset.tab === 'select-class') {
            // Make sure a class is selected before proceeding
            if (!this.classSelect.value) {
                alert('Please select a class before proceeding');
                return;
            }
            // Make sure we save the values
            this.selectedClass = this.classSelect.value;
            this.selectedModule = this.moduleSelect.value;
        }

        if (currentIndex < tabBtns.length - 1) {
            const nextTabId = tabBtns[currentIndex + 1].dataset.tab;
            this.switchTab(nextTabId);
        }
    }

    /**
     * Navigate to the previous tab
     */
    prevTab() {
        const currentTabBtn = this.modal.querySelector('.tab-btn.active');
        const tabBtns = Array.from(this.modal.querySelectorAll('.tab-btn'));
        const currentIndex = tabBtns.indexOf(currentTabBtn);

        if (currentIndex > 0) {
            const prevTabId = tabBtns[currentIndex - 1].dataset.tab;
            this.switchTab(prevTabId);
        }
    }

    /**
     * Load available LangChain libraries
     */
    async loadLibraries() {
        try {
            const response = await fetch('/api/langchain/libraries');
            const data = await response.json();

            this.libraries = data.libraries || [];

            // Update library select options
            this.librarySelect.innerHTML = '';
            this.librarySelect.appendChild(new Option('Select a library', ''));

            this.libraries.forEach(library => {
                this.librarySelect.appendChild(new Option(library, library));
            });

            // Set default if langchain_community is available
            if (this.libraries.includes('langchain_community')) {
                this.librarySelect.value = 'langchain_community';
                this.onLibraryChange();
            }
        } catch (error) {
            console.error('Error loading libraries:', error);
            this.librarySelect.innerHTML = '<option value="">Error loading libraries</option>';
        }
    }

    /**
     * Handle library selection change
     */
    async onLibraryChange() {
        this.selectedLibrary = this.librarySelect.value;
        this.moduleSelect.disabled = !this.selectedLibrary;
        this.moduleSelect.innerHTML = '<option value="">Loading modules...</option>';
        this.classSelect.innerHTML = '<option value="">Select a module first</option>';
        this.classSelect.disabled = true;

        if (!this.selectedLibrary) {
            this.moduleSelect.innerHTML = '<option value="">Select a library first</option>';
            return;
        }

        try {
            const response = await fetch(`/api/langchain/modules?library=${this.selectedLibrary}`);
            const data = await response.json();

            this.modules = data.modules || [];

            // Update module select options
            this.moduleSelect.innerHTML = '';
            this.moduleSelect.appendChild(new Option('Select a module', ''));

            this.modules.forEach(module => {
                // Display only the last part of the module path
                const displayName = module.split('.').pop();
                this.moduleSelect.appendChild(new Option(displayName, module));
            });

            // If document_loaders exists, select it by default
            const documentLoaders = this.modules.find(m => m.endsWith('document_loaders'));
            if (documentLoaders) {
                this.moduleSelect.value = documentLoaders;
                this.onModuleChange();
            }

            this.moduleSelect.disabled = false;
        } catch (error) {
            console.error('Error loading modules:', error);
            this.moduleSelect.innerHTML = '<option value="">Error loading modules</option>';
        }
    }

    /**
     * Handle module selection change
     */
    async onModuleChange() {
        const moduleSelect = document.getElementById('module-select');
        const classSelect = document.getElementById('class-select');
        const selectedModule = moduleSelect.value;

        // Clear and disable class select
        classSelect.innerHTML = '<option value="">Select a class...</option>';
        classSelect.disabled = true;

        if (!selectedModule) {
            return;
        }

        try {
            // Fetch classes for the selected module
            const response = await fetch(`/api/langchain/classes?module=${selectedModule}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            // Add classes to select
            data.classes.forEach(className => {
                const option = document.createElement('option');
                option.value = className;
                option.textContent = className;
                classSelect.appendChild(option);
            });

            // Enable class select
            classSelect.disabled = false;

            // Reset class selection
            this.selectedClass = null;
            this.classDetails = null;
            this.selectedMethods = [];
            this.parameters = {};

            // Clear methods and parameters containers
            this.methodsContainer.innerHTML = '';
            this.parametersContainer.innerHTML = '';

            // Reset nodes
            this.inputNodes = [];
            this.outputNodes = [];
            this.updateNodesDisplay();
        } catch (error) {
            console.error('Error fetching classes:', error);
            showToast(`Error loading classes: ${error.message}`, 'error');
        }
    }

    /**
     * Handle class selection change
     */
    async onClassChange() {
        const selectedClass = this.classSelect.value;
        if (!selectedClass) {
            return;
        }

        this.selectedClass = selectedClass;
        this.parameters = {}; // Clear parameters when changing class

        try {
            // Get library and module from selects
            const library = this.librarySelect.value;
            const module = this.moduleSelect.value;

            // Save module info for later use
            saveModuleInfo(selectedClass, library, module);

            // Fetch class details
            const response = await fetch(`/api/langchain/class_details?library=${library}&module=${module}&class_name=${selectedClass}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            this.classDetails = data;

            // Create a comprehensive class information display
            const description = this.modal.querySelector('.class-description');
            
            // Add class name header and formatted docstring
            description.innerHTML = `
                <div class="class-name-header">
                    <h3>${selectedClass}</h3>
                    <div class="class-path">${library}.${module}.${selectedClass}</div>
                </div>
                <div class="docstring-content">
                    ${this.formatDocstring(data.doc || 'No description available.')}
                </div>
            `;

            // Initialize collapsible sections
            this.initCollapsibleSections();

            // Add common input/output nodes based on the component type
            if (data.component_type) {
                console.log(`Auto-suggesting nodes for component type: ${data.component_type}`);
                this.suggestDefaultNodesForType(data.component_type);
            } else {
                // If no component_type, use the class name to guess
                this.suggestDefaultNodes();
            }

            // Update methods container
            this.updateMethodsContainer();
        } catch (error) {
            console.error('Error loading class details:', error);
            const description = this.modal.querySelector('.class-description');
            description.innerHTML = `<p class="error">Error loading class details: ${error.message}</p>`;
            this.methodsContainer.innerHTML = `<p class="error">Failed to load methods: ${error.message}</p>`;
        }
    }

    /**
     * Initialize collapsible sections
     */
    initCollapsibleSections() {
        // Find all collapsible sections
        const collapsibleSections = this.modal.querySelectorAll('.collapsible-section');
        
        // Add click event listeners to each collapsible header
        collapsibleSections.forEach(section => {
            const header = section.querySelector('.collapsible-header');
            
            header.addEventListener('click', () => {
                // Toggle the expanded class
                section.classList.toggle('expanded');
            });
        });
    }

    /**
     * Format a docstring with proper HTML formatting
     * @param {string} docstring - The raw docstring text
     * @returns {string} - Formatted HTML
     */
    formatDocstring(docstring) {
        if (!docstring || typeof docstring !== 'string') {
            return '<p>No description available.</p>';
        }

        let formatted = docstring;
        
        // Handle deprecation notices - these often start with ".. deprecated::" or similar text
        const deprecationRegex = /\.\.?\s*deprecated:?:?|\bdeprecated\b[.:]\s*(.*?)(?=\n\n|\n[^\s]|$)/i;
        const deprecationMatch = formatted.match(deprecationRegex);
        
        if (deprecationMatch) {
            // Extract the deprecation message and remove it from the main text
            const deprecationMessage = deprecationMatch[0];
            formatted = formatted.replace(deprecationRegex, '');
            
            // Add it back as a styled warning box
            formatted = `<div class="deprecation-warning">⚠️ ${deprecationMessage}</div>${formatted}`;
        }

        // Detect installation section
        const installRegex = /Set?up:?\s*Install/i;
        if (installRegex.test(formatted)) {
            // Wrap the installation section in a themed container
            formatted = formatted.replace(/(Set?up:?\s*Install[\s\S]*?)(?=\n\n[A-Z]|\n[A-Z]|$)/i, 
                '<div class="install-section"><h4>Installation</h4>$1</div>');
        }

        // Detect usage example sections
        const usageRegex = /(?:Usage|Instantiate|Example|Lazy load):/i;
        if (usageRegex.test(formatted)) {
            // Wrap usage examples in a themed container
            formatted = formatted.replace(/((?:Usage|Instantiate|Example|Lazy load):[\s\S]*?)(?=\n\n[A-Z]|\n[A-Z]|$)/gi, 
                '<div class="usage-section"><h4>$1</div>');
            
            // Fix the heading format
            formatted = formatted.replace(/<h4>((?:Usage|Instantiate|Example|Lazy load)):([\s\S]*?)<\/div>/gi, 
                '<h4>$1</h4>$2</div>');
        }

        // Convert URLs to clickable links
        formatted = formatted.replace(
            /(https?:\/\/[^\s\)]+)/g, 
            '<a href="$1" target="_blank" rel="noopener noreferrer" class="url">$1 <span class="external-link-icon">↗</span></a>'
        );
        
        // Detect and format class references like `langchain_google_community.BigQueryLoader`
        formatted = formatted.replace(
            /`?([a-zA-Z0-9_]+\.)*[A-Z][a-zA-Z0-9_]+(Loader|Chain|Model|Store|Splitter|Processor|Parser|Retriever|Embeddings?)`?/g,
            match => {
                // Remove any backticks that might be present
                const cleanMatch = match.replace(/`/g, '');
                return `<span class="class-reference">${cleanMatch}</span>`;
            }
        );
        
        // IMPROVED: First, extract and temporarily store all code blocks to prevent processing inside them
        const codeBlocks = [];
        let codeBlockCounter = 0;
        
        // Process RST style code-blocks with language indicators
        formatted = formatted.replace(
            /\.\.\s*code-block::\s*(\w+)\s*\n\s*([\s\S]*?)(?=\n\n\S|\n\S\S|\n\.\.|$)/g,
            (match, language, code) => {
                // Store the code block
                const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
                codeBlocks.push({
                    placeholder,
                    language,
                    code: code.trim()
                });
                codeBlockCounter++;
                return placeholder;
            }
        );
        
        // IMPROVED: Handle Python code blocks with triple backticks - improved regex for multi-line examples
        formatted = formatted.replace(
            /```(?:(python|bash|javascript|js|html|css|json|yaml|xml))?\n([\s\S]*?)```/g,
            (match, language, code) => {
                // Store the code block
                const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
                codeBlocks.push({
                    placeholder,
                    language: language || 'python', // Default to python if language not specified
                    code: code.trim()
                });
                codeBlockCounter++;
                return placeholder;
            }
        );
        
        // IMPROVED: Detect Python examples marked with >>> and ... continuations
        // This pattern looks for consecutive lines starting with >>> or ...
        let pythonConsoleExample = '';
        let inConsoleExample = false;
        
        const lines = formatted.split('\n');
        const newLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            if (trimmedLine.startsWith('>>>') || trimmedLine.startsWith('...')) {
                if (!inConsoleExample) {
                    // Start a new console example
                    inConsoleExample = true;
                    pythonConsoleExample = line;
                } else {
                    // Continue the current example
                    pythonConsoleExample += '\n' + line;
                }
            } else if (inConsoleExample && (trimmedLine === '' || /^\s+\S/.test(line))) {
                // Empty line or indented line within a code block - keep it part of the example
                pythonConsoleExample += '\n' + line;
            } else if (inConsoleExample) {
                // End of console example
                const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
                codeBlocks.push({
                    placeholder,
                    language: 'python',
                    code: pythonConsoleExample.trim(),
                    isConsole: true
                });
                codeBlockCounter++;
                
                inConsoleExample = false;
                newLines.push(placeholder);
                newLines.push(line); // Add the current line
            } else {
                newLines.push(line);
            }
        }
        
        // Handle case where console example is at the end of the content
        if (inConsoleExample) {
            const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
            codeBlocks.push({
                placeholder,
                language: 'python',
                code: pythonConsoleExample.trim(),
                isConsole: true
            });
            newLines.push(placeholder);
        }
        
        formatted = newLines.join('\n');
        
        // IMPROVED: Detect and combine import statements with subsequent code
        // This is a common pattern in LangChain docstrings
        formatted = formatted.replace(
            /(?:\n|^)((?:from|import)\s+[\w\.]+(?:\s+import\s+[\w\.,\s]+)?(?:\n(?:from|import)\s+[\w\.]+(?:\s+import\s+[\w\.,\s]+)?)*)\n+((?:[^\n]+\n)+?(?=\n|$))/g,
            (match, imports, code) => {
                // Check if this looks like Python code following imports
                if (/\s*[a-zA-Z_][a-zA-Z0-9_]*\s*=|[a-zA-Z_][a-zA-Z0-9_]*\(/.test(code)) {
                    const placeholder = `__CODE_BLOCK_${codeBlockCounter}__`;
                    codeBlocks.push({
                        placeholder,
                        language: 'python',
                        code: `${imports.trim()}\n\n${code.trim()}`
                    });
                    codeBlockCounter++;
                    return placeholder;
                }
                return match;
            }
        );
        
        // Format inline code (but not inside our code block placeholders)
        formatted = formatted.replace(
            /`([^`]+)`/g,
            (match, code, offset) => {
                // Check if we're inside a code block placeholder
                for (const block of codeBlocks) {
                    if (formatted.substring(0, offset).includes(block.placeholder)) {
                        return match; // Inside placeholder, leave as is
                    }
                }
                return '<code class="inline-code">' + code + '</code>';
            }
        );

        // Format parameter names specifically
        formatted = formatted.replace(
            /\b(web_path|header_template|verify_ssl|file_path)\b/g,
            '<span class="parameter-name">$1</span>'
        );

        // Format technical terms and file formats as inline code
        // This captures common technical terms that should be formatted as code
        const technicalTerms = [
            'XML', 'JSON', 'CSV', 'YAML', 'HTML', 'PDF', 'DOCX', 'TXT',
            'unstructured', 'langchain', 'python', 'mode=', 'strategy=',
            'BigQuery', 'Google Cloud Platform', 'metadata_columns', 'page_content_columns',
            'lazy_load', 'docs', 'loader', 'append', 'print', 'None', 'True', 'False'
        ];
        
        // Create a regex that matches these terms as whole words
        const techTermsRegex = new RegExp(`\\b(${technicalTerms.join('|')})\\b`, 'g');
        formatted = formatted.replace(techTermsRegex, (match) => {
            // Don't reformat if already in a code element
            if (formatted.includes(`<code class="inline-code">${match}</code>`) || 
                formatted.includes(`<span class="parameter-name">${match}</span>`)) {
                return match;
            }
            return `<code class="inline-code">${match}</code>`;
        });

        // Create collapsible sections for long examples
        formatted = this.createCollapsibleSections(formatted);

        // Format common sections with headers
        const commonSections = [
            "Parameters:", "Returns:", "Examples:", "Example:", 
            "Usage:", "Notes:", "Note:", "Args:", "Arguments:",
            "Attributes:", "Raises:", "Exceptions:", "References:"
        ];
        
        // Process section titles
        for (const section of commonSections) {
            // Only replace if the section is at the beginning of a line (possibly with whitespace)
            const sectionRegex = new RegExp(`(^|\\n)\\s*(${section})\\s*`, 'g');
            formatted = formatted.replace(sectionRegex, (match, p1, p2) => {
                // Don't replace if it's already in an h4 tag
                if (formatted.includes(`<h4>${p2}</h4>`)) {
                    return match;
                }
                return `${p1}<h4>${p2}</h4>`;
            });
        }

        // Format parameter sections (assuming they start with "Parameters:")
        if (formatted.includes("<h4>Parameters:</h4>") || formatted.includes("<h4>Args:</h4>")) {
            const paramSectionRegex = /<h4>(Parameters:|Args:)<\/h4>([\s\S]*?)(?=<h4>|$)/;
            const paramMatch = formatted.match(paramSectionRegex);
            
            if (paramMatch) {
                // Extract the parameter section
                const paramSection = paramMatch[2];
                
                // Format the parameters as a list
                const formattedParams = this.formatParameterList(paramSection);
                
                // Replace the original parameter section with the formatted one
                formatted = formatted.replace(
                    paramSectionRegex, 
                    `<h4>${paramMatch[1]}</h4>${formattedParams}`
                );
            }
        }
        
        // Add paragraph breaks (preserve existing structure)
        formatted = formatted.replace(/\n\s*\n/g, '</p><p>');
        
        // Wrap in paragraph tags if not already wrapped
        if (!formatted.startsWith('<p>') && !formatted.startsWith('<h4>') && 
            !formatted.startsWith('<div class="deprecation-warning">') &&
            !formatted.startsWith('<div class="install-section">') &&
            !formatted.startsWith('<div class="usage-section">') &&
            !formatted.startsWith('<div class="collapsible-section">')) {
            formatted = '<p>' + formatted + '</p>';
        }
        
        // IMPROVED: Now replace all code block placeholders with their formatted HTML
        for (const block of codeBlocks) {
            // Apply syntax highlighting to code
            let highlightedCode = this.applySyntaxHighlighting(block.code);
            
            const copyButton = `<button class="copy-button" onclick="navigator.clipboard.writeText(this.parentNode.textContent.replace(/.*Copy.*/,''))">Copy</button>`;
            let formattedBlock;
            
            if (block.isConsole) {
                formattedBlock = `<pre class="python-example" data-language="${block.language}">${copyButton}<code>${highlightedCode}</code></pre>`;
            } else {
                formattedBlock = `<pre class="code-block" data-language="${block.language}">${copyButton}<code>${highlightedCode}</code></pre>`;
            }
            
            // Replace placeholder with actual formatted code block
            formatted = formatted.replace(block.placeholder, formattedBlock);
        }
        
        return formatted;
    }
    
    /**
     * Create collapsible sections for long content blocks
     * @param {string} formatted - The formatted HTML content
     * @returns {string} - HTML with collapsible sections
     */
    createCollapsibleSections(formatted) {
        // Find sections that might benefit from being collapsible
        
        // Create collapsible section for long parameter tables
        if (formatted.includes('<div class="parameter-table">') && 
            (formatted.match(/<div class="parameter-item/g) || []).length > 5) {
            // Count parameter items
            formatted = formatted.replace(
                /(<h4>(Parameters:|Args:)<\/h4>)([\s\S]*?)(<div class="parameter-table">[\s\S]*?<\/div>)/g,
                (match, h4Start, title, spacer, table) => {
                    return `${h4Start}${spacer}<div class="collapsible-section">
                        <div class="collapsible-header">${title} Table</div>
                        <div class="collapsible-content">${table}</div>
                    </div>`;
                }
            );
        }
        
        // Create collapsible sections for long code examples
        // This regex looks for code blocks that are more than 10 lines long
        formatted = formatted.replace(
            /(<pre class="code-block" data-language="[^"]*">[\s\S]*?<\/pre>)/g,
            (match) => {
                // Count the number of lines
                const lineCount = (match.match(/\n/g) || []).length;
                
                // If the code block is long, make it collapsible
                if (lineCount > 10) {
                    const language = match.match(/data-language="([^"]*)"/)[1];
                    return `<div class="collapsible-section">
                        <div class="collapsible-header">${language.charAt(0).toUpperCase() + language.slice(1)} Example</div>
                        <div class="collapsible-content">${match}</div>
                    </div>`;
                }
                
                return match;
            }
        );
        
        return formatted;
    }
    
    /**
     * Apply basic syntax highlighting to Python code
     * @param {string} code - The code to highlight
     * @returns {string} - Highlighted HTML
     */
    applySyntaxHighlighting(code) {
        if (!code) return '';
        
        // Python keywords
        const keywords = [
            'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue', 
            'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 
            'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 
            'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 
            'while', 'with', 'yield'
        ];
        
        // Built-in functions
        const builtins = [
            'abs', 'all', 'any', 'bin', 'bool', 'bytes', 'callable', 'chr', 
            'classmethod', 'compile', 'complex', 'delattr', 'dict', 'dir', 'divmod', 
            'enumerate', 'eval', 'exec', 'filter', 'float', 'format', 'frozenset', 
            'getattr', 'globals', 'hasattr', 'hash', 'help', 'hex', 'id', 'input', 
            'int', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map', 
            'max', 'memoryview', 'min', 'next', 'object', 'oct', 'open', 'ord', 'pow', 
            'print', 'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 
            'slice', 'sorted', 'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 
            'vars', 'zip'
        ];
        
        // Common method and function patterns
        const functionPattern = /(\w+)\s*\(/g;
        
        // Class pattern
        const classPattern = /\b([A-Z]\w*)\b/g;
        
        // Variable assignment pattern
        const variablePattern = /\b(\w+)\s*=/g;
        
        let highlightedCode = code;
        
        // Escape HTML to prevent XSS
        highlightedCode = highlightedCode
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        
        // Highlight strings
        highlightedCode = highlightedCode.replace(
            /(["'])(.*?)\1/g, 
            '<span class="code-string">$&</span>'
        );
        
        // Highlight functions
        highlightedCode = highlightedCode.replace(
            functionPattern,
            (match, funcName) => {
                if (keywords.includes(funcName) || builtins.includes(funcName)) {
                    return match; // Let the keyword/builtin rules handle this
                }
                return match.replace(funcName, `<span class="code-function">${funcName}</span>`);
            }
        );
        
        // Highlight classes (capitalized words)
        highlightedCode = highlightedCode.replace(
            classPattern,
            (match, className) => {
                if (keywords.includes(className) || builtins.includes(className)) {
                    return match; // Let the keyword/builtin rules handle this
                }
                return `<span class="code-class">${className}</span>`;
            }
        );
        
        // Highlight variable assignments
        highlightedCode = highlightedCode.replace(
            variablePattern,
            (match, varName) => {
                if (keywords.includes(varName) || builtins.includes(varName)) {
                    return match; // Let the keyword/builtin rules handle this
                }
                return match.replace(varName, `<span class="code-variable">${varName}</span>`);
            }
        );
        
        // Highlight keywords
        for (const keyword of keywords) {
            const keywordRegex = new RegExp(`\\b(${keyword})\\b`, 'g');
            highlightedCode = highlightedCode.replace(
                keywordRegex, 
                '<span class="code-keyword">$1</span>'
            );
        }
        
        // Highlight built-in functions
        for (const builtin of builtins) {
            const builtinRegex = new RegExp(`\\b(${builtin})\\b`, 'g');
            highlightedCode = highlightedCode.replace(
                builtinRegex, 
                '<span class="code-builtin">$1</span>'
            );
        }
        
        // Highlight numbers
        highlightedCode = highlightedCode.replace(
            /\b(\d+(\.\d+)?)\b/g, 
            '<span class="code-number">$1</span>'
        );
        
        // Highlight comments
        highlightedCode = highlightedCode.replace(
            /(#.*?)($|\n)/g, 
            '<span class="code-comment">$1</span>$2'
        );
        
        return highlightedCode;
    }
    
    /**
     * Format parameter list from docstring
     * @param {string} paramText - Parameter section text
     * @returns {string} - Formatted HTML for parameters
     */
    formatParameterList(paramText) {
        if (!paramText) return '';
        
        // Split by parameter (assuming each is indented or has a name: description format)
        const lines = paramText.trim().split('\n');
        let html = '<div class="parameter-table">';
        html += '<div class="parameter-table-header">';
        html += '<div class="param-name-header">Parameter</div>';
        html += '<div class="param-type-header">Type</div>';
        html += '<div class="param-desc-header">Description</div>';
        html += '</div>';
        
        let rowIndex = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue;
            
            // Check if this is a parameter name line
            // This regex matches patterns like:
            // param_name (type): description
            // param_name: description
            // param_name (type) -- description
            const paramMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:\(([^)]+)\))?\s*(?:--|:)\s*(.*)/);
            
            if (paramMatch) {
                const name = paramMatch[1];
                const type = paramMatch[2] || '';
                let desc = paramMatch[3];
                
                // Look ahead for additional description lines (indented)
                let j = i + 1;
                while (j < lines.length && (lines[j].trim() === '' || lines[j].match(/^\s{2,}/))) {
                    if (lines[j].trim() !== '') {
                        desc += ' ' + lines[j].trim();
                    }
                    j++;
                }
                i = j - 1; // Skip the lines we've processed
                
                const rowClass = rowIndex % 2 === 0 ? 'even-row' : 'odd-row';
                rowIndex++;
                
                html += `
                    <div class="parameter-item ${rowClass}">
                        <div class="param-name">${name}</div>
                        ${type ? `<div class="param-type">${type}</div>` : '<div class="param-type">—</div>'}
                        <div class="param-desc">${desc}</div>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        return html;
    }

    /**
     * Suggest default input/output nodes based on component type from API
     * @param {string} componentType - The component type from the API
     */
    suggestDefaultNodesForType(componentType) {
        // Clear previous suggestions
        this.inputNodes = [];
        this.outputNodes = [];

        // Set nodes based on component type
        switch(componentType) {
            case 'document_loaders':
                this.outputNodes.push('Documents');
                break;

            case 'text_splitters':
                this.inputNodes.push('Documents');
                this.outputNodes.push('Chunks');
                break;

            case 'embeddings':
                this.inputNodes.push('Text');
                this.outputNodes.push('Embeddings');
                break;

            case 'vectorstores':
                this.inputNodes.push('Embeddings');
                this.inputNodes.push('Query');
                this.outputNodes.push('Results');
                break;

            case 'retrievers':
                this.inputNodes.push('Query');
                this.outputNodes.push('Documents');
                break;

            case 'llms':
            case 'chat_models':
                this.inputNodes.push('Prompt');
                this.outputNodes.push('Completion');
                break;

            case 'chains':
                this.inputNodes.push('Input');
                this.outputNodes.push('Output');
                break;

            default:
                // If no specific type matches, fall back to the name-based approach
                this.suggestDefaultNodes();
                return;
        }

        // Update nodes display
        this.updateNodesDisplay();
    }

    /**
     * Suggest default input/output nodes based on class type
     */
    suggestDefaultNodes() {
        // Clear previous suggestions
        this.inputNodes = [];
        this.outputNodes = [];

        // Check if this.selectedClass exists before using it
        if (!this.selectedClass) {
            console.warn('No class selected when attempting to suggest default nodes');
            return;
        }

        const className = this.selectedClass.toLowerCase();

        // Document loaders generally have a document output
        if (className.includes('loader') || className.includes('reader') || className.includes('parser')) {
            this.outputNodes.push('Documents');
        }

        // Text splitters have document inputs and chunk outputs
        if (className.includes('splitter')) {
            this.inputNodes.push('Documents');
            this.outputNodes.push('Chunks');
        }

        // Embedding models have text input and vector output
        if (className.includes('embedding')) {
            this.inputNodes.push('Text');
            this.outputNodes.push('Embeddings');
        }

        // Vector stores have vector inputs and search outputs
        if (className.includes('vectorstore') || className.includes('vector_store')) {
            this.inputNodes.push('Embeddings');
            this.inputNodes.push('Query');
            this.outputNodes.push('Results');
        }

        // LLMs have prompt inputs and completion outputs
        if (className.includes('llm') || className.includes('model') || className.includes('chat')) {
            this.inputNodes.push('Prompt');
            this.outputNodes.push('Completion');
        }

        // Chains have various inputs and outputs depending on type
        if (className.includes('chain')) {
            this.inputNodes.push('Input');
            this.outputNodes.push('Output');
        }

        // Update nodes display
        this.updateNodesDisplay();
    }

    /**
     * Update the methods container with available methods
     */
    updateMethodsContainer() {
        if (!this.classDetails) {
            this.methodsContainer.innerHTML = '<p>No methods available</p>';
            return;
        }

        // Check for methods in the response
        const methods = this.classDetails.methods || [];
        const methodDetails = this.classDetails.method_details || [];

        if (!methods || methods.length === 0) {
            this.methodsContainer.innerHTML = '<p>No methods available</p>';
            return;
        }

        // Generate HTML for methods
        let html = '<div class="methods-list">';

        // Initialize selected methods if needed
        if (!this.selectedMethods || !Array.isArray(this.selectedMethods)) {
            this.selectedMethods = ['__init__']; // Always include constructor
        }

        // Make sure __init__ is in the selected methods
        if (!this.selectedMethods.includes('__init__')) {
            this.selectedMethods.push('__init__');
        }

        // Add constructor (init_params) if available
        if (this.classDetails.init_params && this.classDetails.init_params.length > 0) {
            html += `
                <div class="method-item">
                    <input type="checkbox" id="method-__init__" value="__init__" checked disabled>
                    <label for="method-__init__">
                        <strong>__init__</strong> - Constructor
                    </label>
                    <div class="method-details">
                        <p>${this.classDetails.doc || 'No documentation available for constructor.'}</p>
                    </div>
                </div>
            `;

            // Store constructor parameters
            const constructorParams = this.classDetails.init_params.map(param => param.name);
            this.parameters['__init__'] = constructorParams;
        }

        // Create a map of method details by name for easier lookup
        const methodDetailsByName = {};
        methodDetails.forEach(methodDetail => {
            methodDetailsByName[methodDetail.name] = methodDetail;
        });

        // Add methods (exclude __init__ since we handled it specially)
        methods.forEach(methodName => {
            if (methodName === '__init__') return;

            // Get method details if available
            const methodDetail = methodDetailsByName[methodName] || null;
            const methodDoc = methodDetail ? methodDetail.doc : 'No documentation available';

            // Check if this method was previously selected
            const isChecked = this.selectedMethods.includes(methodName);

            html += `
                <div class="method-item">
                    <input type="checkbox" id="method-${methodName}" value="${methodName}" ${isChecked ? 'checked' : ''}>
                    <label for="method-${methodName}">
                        <strong>${methodName}</strong>
                    </label>
                    <div class="method-details">
                        <p>${methodDoc}</p>
                    </div>
                </div>
            `;

            // Store method parameters if available
            if (methodDetail && methodDetail.parameters) {
                const paramNames = methodDetail.parameters.map(param => param.name);
                this.parameters[methodName] = paramNames;
            }
        });

        html += '</div>';
        this.methodsContainer.innerHTML = html;

        // Add event listeners for method selection
        const methodCheckboxes = this.methodsContainer.querySelectorAll('input[type="checkbox"]');
        methodCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const methodName = e.target.value;
                if (e.target.checked) {
                    // Method was selected
                    if (!this.selectedMethods.includes(methodName)) {
                        this.selectedMethods.push(methodName);
                    }
                } else {
                    // Method was deselected
                    if (methodName !== '__init__') { // Don't allow deselecting constructor
                        this.selectedMethods = this.selectedMethods.filter(m => m !== methodName);
                    }
                }

                // Update the parameters container
                this.updateParametersContainer();

                // Log the selected methods for debugging
                console.log('Selected methods updated:', this.selectedMethods);

                // Immediately save this selection to ensure it's not lost
                if (this.editingBlockId && this.selectedClass) {
                    saveMethods(this.selectedClass, this.selectedMethods, this.editingBlockId);
                    console.log('Saved methods during editing:', this.selectedMethods);
                }
            });
        });

        // Update parameters after setting up methods
        this.updateParametersContainer();

        // Log all available methods for debugging
        console.log('Available methods:', methods);
        console.log('Currently selected methods:', this.selectedMethods);
    }

    /**
     * Update the parameters container based on selected methods
     */
    updateParametersContainer() {
        if (!this.classDetails || !this.selectedMethods || this.selectedMethods.length === 0) {
            this.parametersContainer.innerHTML = '<p>No parameters to configure</p>';
            return;
        }

        let html = '<div class="parameters-list">';

        // Get constructor parameters first
        if (this.selectedMethods.includes('__init__') && this.classDetails.init_params) {
            html += '<h4>Constructor Parameters</h4>';

            const constructorParams = this.classDetails.init_params;
            if (constructorParams.length === 0) {
                html += '<p>No constructor parameters</p>';
            } else {
                html += this.renderParameterInputs('__init__', constructorParams);
            }
        }

        // Create a map of method details by name for easier lookup
        const methodDetailsByName = {};
        if (this.classDetails.method_details) {
            this.classDetails.method_details.forEach(methodDetail => {
                methodDetailsByName[methodDetail.name] = methodDetail;
            });
        }

        // Add parameters for other selected methods
        this.selectedMethods.forEach(methodName => {
            if (methodName === '__init__') return; // Skip constructor, already handled

            // Get method details
            const methodDetail = methodDetailsByName[methodName];

            if (!methodDetail) {
                console.warn(`No details found for method: ${methodName}`);
                return;
            }

            html += `<h4>${methodName} Parameters</h4>`;

            if (!methodDetail.parameters || methodDetail.parameters.length === 0) {
                html += '<p>No parameters for this method</p>';
            } else {
                html += this.renderParameterInputs(methodName, methodDetail.parameters);
            }
        });

        html += '</div>';
        this.parametersContainer.innerHTML = html;

        // Add event listeners for parameter inputs
        const paramInputs = this.parametersContainer.querySelectorAll('.param-input');
        paramInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const methodName = e.target.dataset.method;
                const paramName = e.target.dataset.param;
                const value = e.target.value;

                // Initialize parameter values for this method if not exists
                if (!this.parameters[methodName]) {
                    this.parameters[methodName] = {};
                }

                // Store parameter value
                this.parameters[methodName][paramName] = value;
            });
        });
    }

    /**
     * Render parameter input fields
     * @param {string} methodName - The method name
     * @param {Array} parameters - The parameters to render inputs for
     * @returns {string} - HTML for parameter inputs
     */
    renderParameterInputs(methodName, parameters) {
        let html = '<div class="param-group">';

        parameters.forEach(param => {
            // Skip 'self' parameter
            if (param.name === 'self') return;

            // Get stored value if any
            const storedValue = this.parameters[methodName] &&
                                this.parameters[methodName][param.name] ?
                                this.parameters[methodName][param.name] : '';

            // Determine if parameter is required
            const isRequired = param.required;
            const requiredMark = isRequired ? '<span class="required">*</span>' : '';

            // Create input field with parameter details
            html += `
                <div class="param-row">
                    <label for="${methodName}-${param.name}">
                        ${param.name}${requiredMark}:
                        <span class="param-type">${param.type || 'Any'}</span>
                    </label>
                    <input type="text"
                        id="${methodName}-${param.name}"
                        class="param-input"
                        data-method="${methodName}"
                        data-param="${param.name}"
                        value="${storedValue}"
                        placeholder="${param.default || ''}">
                    ${param.description ? `<div class="param-description">${param.description}</div>` : ''}
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    /**
     * Add a new input node
     */
    addInputNode() {
        const inputNodeName = prompt('Enter input node name:');
        if (!inputNodeName) return;

        // Add to inputNodes array
        this.inputNodes.push(inputNodeName);

        // Update nodes display
        this.updateNodesDisplay();
    }

    /**
     * Add a new output node
     */
    addOutputNode() {
        const outputNodeName = prompt('Enter output node name:');
        if (!outputNodeName) return;

        // Add to outputNodes array
        this.outputNodes.push(outputNodeName);

        // Update nodes display
        this.updateNodesDisplay();
    }

    /**
     * Update the nodes display
     */
    updateNodesDisplay() {
        const inputNodesList = document.getElementById('input-nodes-list');
        const outputNodesList = document.getElementById('output-nodes-list');

        // Update input nodes list
        let inputNodesHtml = '';
        this.inputNodes.forEach((nodeName, index) => {
            inputNodesHtml += `
                <div class="node-item">
                    <span>${nodeName}</span>
                    <button class="remove-node-btn" data-type="input" data-index="${index}">×</button>
                </div>
            `;
        });
        inputNodesList.innerHTML = inputNodesHtml || '<p>No input nodes added</p>';

        // Update output nodes list
        let outputNodesHtml = '';
        this.outputNodes.forEach((nodeName, index) => {
            outputNodesHtml += `
                <div class="node-item">
                    <span>${nodeName}</span>
                    <button class="remove-node-btn" data-type="output" data-index="${index}">×</button>
                </div>
            `;
        });
        outputNodesList.innerHTML = outputNodesHtml || '<p>No output nodes added</p>';

        // Add event listeners for remove buttons
        const removeButtons = document.querySelectorAll('.remove-node-btn');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                const index = parseInt(e.target.dataset.index);

                if (type === 'input') {
                    this.inputNodes.splice(index, 1);
                } else if (type === 'output') {
                    this.outputNodes.splice(index, 1);
                }

                this.updateNodesDisplay();
            });
        });
    }

    /**
     * Validate all steps before creating a block
     */
    validateForCreation() {
        if (!this.selectedClass) {
            showToast('Please select a class', 'error');
            return false;
        }

        if (this.inputNodes.length === 0 && this.outputNodes.length === 0) {
            showToast('Please add at least one input or output node', 'error');
            return false;
        }

        return true;
    }

    /**
     * Create a custom block with the selected configuration
     */
    async createBlock() {
        try {
            // Validate that we have required fields
            if (!this.validateForCreation()) {
                return;
            }

            // Make sure we have up-to-date selected methods
            if (!this.selectedMethods || this.selectedMethods.length === 0) {
                // If no methods selected, default to just the constructor
                this.selectedMethods = ['__init__'];
                console.warn('No methods selected, defaulting to constructor only');
            } else if (!this.selectedMethods.includes('__init__')) {
                // Make sure constructor is always included
                this.selectedMethods.unshift('__init__');
                console.log('Added constructor to selected methods');
            }

            // Log the methods we're about to save
            console.log('Creating block with these methods:', this.selectedMethods);

            // Generate a unique ID for the block
            const blockId = `custom-block-${Date.now()}`;

            // First save methods to ensure they're available
            console.log(`Saving methods for new block ${blockId}:`, this.selectedMethods);
            saveMethods(this.selectedClass, this.selectedMethods, blockId);

            // Create the block on the canvas
            createCustomBlock(
                this.selectedClass,
                this.inputNodes,
                this.outputNodes,
                blockId
            );

            // Add the block to the menu
            addCustomBlockToMenu(this.selectedClass, blockId, this.inputNodes, this.outputNodes);

            // Save module info for this class
            saveModuleInfo(this.selectedClass, this.librarySelect.value, this.moduleSelect.value);

            // Close the modal
            this.closeModal();

            // Reset the form for next use
            this.resetForm();

            // Show success message
            showToast('Custom block created successfully!', 'success');
        } catch (error) {
            console.error('Error creating block:', error);
            showToast(`Error creating block: ${error.message}`, 'error');
        }
    }

    /**
     * Edit an existing custom block
     * @param {string} blockId - The ID of the block to edit
     * @param {string} className - The class name of the block
     * @param {Array} inputNodes - The input nodes of the block
     * @param {Array} outputNodes - The output nodes of the block
     */
    editBlock(blockId, className, inputNodes, outputNodes) {
        // Store edit info
        this.editingBlockId = blockId;
        this.selectedClass = className;

        // Format nodes to ensure they have the right structure
        this.inputNodes = inputNodes.map(node => {
            return typeof node === 'string' ? node : node.name;
        });

        this.outputNodes = outputNodes.map(node => {
            return typeof node === 'string' ? node : node.name;
        });

        // Try to load selected methods from storage
        const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
        const blockData = customBlocks.find(b => b.id === blockId);
        if (blockData && blockData.methods) {
            this.selectedMethods = blockData.methods;
        } else {
            // Default to constructor method if no methods found
            this.selectedMethods = ['__init__'];
        }

        // Find the block's library and module
        const blockData2 = this.findBlockData(className);
        if (blockData2) {
            this.selectedLibrary = blockData2.library;
            this.selectedModule = blockData2.module;
        }

        // Show modal
        this.showModal();

        // Update all UI components
        this.loadLibraries().then(() => {
            // Load available modules
            if (this.selectedLibrary) {
                this.librarySelect.value = this.selectedLibrary;
                this.onLibraryChange().then(() => {
                    // Load available classes
                    if (this.selectedModule) {
                        this.moduleSelect.value = this.selectedModule;
                        this.onModuleChange().then(() => {
                            // Select class
                            if (this.selectedClass) {
                                this.classSelect.value = this.selectedClass;
                                this.onClassChange();
                            }
                        });
                    }
                });
            }

            // Update nodes display
            this.updateNodesDisplay();

            // Change modal title and button text
            const modalTitle = this.modal.querySelector('h2');
            if (modalTitle) {
                modalTitle.textContent = 'Edit Custom Block';
            }

            const createBtn = document.getElementById('create-block-btn');
            if (createBtn) {
                createBtn.textContent = 'Update Block';
            }
        });
    }

    /**
     * Find block data (library and module) from class name
     * This is a helper method to find which library and module a class belongs to
     */
    findBlockData(className) {
        // Default popular modules to check first
        const popularModules = [
            'langchain.document_loaders',
            'langchain.text_splitter',
            'langchain.embeddings',
            'langchain.vectorstores',
            'langchain.chains',
            'langchain_community.document_loaders',
            'langchain_community.embeddings',
            'langchain_community.vectorstores'
        ];

        // Try to find in localStorage if we've used this class before
        const customBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
        const existingBlock = customBlocks.find(block => block.className === className);

        if (existingBlock && existingBlock.moduleInfo) {
            return {
                library: existingBlock.moduleInfo.library,
                module: existingBlock.moduleInfo.module
            };
        }

        // If not found, return default values
        return {
            library: 'langchain_community',
            module: 'langchain_community.document_loaders'
        };
    }

    /**
     * Reset the form and clear selections
     */
    resetForm() {
        // Clear selections
        this.selectedMethods = [];
        this.inputNodes = [];
        this.outputNodes = [];
        this.parameters = {};
        this.editingBlockId = null;

        // Reset UI
        const methodCheckboxes = this.methodsContainer.querySelectorAll('input[type="checkbox"]');
        methodCheckboxes.forEach(checkbox => {
            if (checkbox.value !== '__init__') { // Skip __init__ as it's always selected
                checkbox.checked = false;
            }
        });

        // Reset nodes display
        this.updateNodesDisplay();

        // Reset parameters display
        this.updateParametersContainer();

        // Reset tab to first tab
        this.switchTab('select-class');
    }
}

// Helper function for toast messages
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // Add to document
    document.body.appendChild(toast);

    // Trigger animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Auto remove after delay
    setTimeout(() => {
        toast.classList.remove('show');

        // Remove element after fade out
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

// Function to add the custom block to the blocks menu
function addCustomBlockToMenu(className, blockId, inputNodes, outputNodes) {
    // Find the blocks content container
    const blocksContent = document.getElementById('blocks-content');
    if (!blocksContent) return;

    // Find the custom blocks container
    const customBlocksContainer = blocksContent.querySelector('#custom-blocks-container');
    if (!customBlocksContainer) return;

    // Show the section header if not already visible
    const sectionHeader = blocksContent.querySelector('#custom-blocks-section-header');
    if (sectionHeader) {
        sectionHeader.style.display = '';
    }

    // Check if this block already exists in the menu
    if (customBlocksContainer.querySelector(`[data-block-id="${blockId}"]`)) {
        console.log(`Block ${blockId} already exists in menu, skipping`);
        return;
    }

    // Create a block template
    const blockTemplate = document.createElement('div');
    blockTemplate.className = 'block-template custom-block-template';
    blockTemplate.setAttribute('draggable', 'true');
    blockTemplate.setAttribute('data-block-type', 'custom');
    blockTemplate.setAttribute('data-block-id', blockId);
    blockTemplate.setAttribute('data-class-name', className);

    let blockName = className;

    // Create simplified block structure for the menu
    blockTemplate.innerHTML = `
        <div class="block-header">
            <div class="block-drag-handle" contenteditable="false">${blockName}</div>
        </div>
    `;

    // Add drag start event listener
    blockTemplate.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', 'custom');
        e.dataTransfer.setData('blockId', blockId);
        e.dataTransfer.setData('className', className);
        e.dataTransfer.setData('inputNodes', JSON.stringify(inputNodes));
        e.dataTransfer.setData('outputNodes', JSON.stringify(outputNodes));
    });

    // Add event listener for the block-drag-handle to make it editable
    const dragHandle = blockTemplate.querySelector('.block-drag-handle');
    if (dragHandle) {
        // Store the original class name as a data attribute
        dragHandle.setAttribute('data-original-name', className);
        
        // Add click event to make it editable
        dragHandle.addEventListener('click', (e) => {
            // Only make editable on direct click (not during drag)
            if (e.target === dragHandle) {
                dragHandle.focus();
                // Select all text
                const range = document.createRange();
                range.selectNodeContents(dragHandle);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
        
        // Save the new name when focus is lost
        dragHandle.addEventListener('blur', () => {
            const newName = dragHandle.textContent.trim();
            if (newName && newName !== className) {
                // Update the block's class name attribute
                blockTemplate.setAttribute('data-class-name', newName);
                
                // Update the className variable for future reference
                className = newName;
                
                // Update the block in sessionStorage
                updateBlockNameInStorage(blockId, newName);
                
                console.log(`Block name changed from "${className}" to "${newName}"`);
            }
        });
        
        // Prevent drag when editing
        dragHandle.addEventListener('mousedown', (e) => {
            // If the user is editing (has focus), don't start dragging
            if (document.activeElement === dragHandle) {
                e.stopPropagation();
            }
        });
    }

    // Add to custom blocks container
    customBlocksContainer.appendChild(blockTemplate);

    // Save to sessionStorage for persistence
    saveCustomBlockToStorage(className, blockId, inputNodes, outputNodes);

    // Show success message
    showToast('Custom block added to menu', 'success');
}

// Function to save custom block to localStorage
function saveCustomBlockToStorage(className, blockId, inputNodes, outputNodes) {
    // Get existing blocks or initialize empty array
    const existingBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');

    // Get selected methods from the handler if it exists
    const handler = window.customBlockHandler;
    let selectedMethods = ['__init__']; // Default to constructor only

    if (handler && handler.selectedMethods && handler.selectedMethods.length > 0) {
        // Make sure we have all the methods the user selected
        selectedMethods = [...handler.selectedMethods];
        // Ensure __init__ is always included
        if (!selectedMethods.includes('__init__')) {
            selectedMethods.unshift('__init__');
        }
        console.log(`Using ${selectedMethods.length} methods from handler for ${blockId}:`, selectedMethods);
    } else {
        // Try to find existing methods for this class
        const existingBlock = existingBlocks.find(b => b.className === className);
        if (existingBlock && existingBlock.methods && existingBlock.methods.length > 0) {
            selectedMethods = [...existingBlock.methods];
            console.log(`Using ${selectedMethods.length} existing methods for ${blockId}:`, selectedMethods);
        }
    }

    // Check if block already exists
    const existingBlockIndex = existingBlocks.findIndex(block => block.id === blockId);

    if (existingBlockIndex >= 0) {
        // Update existing block
        existingBlocks[existingBlockIndex] = {
            ...existingBlocks[existingBlockIndex],
            className: className,
            inputNodes: inputNodes,
            outputNodes: outputNodes,
            methods: selectedMethods
        };
        console.log(`Updated existing block ${blockId} with ${selectedMethods.length} methods:`, selectedMethods);
    } else {
        // Add new block
        existingBlocks.push({
            id: blockId,
            className: className,
            inputNodes: inputNodes,
            outputNodes: outputNodes,
            methods: selectedMethods
        });
        console.log(`Added new block ${blockId} with ${selectedMethods.length} methods:`, selectedMethods);
    }

    // Save back to sessionStorage
    sessionStorage.setItem('customBlocks', JSON.stringify(existingBlocks));
}

// Function to load custom blocks from localStorage
function loadCustomBlocks() {
    const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
    customBlocks.forEach(block => {
        addCustomBlockToMenu(block.className, block.id, block.inputNodes, block.outputNodes);
    });
}

// Initialize the custom block handler
let customBlockHandler = null;

// Initialize custom blocks when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Load saved custom blocks
    loadCustomBlocks();
    updateCustomBlocksSectionHeaderVisibility();

    // Add event listener to clear sessionStorage on page unload
    window.addEventListener('beforeunload', () => {
        // Clear all custom block data on page refresh or close
        sessionStorage.removeItem('customBlocks');
        sessionStorage.removeItem('moduleInfo');
    });
});

// Function to update a block's nodes (for editing)
function updateBlockNodes(blockElement, className, inputNodes, outputNodes) {
    // Update block header with class name
    const dragHandle = blockElement.querySelector('.block-drag-handle');
    if (dragHandle) {
        // Only update the text content if it's not being edited
        if (document.activeElement !== dragHandle) {
            dragHandle.textContent = className;
        }
        
        // Update the data-original-name attribute
        dragHandle.setAttribute('data-original-name', className);
    }

    // Update input nodes
    const inputNodeContainer = blockElement.querySelector('.input-node-group');
    if (inputNodeContainer) {
        // Clear existing nodes
        inputNodeContainer.innerHTML = '';

        // Add new input nodes
        if (inputNodes && inputNodes.length > 0) {
            inputNodes.forEach(node => {
                const nodeName = typeof node === 'string' ? node : node.name;
                const nodeElement = document.createElement('div');
                nodeElement.className = 'input-node';
                nodeElement.setAttribute('data-input', nodeName);

                const nodeLabel = document.createElement('div');
                nodeLabel.className = 'node-label';
                nodeLabel.textContent = nodeName;

                nodeElement.appendChild(nodeLabel);
                inputNodeContainer.appendChild(nodeElement);
            });
        }
    }

    // Update output nodes
    const outputNodeContainer = blockElement.querySelector('.output-node-group');
    if (outputNodeContainer) {
        // Clear existing nodes
        outputNodeContainer.innerHTML = '';

        // Add new output nodes
        if (outputNodes && outputNodes.length > 0) {
            outputNodes.forEach(node => {
                const nodeName = typeof node === 'string' ? node : node.name;
                const nodeElement = document.createElement('div');
                nodeElement.className = 'output-node';
                nodeElement.setAttribute('data-output', nodeName);

                const nodeLabel = document.createElement('div');
                nodeLabel.className = 'node-label';
                nodeLabel.textContent = nodeName;

                nodeElement.appendChild(nodeLabel);
                outputNodeContainer.appendChild(nodeElement);
            });
        }
    }

    // Update data attribute for class name
    blockElement.setAttribute('data-class-name', className);
}

// Function to save module info for future edits
function saveModuleInfo(className, library, module) {
    // Get existing blocks from sessionStorage
    const existingBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');

    // Find the block with matching class name
    const blockIndex = existingBlocks.findIndex(block => block.className === className);

    if (blockIndex >= 0) {
        // Update existing block's module info
        existingBlocks[blockIndex].moduleInfo = {
            library: library,
            module: module
        };
    } else {
        // Create a new entry if block not found
        existingBlocks.push({
            className: className,
            moduleInfo: {
                library: library,
                module: module
            }
        });
    }

    // Save back to sessionStorage
    sessionStorage.setItem('customBlocks', JSON.stringify(existingBlocks));
}

// Function to create a custom block on the canvas
function createCustomBlock(className, inputNodes, outputNodes, blockId, originalBlockId = null) {
    // Create a new block element
    const block = document.createElement('div');
    block.className = 'block custom-block';
    block.setAttribute('data-block-type', 'custom');
    block.setAttribute('data-class-name', className);
    block.id = blockId;

    // Store reference to original block if provided
    if (originalBlockId) {
        block.setAttribute('data-original-block-id', originalBlockId);
    }

    // Create the block content structure that matches regular blocks
    block.innerHTML = `
        <div class="block-content-wrapper">
            <div class="block-header">
                <div class="block-drag-handle" contenteditable="true">${className}</div>
            </div>
            <div class="node-container">
                ${inputNodes && inputNodes.length > 0 ?
                    `<div class="input-node-group">
                        ${inputNodes.map(node =>
                            `<div class="input-node" data-input="${typeof node === 'string' ? node : node.name}">
                                <div class="tooltip-container">    
                                    <div class="node-label">${typeof node === 'string' ? node : node.name}</div>
                                </div>
                            </div>`
                        ).join('')}
                    </div>`
                    : ''
                }
                ${outputNodes && outputNodes.length > 0 ?
                    `<div class="output-node-group">
                        ${outputNodes.map(node =>
                            `<div class="output-node" data-output="${typeof node === 'string' ? node : node.name}">
                                <div class="tooltip-container">    
                                    <div class="node-label">${typeof node === 'string' ? node : node.name}</div>
                                </div>
                            </div>`
                        ).join('')}
                    </div>`
                    : ''
                }
            </div>
            <div class="block-content">
                <div class="method-selectors">
                    <select class="method-select" title="Select method to execute">
                        <option value="">Select method...</option>
                    </select>
                    <button class="add-param-btn" title="Add parameter">+</button>
                </div>
                <div class="block-parameters">
                    <!-- Parameters will be added here dynamically -->
                </div>
            </div>
        </div>
    `;

    // Add delete button
    const deleteButton = document.createElement('div');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = '×';
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof deleteBlock === 'function') {
            deleteBlock(block);
        } else {
            // Fallback if deleteBlock isn't available
            block.remove();
        }
    });
    block.appendChild(deleteButton);

    // Add event listener for the edit parameters button
    // const editParamsButton = block.querySelector('.edit-parameters-btn');
    // if (editParamsButton) {
    //     editParamsButton.addEventListener('click', () => {
    //         // Create custom block handler if not already created
    //         if (!customBlockHandler) {
    //             customBlockHandler = new CustomBlockHandler();
    //         }

    //         // Load the block data for editing
    //         customBlockHandler.editBlock(blockId, className, inputNodes, outputNodes);
    //     });
    // }

    // Add event listener for the block-drag-handle to make it editable
    const dragHandle = block.querySelector('.block-drag-handle');
    if (dragHandle) {
        // Store the original class name as a data attribute
        dragHandle.setAttribute('data-original-name', className);
        
        // Add click event to make it editable
        dragHandle.addEventListener('click', (e) => {
            // Only make editable on direct click (not during drag)
            if (e.target === dragHandle) {
                dragHandle.focus();
                // Select all text
                const range = document.createRange();
                range.selectNodeContents(dragHandle);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
            }
        });
        
        // Save the new name when focus is lost
        dragHandle.addEventListener('blur', () => {
            const newName = dragHandle.textContent.trim();
            if (newName && newName !== className) {
                // Update the block's class name attribute
                block.setAttribute('data-class-name', newName);
                console.log(`Block name changed from "${className}" to "${newName}"`);
            }
        });
        
        // Prevent drag when editing
        dragHandle.addEventListener('mousedown', (e) => {
            // If the user is editing (has focus), don't start dragging
            if (document.activeElement === dragHandle) {
                e.stopPropagation();
            }
        });
    }

    // Populate methods dropdown - pass the original block ID if available for method lookup
    populateMethodsForBlock(block, className, originalBlockId || blockId);

    // Handle method selection change
    const methodSelect = block.querySelector('.method-select');
    if (methodSelect) {
        methodSelect.addEventListener('change', () => {
            const selectedMethod = methodSelect.value;
            console.log(`Method selected: ${selectedMethod}`);

            // Update block parameters based on selected method
            updateBlockParameters(block, selectedMethod);
        });

        // Handle add parameter button
        const addParamBtn = block.querySelector('.add-param-btn');
        if (addParamBtn) {
            addParamBtn.addEventListener('click', () => {
                addCustomParameter(block);
            });
        }
    }

    return block;
}

// Function to populate methods for a block
function populateMethodsForBlock(block, className, blockId) {
    const methodSelect = block.querySelector('.method-select');
    if (!methodSelect) return;

    console.log(`Populating methods for ${className} (block ID: ${blockId})`);

    // Clear existing options except the first one (Select method...)
    while (methodSelect.options.length > 1) {
        methodSelect.remove(1);
    }

    // Try to find methods from sessionStorage for this specific block
    let customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');

    // First look for the specific block by ID
    let blockData = blockId ? customBlocks.find(b => b.id === blockId) : null;

    // If not found and this is a canvas instance, try to find the original block
    if (!blockData && block.hasAttribute('data-original-block-id')) {
        const originalId = block.getAttribute('data-original-block-id');
        blockData = customBlocks.find(b => b.id === originalId);
    }

    // If still not found, try to find by className
    if (!blockData) {
        blockData = customBlocks.find(b => b.className === className);
    }

    // As a fallback, also check localStorage (for backward compatibility)
    if (!blockData) {
        try {
            const localBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            blockData = localBlocks.find(b => b.className === className);
        } catch (e) {
            console.warn('Error reading from localStorage:', e);
        }
    }

    if (blockData && blockData.methods && blockData.methods.length > 0) {
        console.log(`Found ${blockData.methods.length} methods for ${blockId || className}: ${blockData.methods.join(', ')}`);

        // Add all methods to select
        blockData.methods.forEach(method => {
            const option = document.createElement('option');
            option.value = method;
            option.textContent = method;
            methodSelect.appendChild(option);
        });

        // Set the first method as selected (often __init__)
        if (methodSelect.options.length > 1) {
            methodSelect.selectedIndex = 1;
            // Trigger change event to update parameters
            const changeEvent = new Event('change');
            methodSelect.dispatchEvent(changeEvent);
        }
    } else {
        // If no methods found, fetch them from the server or use defaults
        console.log(`No methods found for ${blockId || className}, fetching from server...`);

        // Find module info from sessionStorage
        const moduleInfo = findModuleInfoForClass(className);

        if (moduleInfo) {
            console.log(`Found module info for ${className}: ${moduleInfo.library}/${moduleInfo.module}`);

            // Fetch methods from the server
            fetch(`/api/langchain/class_details?library=${moduleInfo.library}&module=${moduleInfo.module}&class_name=${className}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch methods: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(data => {
                    console.log(`Fetched methods for ${blockId || className}:`, data);

                    // Add constructor
                    const constructorOption = document.createElement('option');
                    constructorOption.value = '__init__';
                    constructorOption.textContent = 'Constructor (__init__)';
                    methodSelect.appendChild(constructorOption);

                    // Add other methods
                    if (data.methods && data.methods.length > 0) {
                        data.methods.forEach(method => {
                            if (method === '__init__') return; // Skip constructor, already added

                            const option = document.createElement('option');
                            option.value = method;
                            option.textContent = method;
                            methodSelect.appendChild(option);
                        });

                        // Save methods to sessionStorage for this specific block
                        const methodsToSave = ['__init__', ...data.methods];
                        saveMethods(className, methodsToSave, blockId);
                        console.log(`Saved ${methodsToSave.length} methods from API for ${blockId || className}`);

                        // Set constructor as selected by default
                        if (methodSelect.options.length > 1) {
                            methodSelect.selectedIndex = 1;
                            // Trigger change event to update parameters
                            const changeEvent = new Event('change');
                            methodSelect.dispatchEvent(changeEvent);
                        }
                    }
                })
                .catch(error => {
                    console.error(`Error fetching methods for ${blockId || className}:`, error);

                    // Add default methods as fallback
                    addDefaultMethods(methodSelect);

                    // Set first method as selected
                    if (methodSelect.options.length > 1) {
                        methodSelect.selectedIndex = 1;
                        // Trigger change event
                        const changeEvent = new Event('change');
                        methodSelect.dispatchEvent(changeEvent);
                    }
                });
        } else {
            console.warn(`No module info found for ${blockId || className}, using default methods`);

            // Add default methods
            addDefaultMethods(methodSelect);

            // Set first method as selected
            if (methodSelect.options.length > 1) {
                methodSelect.selectedIndex = 1;
                // Trigger change event
                const changeEvent = new Event('change');
                methodSelect.dispatchEvent(changeEvent);
            }
        }
    }

    // Event listener for method selection is already added in createCustomBlock
}

// Helper function to add default methods
function addDefaultMethods(methodSelect) {
    const defaultMethods = ['call', 'run', 'invoke', 'execute'];
    defaultMethods.forEach(method => {
        const option = document.createElement('option');
        option.value = method;
        option.textContent = method;
        methodSelect.appendChild(option);
    });
}

// Helper function to find module info for a class from sessionStorage
function findModuleInfoForClass(className) {
    try {
        const moduleInfo = JSON.parse(sessionStorage.getItem('moduleInfo') || '{}');
        return moduleInfo[className];
    } catch (error) {
        console.error(`Error finding module info for ${className}:`, error);
        return null;
    }
}

// Helper function to save methods to sessionStorage
function saveMethods(className, methods, blockId = null) {
    try {
        const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');

        if (blockId) {
            // If blockId is provided, update that specific block
            const existingBlockIndex = customBlocks.findIndex(b => b.id === blockId);
            if (existingBlockIndex >= 0) {
                customBlocks[existingBlockIndex].methods = methods;
            }
        } else {
            // If no blockId, update by className (legacy behavior)
            const existingBlockIndex = customBlocks.findIndex(b => b.className === className);
            if (existingBlockIndex >= 0) {
                customBlocks[existingBlockIndex].methods = methods;
            } else {
                customBlocks.push({
                    className,
                    methods
                });
            }
        }

        sessionStorage.setItem('customBlocks', JSON.stringify(customBlocks));
        console.log(`Saved methods for ${blockId || className}:`, methods);
    } catch (error) {
        console.error(`Error saving methods for ${blockId || className}:`, error);
    }
}

// Function to update block parameters based on selected method
function updateBlockParameters(block, methodName) {
    if (!methodName) return;

    const paramsContainer = block.querySelector('.block-parameters');
    if (!paramsContainer) return;

    // Clear existing parameters
    paramsContainer.innerHTML = '';

    // Add a default parameter input
    const paramRow = document.createElement('div');
    paramRow.className = 'parameter-row';
    paramRow.innerHTML = `
        <input type="text" class="param-name" placeholder="Parameter name">
        <input type="text" class="param-value" placeholder="Value">
        <button class="remove-param-btn">×</button>
    `;

    // Add event listener for remove button
    const removeBtn = paramRow.querySelector('.remove-param-btn');
    removeBtn.addEventListener('click', () => {
        paramRow.remove();
    });

    paramsContainer.appendChild(paramRow);
}

// Function to add a custom parameter to a block
function addCustomParameter(block) {
    const paramsContainer = block.querySelector('.block-parameters');
    if (!paramsContainer) return;

    // Create a new parameter row
    const paramRow = document.createElement('div');
    paramRow.className = 'parameter-row';
    paramRow.innerHTML = `
        <input type="text" class="param-name" placeholder="Parameter name">
        <input type="text" class="param-value" placeholder="Value">
        <button class="remove-param-btn">×</button>
    `;

    // Add event listener for remove button
    const removeBtn = paramRow.querySelector('.remove-param-btn');
    removeBtn.addEventListener('click', () => {
        paramRow.remove();
    });

    paramsContainer.appendChild(paramRow);
}

// Function to update a block's name in sessionStorage
function updateBlockNameInStorage(blockId, newName) {
    try {
        // Get existing blocks from sessionStorage
        const existingBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
        
        // Find the block with matching ID
        const blockIndex = existingBlocks.findIndex(block => block.id === blockId);
        
        if (blockIndex >= 0) {
            // Update the block's class name
            existingBlocks[blockIndex].className = newName;
            
            // Save back to sessionStorage
            sessionStorage.setItem('customBlocks', JSON.stringify(existingBlocks));
            console.log(`Updated block name in storage for ${blockId} to "${newName}"`);
        } else {
            console.warn(`Block with ID ${blockId} not found in storage`);
        }
    } catch (error) {
        console.error('Error updating block name in storage:', error);
    }
}

// After removing a block, hide the section header if no custom blocks remain
function removeCustomBlockFromMenu(blockId) {
    const blocksContent = document.getElementById('blocks-content');
    if (!blocksContent) return;
    const customBlocksContainer = blocksContent.querySelector('#custom-blocks-container');
    if (!customBlocksContainer) return;
    const block = customBlocksContainer.querySelector(`[data-block-id="${blockId}"]`);
    if (block) {
        customBlocksContainer.removeChild(block);
    }
    if (customBlocksContainer.children.length === 0) {
        const sectionHeader = blocksContent.querySelector('#custom-blocks-section-header');
        if (sectionHeader) {
            sectionHeader.style.display = 'none';
        }
    }
}

// On page load, hide the section header if there are no custom blocks
function updateCustomBlocksSectionHeaderVisibility() {
    const blocksContent = document.getElementById('blocks-content');
    if (!blocksContent) return;
    const customBlocksContainer = blocksContent.querySelector('#custom-blocks-container');
    const sectionHeader = blocksContent.querySelector('#custom-blocks-section-header');
    if (sectionHeader) {
        if (customBlocksContainer && customBlocksContainer.children.length > 0) {
            sectionHeader.style.display = '';
        } else {
            sectionHeader.style.display = 'none';
        }
    }
}