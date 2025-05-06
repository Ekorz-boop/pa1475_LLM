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

        // Add event delegation for RST dropdown toggles
        this.modal.addEventListener('click', (e) => {
            const btn = e.target.closest('.rst-dropdown-toggle');
            if (btn) {
                const targetId = btn.getAttribute('data-target');
                const content = document.getElementById(targetId);
                if (content) {
                    const isOpen = content.style.display === 'block';
                    content.style.display = isOpen ? 'none' : 'block';
                    btn.innerHTML = (isOpen ? '▼' : '▲') + btn.innerHTML.slice(1);
                }
            }
        });
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
        const library = this.librarySelect.value;
        const module = this.moduleSelect.value;
        const selectedClass = this.classSelect.value;

        console.log(`Class selected: ${selectedClass}`);

        // Update the selectedClass property
        this.selectedClass = selectedClass;

        // Clear method select
        this.methodsContainer.innerHTML = '<p>Select a class first</p>';

        if (!selectedClass) {
            return;
        }

        // Show loading message in the method select
        this.methodsContainer.innerHTML = '<div class="loading-message">Loading methods...</div>';

        // Update parameter container to show loading
        this.parametersContainer.innerHTML = '<div class="loading-message">Loading class details...</div>';

        try {
            // Clear previous details
            this.selectedMethods = [];
            this.parameters = {};
            this.inputNodes = [];
            this.outputNodes = [];

            // Perform the fetch
            const response = await fetch(`/api/langchain/class_details?library=${library}&module=${module}&class_name=${selectedClass}`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();
            this.classDetails = data;

            // Update class description
            const description = this.modal.querySelector('.class-description');
            description.innerHTML = `
                <div class="class-name-header">
                    <h3>${selectedClass}</h3>
                    <div class="class-path" style="display: none;">${library}.${module}.${selectedClass}</div>
                </div>
                <div class="docstring-content">
                    ${this.formatDocstring(data.doc || 'No description available.')}
                </div>
            `;

            // Initialize collapsible sections
            this.initCollapsibleSections();


            // Update methods container
            this.updateMethodsContainer();
        } catch (error) {
            console.error('Error loading class details:', error);
            const description = this.modal.querySelector('.class-description');
            description.innerHTML = `<p class="error">Error loading class details: ${error.message}</p>`;
            this.methodsContainer.innerHTML = `<p class="error">Failed to load methods: ${error.message}</p>`;
        }
    }



    // Initialize collapsible sections
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
        // Use the DocstringHandler for formatting
        const docstringHandler = new DocstringHandler();
        const parsedDocstring = docstringHandler.parseDocstring(docstring);
        return docstringHandler.formatDocstring(parsedDocstring);
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
                        ${this.formatDocstring(this.classDetails.doc || 'No documentation available for constructor.')}
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
                        ${this.formatDocstring(methodDoc)}
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
                    console.log('Attempt save');
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
     * @param {string} blockId - The ID of the block these parameters belong to
     * @returns {string} - HTML for parameter inputs
     */
    renderParameterInputs(methodName, parameters, blockId = '') {
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

            // Determine if the parameter is likely a file path
            const isFilePath = param.name.toLowerCase().includes('file') ||
                               param.name.toLowerCase().includes('path');

            // Block ID attribute for targeting the right block
            const blockIdAttr = blockId ? ` data-block-id="${blockId}"` : '';

            // Create input field with parameter details
            html += `
                <div class="param-row ${isFilePath ? 'file-param-row' : ''}">
                    <label for="${methodName}-${param.name}">
                        ${param.name}${requiredMark}:
                        <span class="param-type">${param.type || 'Any'}</span>
                    </label>
                    <div class="input-container">
                        <input type="text"
                            id="${methodName}-${param.name}"
                            class="param-input"
                            data-method="${methodName}"
                            data-param="${param.name}"
                            ${blockIdAttr}
                            value="${storedValue}"
                            placeholder="${param.default || ''}">
                        ${isFilePath ? `
                        <button type="button"
                            class="file-upload-btn"
                            data-method="${methodName}"
                            data-param="${param.name}"
                            ${blockIdAttr}
                            title="Upload files">
                            <span>📁</span>
                        </button>` : ''}
                    </div>
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
            saveModuleInfo(this.selectedClass, this.librarySelect.value, this.moduleSelect.value, blockId);

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

        // Try to find in localStorage if we've used this class before
        const customBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
        const existingBlock = customBlocks.find(block => block.className === className);

        if (existingBlock && existingBlock.moduleInfo) {
            return {
                library: existingBlock.moduleInfo.library,
                module: existingBlock.moduleInfo.module
            };
        }
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
        console.log('selections reset');

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
function saveModuleInfo(className, library, module, blockId = null) {
    // Get existing blocks from sessionStorage
    const existingBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');

    // Find the block with matching class name
    const blockIndex = existingBlocks.findIndex(block => block.className === className);

    const moduleInfo = {
        library: library,
        module: module
    }

    if (blockIndex >= 0) {
        // Update existing block's module info
        existingBlocks[blockIndex].moduleInfo = moduleInfo
        // If a block ID was provided, update it
        if (blockId && existingBlocks[blockIndex].id !== blockId) {
            existingBlocks[blockIndex].id = blockId;
        }

    } else {
        // Create a new entry if block not found
        existingBlocks.push({
            className: className,
            id: blockId || `class-${Date.now()}`, // Use provided ID or generate one
            moduleInfo: moduleInfo
        });
    }

    // Save back to sessionStorage
    sessionStorage.setItem('customBlocks', JSON.stringify(existingBlocks));

    console.log(`Saved module info for ${className}: ${module}`);

    // Also save to localStorage as a backup
    try {
        const localBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
        const localBlockIndex = localBlocks.findIndex(block => block.className === className);

        if (localBlockIndex >= 0) {
            localBlocks[localBlockIndex].moduleInfo = moduleInfo;
        } else {
            localBlocks.push({
                className: className,
                moduleInfo: moduleInfo
            });
        }

        localStorage.setItem('customBlocks', JSON.stringify(localBlocks));
    } catch (e) {
        console.warn('Failed to save to localStorage:', e);
    }
}

// Function to create a custom block on the canvas
function createCustomBlock(className, inputNodes, outputNodes, blockId, originalBlockId = null) {
    // Create a new block element
    var blockName = className;
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
                <div class="block-drag-handle" contenteditable="true">${blockName}</div>
            </div>
            <div class="node-container">
                    <div class="input-node-group">
                        ${inputNodes.map(node =>
                            `<div class="input-node" data-input="${typeof node === 'string' ? node : node.name}">
                                <div class="tooltip-container">
                                    <div class="node-label">${typeof node === 'string' ? node : node.name}</div>
                                </div>
                            </div>`
                        ).join('')}
                    </div>
                    <div class="output-node-group">
                        ${outputNodes.map(node =>
                            `<div class="output-node" data-output="${typeof node === 'string' ? node : node.name}">
                                <div class="tooltip-container">
                                    <div class="node-label">${typeof node === 'string' ? node : node.name}</div>
                                </div>
                            </div>`
                        ).join('')}
                    </div>
            </div>
            <div class="block-content">
                <select class="method-select" title="Select method to execute">
                    <option value="" disabled= selected>Select method...</option>
                </select>
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
    console.log('try method select');
    if (methodSelect) {
        console.log('method select found');
        methodSelect.addEventListener('change', () => {
            const selectedMethod = methodSelect.value;
            console.log(`Method selected: ${selectedMethod}`);

            // Add a method row for the selected method
            if (selectedMethod && selectedMethod !== '__init__') {
                addMethodRow(block, selectedMethod, blockId);
            }

            // Update block parameters based on selected method
            updateBlockParameters(block, selectedMethod);

            // Reset method select to the default option
            methodSelect.selectedIndex = 0;
        });
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

    // Also check for saved method selections for this block
    let savedMethodSelections = [];
    try {
        const methodsKey = `blockMethods-${blockId}`;
        savedMethodSelections = JSON.parse(localStorage.getItem(methodsKey) || '[]');
    } catch (e) {
        console.warn('Error reading methods from localStorage:', e);
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

        // Add saved method rows if any
        if (savedMethodSelections.length > 0) {
            // Update method rows display
            updateMethodsDisplay(block, savedMethodSelections, blockId);
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
                    // Set first method as selected
                    if (methodSelect.options.length > 1) {
                        methodSelect.selectedIndex = 1;
                        // Trigger change event
                        const changeEvent = new Event('change');
                        methodSelect.dispatchEvent(changeEvent);
                    }
                });
        } else {
            console.warn(`No module info found for ${blockId || className}`);

            // Set first method as selected
            if (methodSelect.options.length > 1) {
                methodSelect.selectedIndex = 1;
                // Trigger change event
                const changeEvent = new Event('change');
                methodSelect.dispatchEvent(changeEvent);
            }
        }
    }
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
                // Make sure className is also set
                customBlocks[existingBlockIndex].className = className;
        } else {
                // Create new entry with both blockId and className
            customBlocks.push({
                    id: blockId,
                    className: className,
                    methods: methods
                });
            }
        } else {
            // If no blockId, update by className (legacy behavior)
            const existingBlockIndex = customBlocks.findIndex(b => b.className === className);
            if (existingBlockIndex >= 0) {
                customBlocks[existingBlockIndex].methods = methods;
            } else {
                customBlocks.push({
                    id: `class-${Date.now()}`,
                    className: className,
                    methods: methods
                });
            }
        }

        sessionStorage.setItem('customBlocks', JSON.stringify(customBlocks));
        console.log(`Saved methods for ${blockId || className}:`, methods);

        // Also save to localStorage as a backup but only for className (not specific blocks)
        try {
            const localBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            const existingBlockIndex = localBlocks.findIndex(b => b.className === className);

            if (existingBlockIndex >= 0) {
                localBlocks[existingBlockIndex].methods = methods;
            } else {
                localBlocks.push({
                    className: className,
                    methods: methods
                });
            }

            localStorage.setItem('customBlocks', JSON.stringify(localBlocks));
        } catch (e) {
            console.warn('Failed to save methods to localStorage:', e);
        }
    } catch (error) {
        console.error(`Error saving methods for ${blockId || className}:`, error);
    }
}

// Function to update block parameters based on selected method
function updateBlockParameters(block, methodName) {
    if (!methodName) return;

    const paramsContainer = block.querySelector('.block-parameters');
    if (!paramsContainer) return;

    // Store current parameter values before clearing container
    const currentParams = {};
    const paramRows = paramsContainer.querySelectorAll('.parameter-row');
    paramRows.forEach(row => {
        const nameSelect = row.querySelector('.param-name-select');
        const nameInput = row.querySelector('.param-name');
        const valueInput = row.querySelector('.param-value');

        let paramName = '';
        if (nameSelect && nameSelect.value) {
            paramName = nameSelect.value;
        } else if (nameInput && nameInput.value) {
            paramName = nameInput.value;
        }

        if (paramName && valueInput) {
            currentParams[paramName] = valueInput.value;
        }
    });

    // Clear existing parameters
    paramsContainer.innerHTML = '';

    // Get the class name
    const className = block.getAttribute('data-class-name');
    if (!className) return;

    // Get the block ID
    const blockId = block.id;

    // Find module info for this class
    let moduleInfo = null;

    // Try to find from sessionStorage first by blockId
    try {
        const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
        const blockData = customBlocks.find(b => b.id === blockId);

        if (blockData && blockData.className === className) {
            // If we have module info stored with the block
            if (blockData.moduleInfo) {
                moduleInfo = blockData.moduleInfo;
            }
        }
    } catch (e) {
        console.warn('Error fetching module info from sessionStorage:', e);
    }

    // If not found by blockId, try by className
    if (!moduleInfo) {
        try {
            const localBlocks = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            const blockData = localBlocks.find(b => b.className === className);

            if (blockData && blockData.moduleInfo) {
                moduleInfo = blockData.moduleInfo;
            }
        } catch (e) {
            console.warn('Error fetching module info from localStorage:', e);
        }
    }

    // Get ALL saved parameters for this block from localStorage, not just for the current method
    let savedMethodParams = {};
    try {
        const savedParams = JSON.parse(localStorage.getItem(`blockParams-${blockId}`) || '{}');
        savedMethodParams = savedParams;
    } catch (e) {
        console.warn('Error fetching saved parameters:', e);
    }

    // If we found module info, try to fetch class details
    if (moduleInfo && moduleInfo.module) {
        const library = moduleInfo.library || '';
        const module = moduleInfo.module;

        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.className = 'loading-parameters';
        loadingMsg.textContent = 'Loading parameters...';
        paramsContainer.appendChild(loadingMsg);

        // Fetch class details
        fetch(`/api/langchain/class_details?library=${library}&module=${module}&class_name=${className}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to fetch class details: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(`Fetched class details for ${className}:`, data);

                // Remove loading message
                paramsContainer.innerHTML = '';

                // Collect parameters from all methods for complete parameter list
                let allMethodParams = [];

                // First add init params
                if (data.init_params) {
                    allMethodParams = [...data.init_params];
                }

                // Then add parameters from all methods
                if (data.method_details) {
                    data.method_details.forEach(methodDetail => {
                        if (methodDetail.parameters) {
                            methodDetail.parameters.forEach(param => {
                                // Check if this parameter is already in our list
                                const exists = allMethodParams.some(p => p.name === param.name);
                                if (!exists && param.name !== 'self') {
                                    allMethodParams.push(param);
                                }
                            });
                        }
                    });
                }

                // Find method details for the current method
                let methodParams = [];

                if (methodName === '__init__') {
                    // For constructor, use init_params from class details
                    if (data.init_params) {
                        methodParams = data.init_params;
                    }
                } else if (data.method_details) {
                    // For other methods, find the specific method
                    const methodDetail = data.method_details.find(m => m.name === methodName);
                    if (methodDetail && methodDetail.parameters) {
                        methodParams = methodDetail.parameters;
                    }
                }

                // Create parameter selection dropdown
                const paramSelectRow = document.createElement('div');
                paramSelectRow.className = 'parameter-select-row';

                const paramSelectLabel = document.createElement('label');
                paramSelectLabel.textContent = 'Add parameter:';
                paramSelectLabel.className = 'param-select-label';

                const paramSelect = document.createElement('select');
                paramSelect.className = 'param-select-dropdown';

                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select parameter...';
                paramSelect.appendChild(defaultOption);

                // Add available parameters to dropdown
                allMethodParams.forEach(param => {
                    if (param.name === 'self') return; // Skip 'self' parameter

                    const option = document.createElement('option');
                    option.value = param.name;

                    // Show parameter name with type and required status if available
                    let optionText = param.name;
                    if (param.type && param.type !== 'Any') {
                        optionText += ` (${param.type})`;
                    }
                    if (param.required) {
                        optionText += ' *';
                    }
                    option.textContent = optionText;
                    paramSelect.appendChild(option);
                });

                // Add event listener for parameter selection
                paramSelect.addEventListener('change', () => {
                    if (!paramSelect.value) return;

                    // Check if this parameter is already added
                    const existingParam = paramsContainer.querySelector(`.parameter-row[data-param-name="${paramSelect.value}"]`);
                    if (existingParam) {
                        // Highlight the existing parameter briefly
                        existingParam.classList.add('highlight');
                        setTimeout(() => {
                            existingParam.classList.remove('highlight');
                        }, 1000);
                        paramSelect.value = '';
                        return;
                    }

                    // Find the parameter details
                    const paramInfo = allMethodParams.find(p => p.name === paramSelect.value);
                    if (paramInfo) {
                        // Get value from saved parameters or current params
                        let savedValue = '';
                        if (savedMethodParams[paramInfo.name]) {
                            savedValue = savedMethodParams[paramInfo.name];
                        } else if (currentParams[paramInfo.name]) {
                            savedValue = currentParams[paramInfo.name];
                        }

                        // Add the parameter row
                        const paramRow = addParameterRowForMethod(paramsContainer, paramInfo.name, savedValue, allMethodParams, blockId);

                        // Focus on the value input to encourage the user to enter a value
                        const valueInput = paramRow.querySelector('.param-value');
                        if (valueInput) {
                            valueInput.focus();
                            valueInput.select();
                        }

                        // Reset dropdown
                        paramSelect.value = '';
                    }
                });

                paramSelectRow.appendChild(paramSelectLabel);
                paramSelectRow.appendChild(paramSelect);
                paramsContainer.appendChild(paramSelectRow);

                // Create divider
                const divider = document.createElement('div');
                divider.className = 'params-divider';
                paramsContainer.appendChild(divider);

                // Create parameters container
                const activeParamsContainer = document.createElement('div');
                activeParamsContainer.className = 'active-parameters';
                paramsContainer.appendChild(activeParamsContainer);

                // Create a set of parameters we will display
                const displayedParams = new Set();

                // First, show parameters for the current method that have values or are required
                methodParams.forEach(param => {
                    if (param.name === 'self') return; // Skip 'self' parameter

                    // Check if we have a saved value for this parameter
                    let hasValue = false;
                    let savedValue = '';

                    if (savedMethodParams[param.name]) {
                        hasValue = true;
                        savedValue = savedMethodParams[param.name];
                    } else if (currentParams[param.name]) {
                        hasValue = true;
                        savedValue = currentParams[param.name];
                    }

                    // Always show parameters with values
                    if (hasValue && savedValue.trim() !== '') {
                        addParameterRowForMethod(activeParamsContainer, param.name, savedValue, allMethodParams, blockId);
                        displayedParams.add(param.name);
                    }
                });

                // Then show any saved parameters from other methods that have values
                Object.keys(savedMethodParams).forEach(paramName => {
                    // Skip if already displayed
                    if (displayedParams.has(paramName)) return;

                    const savedValue = savedMethodParams[paramName];

                    // If parameter has a value, show it even if it's not part of the current method
                    if (savedValue && savedValue.trim() !== '') {
                        // Find parameter info if available
                        const paramInfo = allMethodParams.find(p => p.name === paramName);
                        if (paramInfo) {
                            addParameterRowForMethod(activeParamsContainer, paramName, savedValue, allMethodParams, blockId);
                            displayedParams.add(paramName);
                        } else {
                            // Handle case where param info is not available (fallback)
                            const genericParams = [{name: paramName, type: 'Any', required: false}];
                            addParameterRowForMethod(activeParamsContainer, paramName, savedValue, genericParams, blockId);
                            displayedParams.add(paramName);
                        }
                    }
                });

                // Also show any current parameters with values not in saved params
                Object.keys(currentParams).forEach(paramName => {
                    // Skip if already displayed
                    if (displayedParams.has(paramName)) return;

                    const value = currentParams[paramName];

                    // If parameter has a value, show it
                    if (value && value.trim() !== '') {
                        // Find parameter info if available
                        const paramInfo = allMethodParams.find(p => p.name === paramName);
                        if (paramInfo) {
                            addParameterRowForMethod(activeParamsContainer, paramName, value, allMethodParams, blockId);
                            displayedParams.add(paramName);
                        } else {
                            // Handle case where param info is not available (fallback)
                            const genericParams = [{name: paramName, type: 'Any', required: false}];
                            addParameterRowForMethod(activeParamsContainer, paramName, value, genericParams, blockId);
                            displayedParams.add(paramName);
                        }
                    }
                });
            })
            .catch(error => {
                console.error(`Error fetching parameters for ${className}.${methodName}:`, error);

                // Remove loading message
                paramsContainer.innerHTML = '';
            });
    } else {
        console.log('no module info');
    }
}

// Helper function to add a parameter row with an already selected parameter
function addParameterRowForMethod(container, paramName, value = '', availableParams = [], blockId = '') {
    // Create a new parameter row
    const paramRow = document.createElement('div');
    paramRow.className = 'parameter-row';
    paramRow.setAttribute('data-param-name', paramName);

    // Create param name label
    const paramNameLabel = document.createElement('div');
    paramNameLabel.className = 'param-name-label';

    // Get parameter info for display
    let displayName = paramName;
    const paramInfo = availableParams.find(p => p.name === paramName);
    if (paramInfo) {
        if (paramInfo.type && paramInfo.type !== 'Any') {
            displayName += ` (${paramInfo.type})`;
        }
        if (paramInfo.required) {
            displayName += ' *';
        }
    }
    paramNameLabel.textContent = displayName;

    // Check if this parameter might be a file path
    const isFilePath = paramName.toLowerCase().includes('file') ||
                       paramName.toLowerCase().includes('path');

    // Create input container for file path parameters
    const inputContainer = document.createElement('div');
    inputContainer.className = isFilePath ? 'input-container' : '';

    // Create value input
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.className = 'param-value';
    valueInput.placeholder = 'Value';
    valueInput.value = value;

    // Add data attribute to mark which block this parameter belongs to
    valueInput.setAttribute('data-block-id', blockId);
    valueInput.setAttribute('data-param-name', paramName);

    // Save value on input instead of just change event to be more responsive
    valueInput.addEventListener('input', () => {
        saveParameterValue(blockId, paramName, valueInput.value);
    });

    // Also keep the change event for compatibility
    valueInput.addEventListener('change', () => {
        saveParameterValue(blockId, paramName, valueInput.value);
    });

    // Add the input to the container
    inputContainer.appendChild(valueInput);

    // Add file upload button for file path parameters
    if (isFilePath) {
        const fileUploadBtn = document.createElement('button');
        fileUploadBtn.type = 'button';
        fileUploadBtn.className = 'file-upload-btn';
        fileUploadBtn.title = 'Upload files';
        fileUploadBtn.setAttribute('data-param', paramName);
        fileUploadBtn.setAttribute('data-block-id', blockId); // Add block ID
        fileUploadBtn.setAttribute('data-param-name', paramName); // Add param name for easier lookup
        fileUploadBtn.innerHTML = '<span>📁</span>';

        // Add click event to directly handle file uploads for this specific block and parameter
        fileUploadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log(`File upload button clicked for block ${blockId}, parameter ${paramName}`);

            if (typeof FilePathHandler === 'object' && typeof FilePathHandler.showFileSelectionModal === 'function') {
                // Get current value from input
                const currentValue = valueInput.value;
                // Use function from FilePathHandler namespace but ensure we pass blockId
                FilePathHandler.showFileSelectionModal('__init__', paramName, currentValue, blockId, valueInput);
            }
        });

        inputContainer.appendChild(fileUploadBtn);
        paramRow.classList.add('file-param-row');
    }

    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-param-btn';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', () => {
        // When removing, also remove from saved parameters
        if (blockId) {
            try {
                const savedParams = JSON.parse(localStorage.getItem(`blockParams-${blockId}`) || '{}');
                delete savedParams[paramName];
                localStorage.setItem(`blockParams-${blockId}`, JSON.stringify(savedParams));
            } catch (e) {
                console.warn('Error removing saved parameter:', e);
            }
        }
        paramRow.remove();
    });

    // Add hidden input with parameter name for form submission
    const hiddenNameInput = document.createElement('input');
    hiddenNameInput.type = 'hidden';
    hiddenNameInput.className = 'param-name-select';
    hiddenNameInput.value = paramName;

    // Add elements to row
    paramRow.appendChild(paramNameLabel);
    paramRow.appendChild(isFilePath ? inputContainer : valueInput);
    paramRow.appendChild(removeBtn);
    paramRow.appendChild(hiddenNameInput);

    // Add row to container
    container.appendChild(paramRow);

    // Save the parameter value immediately (even if empty) to track that user has explicitly added it
    saveParameterValue(blockId, paramName, value);

    return paramRow;
}

// Helper function to save parameter value
function saveParameterValue(blockId, paramName, value) {
    if (blockId) {
        try {
            const savedParams = JSON.parse(localStorage.getItem(`blockParams-${blockId}`) || '{}');
            savedParams[paramName] = value;
            localStorage.setItem(`blockParams-${blockId}`, JSON.stringify(savedParams));
        } catch (e) {
            console.warn('Error saving parameter value:', e);
        }
    }
}

// Create a namespace for file handling functionality
const FilePathHandler = {
    // Store selected files by parameter
    selectedFiles: {},

    // Initialize event listeners for file upload buttons
    init() {
        // Add global event delegation for file upload buttons
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.file-upload-btn');
            if (button) {
                e.preventDefault();

                // Get the method name and parameter name
                const methodName = button.getAttribute('data-method') || '__init__';
                const paramName = button.getAttribute('data-param');
                const blockId = button.getAttribute('data-block-id');

                if (!blockId) {
                    console.error('Missing block ID for file upload button');
                    return;
                }

                console.log(`File upload clicked for block ${blockId}, parameter ${paramName}`);

                // Find the input element - try multiple selectors to ensure we find it
                let inputElement = null;

                // First try to find by data attributes
                if (methodName && paramName) {
                    inputElement = document.querySelector(`.param-input[data-method="${methodName}"][data-param="${paramName}"]`);
                }

                // If not found, try to find it within the parameter row
                if (!inputElement) {
                    const paramRow = button.closest('.parameter-row');
                    if (paramRow) {
                        inputElement = paramRow.querySelector('.param-value') || paramRow.querySelector('input[type="text"]');
                    }
                }

                // Get current value (comma-separated paths)
                const currentValue = inputElement ? inputElement.value : '';

                console.log('File upload clicked:', { methodName, paramName, currentValue });

                // Show file selection modal with block ID
                this.showFileSelectionModal(methodName, paramName, currentValue, blockId, inputElement);
            }
        });
    },

    // Extract file paths from a string which might contain filenames in various formats
    // such as "files/file1.pdf", "[files/file1.pdf, files/file2.pdf]", etc.
    extractFilePaths(inputString) {
        if (!inputString || typeof inputString !== 'string') {
            return [];
        }

        const paths = [];

        // Clean up the input string
        let cleaned = inputString.trim();

        // Check if it's an array format
        if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
            // Remove brackets and split by commas
            cleaned = cleaned.substring(1, cleaned.length - 1);
            const items = cleaned.split(',').map(item => item.trim());

            for (const item of items) {
                // Extract file name from various formats
                let filename = item;

                // If it looks like "files/filename.ext"
                if (item.includes('files/')) {
                    filename = item.substring(item.indexOf('files/') + 6);
                    // Remove quotes if present
                    filename = filename.replace(/['"]/g, '');
                    paths.push(filename);
                }
                // If it looks like 'os.path.join("files", "filename.ext")'
                else if (item.includes('os.path.join') && item.includes('"files"')) {
                    const match = item.match(/"([^"]+)"(?:\s*\))?$/);
                    if (match && match[1]) {
                        paths.push(match[1]);
                    }
                }
                // If it's just a quoted filename
                else if (item.startsWith('"') || item.startsWith("'")) {
                    filename = item.substring(1, item.length - 1);
                    if (!filename.includes('/') && !filename.includes('\\')) {
                        paths.push(filename);
                    }
                }
            }
        }
        // If it's comma-separated paths like "files/file1.pdf, files/file2.pdf"
        else if (cleaned.includes(',')) {
            const items = cleaned.split(',').map(item => item.trim());

            for (const item of items) {
                let filename = item;

                // If it looks like "files/filename.ext"
                if (item.includes('files/')) {
                    filename = item.substring(item.indexOf('files/') + 6);
                    // Remove quotes if present
                    filename = filename.replace(/['"]/g, '');
                    paths.push(filename);
                }
                // Direct filename (no files/ prefix)
                else {
                    // Remove quotes if present
                    filename = item.replace(/['"]/g, '');
                    if (filename) {
                        paths.push(filename);
                    }
                }
            }
        }
        // If it's just a single path like "files/filename.ext"
        else if (cleaned.includes('files/')) {
            let filename = cleaned.substring(cleaned.indexOf('files/') + 6);
            // Remove quotes if present
            filename = filename.replace(/['"]/g, '');
            paths.push(filename);
        }
        // Single filename without files/ prefix
        else if (cleaned) {
            // Remove quotes if present
            const filename = cleaned.replace(/['"]/g, '');
            if (filename) {
                paths.push(filename);
            }
        }

        return paths;
    },

    // Show file selection modal
    showFileSelectionModal(methodName, paramName, currentValue, blockId, targetInputElement) {
        // First check if there's already an open file selection modal and remove it
        const existingModal = document.querySelector('.file-selection-modal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

// Generate a unique key for this parameter that includes the block ID
const paramKey = `${blockId}_${methodName}_${paramName}`;

console.log(`Opening file selection modal with paramKey: ${paramKey}`);

        // Initialize selected files for this parameter if not already done
        if (!this.selectedFiles[paramKey]) {
            // Parse any existing files from the current input value
            const filenames = this.extractFilePaths(currentValue);
            this.selectedFiles[paramKey] = filenames.map(name => ({ name }));
        }

        // Create modal markup
        const modal = document.createElement('div');
        modal.className = 'file-selection-modal';
        // Store reference to the target input element
        modal.dataset.targetInput = paramKey;
        modal.dataset.blockId = blockId;
        modal.dataset.paramName = paramName;
        modal.innerHTML = `
            <div class="file-selection-content">
                <div class="file-selection-header">
                    <h3>Select Files for ${paramName}</h3>
                    <span class="file-selection-block-id">Block ID: ${blockId}</span>
                    <button class="close-modal">×</button>
                </div>
                <div class="file-selection-body">
                    <div class="file-upload-area">
                        <p>Drag & drop files here or click to select</p>
                        <input type="file" id="file-upload-input" multiple style="display: none;">
                    </div>
                    <div class="files-container">
                        <h4>Selected Files</h4>
                        <ul class="file-list"></ul>
                    </div>
                </div>
                <div class="file-selection-footer">
                    <button type="button" class="cancel-btn secondary">Cancel</button>
                    <button type="button" class="save-btn primary">Save</button>
                </div>
            </div>
        `;

        // Add modal to the DOM
        document.body.appendChild(modal);

        // Get modal elements
        const closeBtn = modal.querySelector('.close-modal');
        const cancelBtn = modal.querySelector('.cancel-btn');
        const saveBtn = modal.querySelector('.save-btn');
        const fileUploadArea = modal.querySelector('.file-upload-area');
        const fileInput = modal.querySelector('#file-upload-input');
        const fileList = modal.querySelector('.file-list');

        // Update file list UI
        this.updateFileList(fileList, paramKey);

        // Add event listeners
        closeBtn.addEventListener('click', () => this.closeModal(modal));
        cancelBtn.addEventListener('click', () => this.closeModal(modal));

        saveBtn.addEventListener('click', () => {
            // Find the corresponding input element using the stored reference
            let inputElement = targetInputElement;

            // If we still can't find it, use more aggressive DOM search
            if (!inputElement) {
                // Look for any input that matches this parameter name
                const allInputs = document.querySelectorAll('input.param-value, input.param-input');
                for (const input of allInputs) {
                    const paramAttr = input.getAttribute('data-param');
                    const paramRow = input.closest('.parameter-row');
                    const rowParamName = paramRow?.getAttribute('data-param-name');

                    if ((paramAttr === paramName) || (rowParamName === paramName)) {
                        inputElement = input;
                        break;
                    }
                }
            }

            if (inputElement) {
                // Get file paths and make them relative to the 'files' directory
                const filePaths = this.selectedFiles[paramKey].map(file =>
                    `files/${file.name}`
                );

                // Update input value with comma-space separated file paths
                // This ensures proper formatting for both visual display and parsing
                inputElement.value = filePaths.join(', ');

                // Trigger change event to save the value
                const event = new Event('change', { bubbles: true });
                inputElement.dispatchEvent(event);

                console.log(`Updated input for block ${blockId} with file paths:`, inputElement.value);

                // Also save to localStorage directly to ensure it's stored properly
                if (blockId && paramName) {
                    try {
                        const savedParams = JSON.parse(localStorage.getItem(`blockParams-${blockId}`) || '{}');
                        savedParams[paramName] = inputElement.value;
                        localStorage.setItem(`blockParams-${blockId}`, JSON.stringify(savedParams));
                        console.log(`Also saved file paths directly to localStorage for block ${blockId}`);
                    } catch (e) {
                        console.error('Error saving file paths to localStorage:', e);
                    }
                }
            } else {
                console.warn('Could not find input element to update with file paths');
            }

            this.closeModal(modal);
        });

        // File selection handling
        fileUploadArea.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', () => {
            const files = fileInput.files;
            if (files.length > 0) {
                // Add selected files to the list
                for (let i = 0; i < files.length; i++) {
                    // Only store the filename, not the actual file contents
                    this.selectedFiles[paramKey].push({
                        name: files[i].name
                    });
                }

                // Update the file list UI
                this.updateFileList(fileList, paramKey);

                // Reset the file input
                fileInput.value = '';
            }
        });

        // Drag and drop handling
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });

        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('drag-over');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');

            const files = e.dataTransfer.files;
            if (files.length > 0) {
                // Add dropped files to the list
                for (let i = 0; i < files.length; i++) {
                    this.selectedFiles[paramKey].push({
                        name: files[i].name
                    });
                }

                // Update the file list UI
                this.updateFileList(fileList, paramKey);
            }
        });
    },

    // Update the file list UI
    updateFileList(fileListElement, paramKey) {
        if (!fileListElement || !this.selectedFiles[paramKey]) return;

        // Clear the current list
        fileListElement.innerHTML = '';

        // Add each file to the list
        this.selectedFiles[paramKey].forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = `
                <span class="file-name">${file.name}</span>
                <button type="button" class="remove-file" data-index="${index}">×</button>
            `;
            fileListElement.appendChild(li);

            // Add event listener for remove button
            li.querySelector('.remove-file').addEventListener('click', () => {
                this.selectedFiles[paramKey].splice(index, 1);
                this.updateFileList(fileListElement, paramKey);
            });
        });

        // Show message if no files selected
        if (this.selectedFiles[paramKey].length === 0) {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = '<span class="file-name">No files selected</span>';
            fileListElement.appendChild(li);
        }
    },

    // Close the modal
    closeModal(modal) {
        if (modal && modal.parentNode) {
            document.body.removeChild(modal);
        }
    }
};

// Initialize file handling after DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing file path handler');
    FilePathHandler.init();
});

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

/**
 * Add a method row to the block for a selected method
 * @param {HTMLElement} block - The block element to add the method row to
 * @param {string} methodName - The name of the method
 * @param {string} blockId - The ID of the block
 * @returns {HTMLElement} - The created method row
 */
function addMethodRow(block, methodName, blockId = '') {
    // Get or create the method container
    let methodsContainer = block.querySelector('.block-methods');
    if (!methodsContainer) {
        methodsContainer = document.createElement('div');
        methodsContainer.className = 'block-methods';

        // Insert methods container before parameters container
        const blockContent = block.querySelector('.block-content');
        if (blockContent) {
            const parametersContainer = block.querySelector('.block-parameters');
            if (parametersContainer) {
                blockContent.insertBefore(methodsContainer, parametersContainer);
            } else {
                blockContent.appendChild(methodsContainer);
            }
        }
    }

    // Check if method row already exists
    const existingMethodRow = methodsContainer.querySelector(`.method-row[data-method="${methodName}"]`);
    if (existingMethodRow) {
        return existingMethodRow;
    }

    // Create a new method row
    const methodRow = document.createElement('div');
    methodRow.className = 'method-row';
    methodRow.setAttribute('data-method', methodName);

    // Create method name label
    const methodNameLabel = document.createElement('div');
    methodNameLabel.className = 'method-name-label';
    methodNameLabel.textContent = methodName;

    // Create remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-method-btn';
    removeBtn.innerHTML = '×';
    removeBtn.addEventListener('click', () => {
        // When removing, also remove from saved methods
        removeMethodSelection(blockId, methodName);
        methodRow.remove();

        // Remove any nodes associated with this method
        const inputNode = block.querySelector(`.input-node[data-input="${methodName}_input"]`);
        const outputNode = block.querySelector(`.output-node[data-output="${methodName}_output"]`);

        if (inputNode) inputNode.remove();
        if (outputNode) outputNode.remove();

        // Clean up any connections to/from these nodes
        if (typeof connections !== 'undefined' && Array.isArray(connections)) {
            connections = connections.filter(conn => {
                const keepConnection = !(
                    (conn.target === block.id && conn.inputId === `${methodName}_input`) ||
                    (conn.source === block.id && conn.source_node === `${methodName}_output`)
                );
                return keepConnection;
            });

            // Update visual connections
            if (typeof updateConnections === 'function') {
                updateConnections();
            }
        }

        // Update input/output nodes
        updateBlockNodesForMethods(block);
    });

    // Create input node for this method
    const inputNode = document.createElement('div');
    inputNode.className = 'input-node';
    inputNode.setAttribute('data-input', `${methodName}_input`);
    inputNode.innerHTML = `
        <div class="tooltip-container">
            <div class="node-label">${methodName}_input</div>
        </div>
    `;

    // Create output node for this method
    const outputNode = document.createElement('div');
    outputNode.className = 'output-node';
    outputNode.setAttribute('data-output', `${methodName}_output`);
    outputNode.innerHTML = `
        <div class="tooltip-container">
            <div class="node-label">${methodName}_output</div>
        </div>
    `;

    // Add method elements to row
    methodRow.appendChild(methodNameLabel);
    methodRow.appendChild(removeBtn);

    // Add row to container
    methodsContainer.appendChild(methodRow);

    // Add input node to the input-node-group
    const inputNodeGroup = block.querySelector('.input-node-group');
    if (inputNodeGroup) {
        inputNodeGroup.appendChild(inputNode);
    }

    // Add output node to the output-node-group
    const outputNodeGroup = block.querySelector('.output-node-group');
    if (outputNodeGroup) {
        outputNodeGroup.appendChild(outputNode);
    }

    // Set up connection handling for the new nodes
    if (typeof setupNodeConnections === 'function') {
        // Instead of calling setupNodeConnections for the whole block,
        // just set up the event listeners for these specific nodes
        setupNodeListener(inputNode);
        setupNodeListener(outputNode, true);
    }

    // Update node positions for even spacing
    updateBlockNodesForMethods(block);

    // Save the method selection
    saveMethodSelection(blockId, methodName);

    return methodRow;
}

/**
 * Set up event listeners for a single node
 * @param {HTMLElement} node - The node to set up listeners for
 * @param {boolean} isOutput - Whether the node is an output node
 */
function setupNodeListener(node, isOutput = false) {
    if (!node) return;

    if (isOutput) {
        // For output nodes, set up drag start
        node.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (typeof draggingConnection !== 'undefined') {
                window.draggingConnection = true;
            }
            if (typeof sourceNode !== 'undefined') {
                window.sourceNode = node;
            }

            // Create the temporary connection line
            try {
                const rect = node.getBoundingClientRect();
                const canvasRect = document.getElementById('canvas').getBoundingClientRect();
                const zoom = window.zoom || 1;
                const currentTranslate = window.currentTranslate || { x: 0, y: 0 };

                let tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x1 = ((rect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom) + node.offsetWidth/2;
                const y1 = ((rect.top - canvasRect.top) / zoom) - (currentTranslate.y / zoom) + node.offsetHeight/2;

                tempConnection.setAttribute('x1', x1);
                tempConnection.setAttribute('y1', y1);
                tempConnection.setAttribute('x2', x1);
                tempConnection.setAttribute('y2', y1);
                tempConnection.setAttribute('class', 'connection-line dragging');

                const connectionsContainer = document.getElementById('connections');
                if (connectionsContainer) {
                    connectionsContainer.appendChild(tempConnection);
                    if (typeof window.tempConnection !== 'undefined') {
                        window.tempConnection = tempConnection;
                    }
                }
            } catch (e) {
                console.error('Error setting up output node listener:', e);
            }
        });
    } else {
        // For input nodes
        node.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        node.addEventListener('mouseover', (e) => {
            if (typeof draggingConnection !== 'undefined' &&
                typeof sourceNode !== 'undefined' &&
                draggingConnection && sourceNode) {

                const sourceBlock = sourceNode.closest('.block');
                const targetBlock = node.closest('.block');

                if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                    if (typeof hoveredInputNode !== 'undefined') {
                        window.hoveredInputNode = node;
                    }
                    node.classList.add('input-node-hover');

                    // Add effect to visualize potential connection
                    if (typeof tempConnection !== 'undefined' && tempConnection) {
                        tempConnection.classList.add('connection-hover');
                    }
                    e.stopPropagation();
                }
            }
        });

        node.addEventListener('mouseout', (e) => {
            if (typeof hoveredInputNode !== 'undefined' && hoveredInputNode === node) {
                window.hoveredInputNode = null;
                node.classList.remove('input-node-hover');

                // Remove hover effect
                if (typeof tempConnection !== 'undefined' && tempConnection) {
                    tempConnection.classList.remove('connection-hover');
                }
                e.stopPropagation();
            }
        });
    }
}

/**
 * Update the display of methods for a block
 * @param {HTMLElement} block - The block element to update
 * @param {Array} methods - The methods to display
 * @param {string} blockId - The ID of the block
 */
function updateMethodsDisplay(block, methods, blockId = '') {
    if (!block || !Array.isArray(methods)) return;

    // Get or create the methods container
    let methodsContainer = block.querySelector('.block-methods');
    if (!methodsContainer) {
        methodsContainer = document.createElement('div');
        methodsContainer.className = 'block-methods';

        // Insert methods container before parameters container
        const blockContent = block.querySelector('.block-content');
        if (blockContent) {
            const parametersContainer = block.querySelector('.block-parameters');
            if (parametersContainer) {
                blockContent.insertBefore(methodsContainer, parametersContainer);
            } else {
                blockContent.appendChild(methodsContainer);
            }
        }
    }

    // Clear existing method rows - keep those that match our methods array
    const existingRows = Array.from(methodsContainer.querySelectorAll('.method-row'));
    existingRows.forEach(row => {
        const rowMethod = row.getAttribute('data-method');
        if (!methods.includes(rowMethod)) {
            row.remove();
        }
    });

    // Add rows for methods that don't already have them
    methods.forEach(method => {
        if (method === '__init__') return; // Skip __init__ method as it's not displayed

        // Check if row already exists
        const existingRow = methodsContainer.querySelector(`.method-row[data-method="${method}"]`);
        if (!existingRow) {
            addMethodRow(block, method, blockId);
        }
    });

    // Update the node positions after changing method rows
    updateBlockNodesForMethods(block);
}

/**
 * Save method selection to storage
 * @param {string} blockId - The ID of the block
 * @param {string} methodName - The method name to save
 */
function saveMethodSelection(blockId, methodName) {
    if (!blockId || !methodName) return;

    try {
        // Save to sessionStorage first (for current session)
        const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
        const blockData = customBlocks.find(b => b.id === blockId);

        if (blockData) {
            if (!blockData.methods) {
                blockData.methods = [];
            }

            if (!blockData.methods.includes(methodName)) {
                blockData.methods.push(methodName);
                sessionStorage.setItem('customBlocks', JSON.stringify(customBlocks));
            }
        }

        // Also save to localStorage (for persistence between sessions)
        const methodsKey = `blockMethods-${blockId}`;
        const savedMethods = JSON.parse(localStorage.getItem(methodsKey) || '[]');

        if (!savedMethods.includes(methodName)) {
            savedMethods.push(methodName);
            localStorage.setItem(methodsKey, JSON.stringify(savedMethods));
        }

        console.log(`Saved method ${methodName} for block ${blockId}`);
    } catch (e) {
        console.error('Error saving method selection:', e);
    }
}

/**
 * Remove a method selection for a block
 * @param {string} blockId - The block ID to remove the method from
 * @param {string} methodName - The method name to remove
 */
function removeMethodSelection(blockId, methodName) {
    if (!blockId || !methodName) return;

    try {
        // Remove from sessionStorage
        const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
        const blockData = customBlocks.find(b => b.id === blockId);

        if (blockData && blockData.methods) {
            blockData.methods = blockData.methods.filter(m => m !== methodName);
            sessionStorage.setItem('customBlocks', JSON.stringify(customBlocks));
        }

        // Remove from localStorage
        const methodsKey = `blockMethods-${blockId}`;
        const savedMethods = JSON.parse(localStorage.getItem(methodsKey) || '[]');

        if (savedMethods.includes(methodName)) {
            const updatedMethods = savedMethods.filter(m => m !== methodName);
            localStorage.setItem(methodsKey, JSON.stringify(updatedMethods));
        }

        console.log(`Removed method ${methodName} for block ${blockId}`);
    } catch (e) {
        console.error('Error removing method selection:', e);
    }
}

/**
 * Update the spacing and positioning of nodes for methods
 * @param {HTMLElement} block - The block to update node positions for
 */
function updateBlockNodesForMethods(block) {
    // Update spacing for input nodes
    const inputNodes = block.querySelectorAll('.input-node');
    const inputNodeCount = inputNodes.length;

    if (inputNodeCount > 0) {
        const inputNodeGroup = block.querySelector('.input-node-group');
        const blockHeight = block.offsetHeight;

        // Distribute input nodes evenly
        inputNodes.forEach((node, index) => {
            const position = (blockHeight / (inputNodeCount + 1)) * (index + 1);
            node.style.top = `${position}px`;
        });
    }

    // Update spacing for output nodes
    const outputNodes = block.querySelectorAll('.output-node');
    const outputNodeCount = outputNodes.length;

    if (outputNodeCount > 0) {
        const outputNodeGroup = block.querySelector('.output-node-group');
        const blockHeight = block.offsetHeight;

        // Distribute output nodes evenly
        outputNodes.forEach((node, index) => {
            const position = (blockHeight / (outputNodeCount + 1)) * (index + 1);
            node.style.top = `${position}px`;
        });
    }
}

