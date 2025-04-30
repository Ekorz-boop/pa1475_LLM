/**
 * Template Handler
 * Manages saving and loading pipeline templates
 */

class TemplateHandler {
    constructor() {
        // Only initialize when document is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    init() {
        console.log('Initializing TemplateHandler');
        
        // Load saved templates immediately
        this.templates = this.loadSavedTemplates() || [];
        console.log(`Loaded ${this.templates.length} saved templates`);
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Make sure the required global functions are available
        this.checkRequiredFunctions();
        
        // Initialize UI components
        this.displaySavedTemplates();
        
        // Add references to required external functions
        this.importExternalFunctions();
    }
    
    /**
     * Import references to external functions needed for template handling
     */
    importExternalFunctions() {
        // Check if window.findModuleInfoForClass is available, otherwise try to import it
        if (typeof window.findModuleInfoForClass !== 'function' && typeof findModuleInfoForClass === 'function') {
            window.findModuleInfoForClass = findModuleInfoForClass;
        }
        
        // Same for saveModuleInfo
        if (typeof window.saveModuleInfo !== 'function' && typeof saveModuleInfo === 'function') {
            window.saveModuleInfo = saveModuleInfo;
        }
        
        // Same for saveMethods
        if (typeof window.saveMethods !== 'function' && typeof saveMethods === 'function') {
            window.saveMethods = saveMethods;
        }
        
        // Same for saveParameterValue
        if (typeof window.saveParameterValue !== 'function' && typeof saveParameterValue === 'function') {
            window.saveParameterValue = saveParameterValue;
        }
        
        // Same for createCustomBlock
        if (typeof window.createCustomBlock !== 'function' && typeof createCustomBlock === 'function') {
            window.createCustomBlock = createCustomBlock;
        }
    }

    /**
     * Check if required functions are available for creating blocks and connections
     * @param {number} retryCount - Current retry count
     * @param {number} maxRetries - Maximum number of retries
     * @returns {Promise<boolean>} - Promise that resolves to true if functions are available
     */
    checkRequiredFunctions(retryCount = 0, maxRetries = 5) {
        return new Promise((resolve) => {
            // Check if the required functions are available in the global scope
            const hasRequiredFunctions = (
                typeof window.createBlock === 'function' || 
                typeof window.createCustomBlock === 'function'
            );
            
            console.log(`Checking required functions (attempt ${retryCount + 1}/${maxRetries}):`, 
                hasRequiredFunctions ? 'Available' : 'Not available yet');
            
            if (hasRequiredFunctions) {
                console.log('Required functions found');
                return resolve(true);
            }
            
            // If we've exceeded the maximum retries, resolve with false
            if (retryCount >= maxRetries) {
                console.warn(`Required functions not found after ${maxRetries} attempts. Will use manual block creation.`);
                return resolve(false);
            }
            
            // Try again after a short delay
            setTimeout(() => {
                this.checkRequiredFunctions(retryCount + 1, maxRetries)
                    .then(resolve)
                    .catch(() => resolve(false));
            }, 500);
        });
    }

    setupEventListeners() {
        // Save template button in sidebar
        const saveTemplateBtnSidebar = document.getElementById('save-template-btn');
        if (saveTemplateBtnSidebar) {
            saveTemplateBtnSidebar.addEventListener('click', () => this.saveTemplateModal());
        }

        // Load template button in sidebar
        const loadTemplateBtnSidebar = document.getElementById('load-template-btn');
        if (loadTemplateBtnSidebar) {
            loadTemplateBtnSidebar.addEventListener('click', () => this.showLoadTemplateModal());
        }
        
        // Canvas buttons
        const saveTemplateBtn = document.getElementById('save-template');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', () => this.saveTemplateModal());
        }
        
        const loadTemplateBtn = document.getElementById('load-template');
        if (loadTemplateBtn) {
            loadTemplateBtn.addEventListener('click', () => this.showLoadTemplateModal());
        }
        
        // Event delegation for dynamically created elements
        document.addEventListener('click', (e) => {
            // Template item click
            if (e.target.closest('.template-item')) {
                const templateItem = e.target.closest('.template-item');
                const templateId = templateItem.dataset.id;
                this.loadTemplate(templateId);
            }
            
            // Load template button click
            if (e.target.closest('.load-template-btn')) {
                const button = e.target.closest('.load-template-btn');
                const templateId = button.dataset.id;
                this.loadTemplate(templateId);
                e.stopPropagation(); // Prevent template item click
            }
            
            // Close modal buttons
            if (e.target.matches('.close-modal') || e.target.closest('.close-modal')) {
                const modal = e.target.closest('.modal');
                if (modal) {
                    this.closeModal(modal);
                }
            }
            
            // Confirm save template button
            if (e.target.id === 'confirm-save-template') {
                this.saveTemplate();
            }
        });
        
        // File upload handling
        document.addEventListener('change', (e) => {
            if (e.target.id === 'template-file-input' && e.target.files.length > 0) {
                this.handleTemplateFileUpload(e.target.files[0]);
            }
        });
        
        console.log('Template handler event listeners set up');
    }
    
    /**
     * Internal function to show progress modal
     */
    showProgress(show = true, title = 'Processing...', status = 'Initializing...') {
        const progressModal = document.getElementById('progress-modal');
        if (!progressModal) return;
        
        if (show) {
            document.getElementById('progress-title').textContent = title;
            document.getElementById('progress-status').textContent = status;
            document.querySelector('.progress-fill').style.width = '0%';
            progressModal.style.display = 'flex';
        } else {
            setTimeout(() => {
                progressModal.style.display = 'none';
            }, 500);
        }
    }
    
    /**
     * Internal function to update progress modal
     */
    updateProgress(percent, status) {
        document.querySelector('.progress-fill').style.width = `${percent}%`;
        document.getElementById('progress-status').textContent = status;
    }
    
    /**
     * Gathers the current state of the pipeline and opens a modal to save it
     */
    saveTemplateModal() {
        try {
            // Check if there are any blocks to save
            const blocks = document.querySelectorAll('.block');
            if (blocks.length === 0) {
                this.showToast('No blocks to save. Create a pipeline first.', 'warning');
                return;
            }
            
            // Open save template modal
            const modal = document.getElementById('save-template-modal');
            if (!modal) {
                this.createSaveTemplateModal();
            } else {
                modal.style.display = 'flex';
            }
            
            // Focus the template name input
            setTimeout(() => {
                document.getElementById('template-name-input')?.focus();
            }, 100);
        } catch (error) {
            console.error('Error opening save template modal:', error);
            this.showToast('Error preparing template save', 'error');
        }
    }
    
    /**
     * Show a toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            
            setTimeout(() => {
                toast.classList.add('fade-out');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, duration);
        } else {
            console.log('Toast message:', type, message);
        }
    }
    
    /**
     * Creates the save template modal if it doesn't exist
     */
    createSaveTemplateModal() {
        // Remove any existing modal first
        const existingModal = document.getElementById('save-template-modal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modalHtml = `
            <div id="save-template-modal" class="modal">
                <div class="modal-content template-modal">
                    <div class="modal-header">
                        <h3>Save Pipeline Template</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="template-name-input">Template Name</label>
                            <input type="text" id="template-name-input" class="form-control" placeholder="My Pipeline Template" value="My Pipeline Template">
                        </div>
                        <div class="form-description">
                            <p>This will save your entire pipeline including all blocks, connections, positions, and configurations.</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="secondary-btn close-modal">Cancel</button>
                        <button id="confirm-save-template" class="primary-btn">Save Template</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to the DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show the modal
        const modal = document.getElementById('save-template-modal');
        if (modal) {
            modal.style.display = 'flex';
        } else {
            console.error('Failed to create save template modal');
        }
    }
    
    /**
     * Creates the load template modal if it doesn't exist
     */
    createLoadTemplateModal() {
        const modalHtml = `
            <div id="load-template-modal" class="modal">
                <div class="modal-content template-modal">
                    <div class="modal-header">
                        <h3>Load Pipeline Template</h3>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="upload-section">
                            <p>Upload a template file:</p>
                            <label for="template-file-input" class="file-upload-btn">
                                <span>Select Template File</span>
                                <input type="file" id="template-file-input" accept=".json">
                            </label>
                        </div>
                        <div class="saved-templates-section">
                            <h4>Saved Templates</h4>
                            <div id="saved-templates-list" class="saved-templates-list">
                                <p class="no-templates">No saved templates found</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add modal to the DOM
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show the modal
        document.getElementById('load-template-modal').style.display = 'flex';
        
        // Load and display saved templates
        this.displaySavedTemplates();
    }
    
    /**
     * Shows the load template modal
     */
    showLoadTemplateModal() {
        const modal = document.getElementById('load-template-modal');
        if (!modal) {
            this.createLoadTemplateModal();
        } else {
            // Refresh the templates list before showing
            this.displaySavedTemplates();
            modal.style.display = 'flex';
        }
    }
    
    /**
     * Closes a modal
     * @param {HTMLElement} modal - The modal element to close
     */
    closeModal(modal) {
        // Check if modal exists
        if (!modal) {
            console.warn('Attempted to close a non-existent modal');
            return;
        }
        
        modal.style.display = 'none';
        
        // Reset file input if it exists
        const fileInput = modal.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.value = '';
        }
    }
    
    /**
     * Saves the current state of the canvas as a template
     */
    async saveTemplate() {
        try {
            // Get template name
            const templateNameInput = document.getElementById('template-name-input');
            if (!templateNameInput) {
                throw new Error('Template name input not found');
            }
            
            let templateName = templateNameInput.value.trim();
            if (!templateName) {
                templateName = 'My Pipeline ' + new Date().toLocaleDateString();
            }
            
            // Show progress
            this.showProgress(true, 'Saving template...', 'Gathering block data');
            
            // Get all blocks
            const blockElements = document.querySelectorAll('.block');
            if (blockElements.length === 0) {
                throw new Error('No blocks found on the canvas');
            }
            
            // Create blocks data structure
            const blocks = {};
            
            // Get custom blocks data from session and local storage
            const customBlocksSession = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
            const customBlocksLocal = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            
            blockElements.forEach(blockEl => {
                const blockId = blockEl.id;
                const blockType = blockEl.dataset.type || blockEl.getAttribute('data-block-type') || 'unknown';
                const position = {
                    x: parseInt(blockEl.style.left, 10) || 0,
                    y: parseInt(blockEl.style.top, 10) || 0
                };
                
                // Get input and output nodes
                const inputNodes = Array.from(blockEl.querySelectorAll('.input-node')).map(
                    node => node.getAttribute('data-input')
                );
                
                const outputNodes = Array.from(blockEl.querySelectorAll('.output-node')).map(
                    node => node.getAttribute('data-output')
                );
                
                // Check if this is a custom block
                const isCustom = blockEl.classList.contains('custom-block');
                const className = blockEl.getAttribute('data-class-name');
                
                // Get configuration data for custom blocks
                let blockConfig = {
                    moduleInfo: null,
                    methods: [],
                    selectedMethod: null,
                    parameters: {}
                };
                
                if (isCustom && className) {
                    // First try to find block-specific data by ID
                    let blockData = customBlocksSession.find(b => b.id === blockId);
                    
                    // If not found, try by className
                    if (!blockData) {
                        blockData = customBlocksSession.find(b => b.className === className);
                    }
                    
                    // If still not found, check localStorage
                    if (!blockData) {
                        blockData = customBlocksLocal.find(b => b.className === className);
                    }
                    
                    if (blockData) {
                        // Get module info
                        blockConfig.moduleInfo = blockData.moduleInfo || this.findModuleInfoForClass(className);
                        
                        // Get methods
                        blockConfig.methods = blockData.methods || [];
                        
                        // Get selected method
                        const methodSelect = blockEl.querySelector('.method-select');
                        if (methodSelect) {
                            blockConfig.selectedMethod = methodSelect.value;
                        }
                        
                        // Get parameters
                        const paramElements = blockEl.querySelectorAll('.parameter-row');
                        paramElements.forEach(paramEl => {
                            const paramName = paramEl.getAttribute('data-param-name');
                            const inputEl = paramEl.querySelector('input, select, textarea');
                            if (paramName && inputEl) {
                                blockConfig.parameters[paramName] = inputEl.value;
                            }
                        });
                    }
                }
                
                blocks[blockId] = {
                    id: blockId,
                    type: blockType,
                    position: position,
                    custom: isCustom,
                    className: className,
                    inputs: inputNodes,
                    outputs: outputNodes,
                    data: {},
                    config: blockConfig
                };
            });
            
            this.updateProgress(50, 'Gathering connection data');
            
            // Get all connections from the DOM or global state
            let connections = [];
            
            // Try to get connections from global state if available
            if (window.getConnections && typeof window.getConnections === 'function') {
                const globalConnections = window.getConnections();
                if (Array.isArray(globalConnections)) {
                    connections = globalConnections.map(conn => {
                        return {
                            id: conn.id || 'conn_' + Math.random().toString(36).substr(2, 9),
                            source: {
                                blockId: conn.source.id || conn.sourceId,
                                outputIndex: parseInt(conn.sourceOutput || conn.source.outputIndex || 0, 10)
                            },
                            target: {
                                blockId: conn.target.id || conn.targetId,
                                inputIndex: parseInt(conn.targetInput || conn.target.inputIndex || 0, 10)
                            }
                        };
                    });
                }
            } else {
                // Fallback to getting connections from the DOM
                const svgConnections = document.querySelectorAll('#connections path');
                svgConnections.forEach(path => {
                    if (path.dataset.sourceId && path.dataset.targetId) {
                        connections.push({
                            id: path.id || 'conn_' + Math.random().toString(36).substr(2, 9),
                            source: {
                                blockId: path.dataset.sourceId,
                                outputIndex: parseInt(path.dataset.sourceOutput || 0, 10)
                            },
                            target: {
                                blockId: path.dataset.targetId,
                                inputIndex: parseInt(path.dataset.targetInput || 0, 10)
                            }
                        });
                    }
                });
            }
            
            this.updateProgress(80, 'Creating template');
            
            // Create template object
            const template = {
                id: 'template_' + Date.now(),
                name: templateName,
                created_at: new Date().toISOString(),
                blocks: blocks,
                connections: connections
            };
            
            this.updateProgress(90, 'Saving template');
            
            // Save template to localStorage
            this.saveTemplateToStorage(template);
            
            // Close the modal
            const modal = document.getElementById('save-template-modal');
            if (modal) {
                this.closeModal(modal);
            }
            
            this.updateProgress(95, 'Downloading template file');
            
            // Download template file
            const saveAsFile = document.getElementById('save-as-file-checkbox')?.checked || false;
            if (saveAsFile) {
                this.downloadTemplateFile(template, templateName);
            }
            
            this.updateProgress(100, 'Template saved successfully');
            this.showProgress(false);
            
            // Show success toast
            this.showToast('Template saved successfully', 'success');
            
            // Update saved templates display
            this.displaySavedTemplates();
            
            return template;
        } catch (error) {
            console.error('Error saving template:', error);
            this.showProgress(false);
            this.showToast('Error saving template: ' + error.message, 'error');
            return null;
        }
    }
    
    /**
     * Downloads the template as a JSON file
     * @param {Object} template - The template data
     * @param {string} name - The template name
     */
    downloadTemplateFile(template, name) {
        // Create a sanitized filename
        const filename = name.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_template.json';
        
        // Convert to JSON string
        const templateStr = JSON.stringify(template, null, 2);
        
        // Create a blob and download link
        const blob = new Blob([templateStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
    
    /**
     * Saves the template to localStorage
     * @param {Object} template - The template data
     */
    saveTemplateToStorage(template) {
        try {
            // Ensure template has required structure
            if (!template.blocks) template.blocks = {};
            if (!template.connections) template.connections = [];
            if (!template.name) template.name = 'Untitled Template';
            
            // Get existing templates
            const templates = JSON.parse(localStorage.getItem('pipeline_templates') || '[]');
            
            // Generate a unique ID if not present
            if (!template.id) {
                template.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            }
            
            // Add creation timestamp if not present
            if (!template.created_at) {
                template.created_at = new Date().toISOString();
            }
            
            // Add new template (or replace if same name exists)
            const existingIndex = templates.findIndex(t => t.name === template.name);
            if (existingIndex >= 0) {
                templates[existingIndex] = template;
            } else {
                templates.push(template);
            }
            
            // Save back to localStorage (max last 10 templates)
            localStorage.setItem('pipeline_templates', JSON.stringify(templates.slice(-10)));
        } catch (error) {
            console.error('Error saving template to storage:', error);
        }
    }
    
    /**
     * Loads saved templates from localStorage
     */
    loadSavedTemplates() {
        try {
            return JSON.parse(localStorage.getItem('pipeline_templates') || '[]');
        } catch (error) {
            console.error('Error loading saved templates:', error);
            return [];
        }
    }
    
    /**
     * Displays saved templates in the load template modal
     */
    displaySavedTemplates() {
        const templates = this.loadSavedTemplates();
        const templatesList = document.getElementById('saved-templates-list');
        
        if (!templatesList) return;
        
        if (templates.length === 0) {
            templatesList.innerHTML = '<p class="no-templates">No saved templates found</p>';
            return;
        }
        
        // Sort templates by creation date (newest first)
        templates.sort((a, b) => {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
        
        // Generate HTML for each template
        let templatesHtml = '';
        templates.forEach(template => {
            const date = template.created_at 
                ? new Date(template.created_at).toLocaleDateString() 
                : 'Unknown date';
                
            templatesHtml += `
                <div class="template-item" data-id="${template.id}">
                    <div class="template-info">
                        <h4>${this.escapeHtml(template.name)}</h4>
                        <p class="template-date">${date}</p>
                        <p class="template-blocks">${Object.keys(template.blocks || {}).length} block(s)</p>
                    </div>
                    <div class="template-actions">
                        <button class="load-template-btn" data-id="${template.id}">Load</button>
                    </div>
                </div>
            `;
        });
        
        templatesList.innerHTML = templatesHtml;
    }
    
    /**
     * Escape HTML to prevent XSS
     * @param {string} text - The text to escape
     * @returns {string} - The escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Load a template and create blocks and connections
     * @param {string} templateId - ID of the template
     * @param {Object} options - Options for loading the template
     * @returns {Promise<boolean>} - Promise that resolves to true if template was loaded successfully
     */
    loadTemplate(templateId, options = {}) {
        console.log(`Loading template: ${templateId}`, options);
        
        return new Promise(async (resolve, reject) => {
            try {
                // Get the template
                const template = this.getTemplate(templateId);
                if (!template) {
                    this.showToast(`Template "${templateId}" not found`, 'error');
                    return reject(new Error(`Template "${templateId}" not found`));
                }
                
                console.log(`Template "${templateId}" found:`, template);
                
                // Apply the template to the canvas
                const success = await this.applyTemplate(template);
                
                if (success) {
                    resolve(true);
                } else {
                    reject(new Error('Failed to apply template'));
                }
            } catch (error) {
                console.error(`Error loading template "${templateId}":`, error);
                this.showToast(`Error loading template "${templateId}": ${error.message}`, 'error');
                reject(error);
            }
        });
    }
    
    /**
     * Get a template by name or ID
     * @param {string} templateId - ID or name of the template to find
     * @returns {Object|null} - The template object or null if not found
     */
    getTemplate(templateId) {
        // Load all templates from localStorage
        const templates = this.loadSavedTemplates();
        
        if (!templates || !Array.isArray(templates) || templates.length === 0) {
            console.warn('No saved templates found');
            return null;
        }
        
        // Find the template by ID first
        let template = templates.find(t => t.id === templateId);
        
        // If not found by ID, try by name
        if (!template) {
            template = templates.find(t => t.name === templateId);
        }
        
        if (!template) {
            console.warn(`Template "${templateId}" not found`);
            return null;
        }
        
        return template;
    }
    
    /**
     * Handle template file upload
     * @param {File} file - The uploaded template file
     */
    handleTemplateFileUpload(file) {
        try {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    let template;
                    try {
                        template = JSON.parse(e.target.result);
                    } catch (parseError) {
                        console.error('Failed to parse template JSON:', parseError);
                        this.showToast('Invalid JSON format in template file', 'error');
                        return;
                    }
                    
                    // Log template for debugging
                    console.log('Loaded template file:', template);
                    
                    // Basic template structure validation
                    if (!template || typeof template !== 'object') {
                        this.showToast('Invalid template format: Not a valid object', 'error');
                        return;
                    }
                    
                    // Validate blocks object
                    if (!template.blocks || typeof template.blocks !== 'object') {
                        console.error('Template missing blocks object:', template);
                        this.showToast('Invalid template format: Missing blocks data', 'error');
                        return;
                    }
                    
                    // Validate connections array
                    if (!template.connections || !Array.isArray(template.connections)) {
                        console.error('Template missing connections array:', template);
                        this.showToast('Invalid template format: Missing connections data', 'error');
                        return;
                    }
                    
                    // Ensure template has a name
                    if (!template.name) {
                        template.name = file.name.replace('.json', '') || 'Imported Template';
                    }
                    
                    // Check if blocks have valid format
                    let hasValidBlocks = false;
                    for (const [blockId, blockData] of Object.entries(template.blocks)) {
                        if (blockData && blockData.type) {
                            hasValidBlocks = true;
                            break;
                        }
                    }
                    
                    if (!hasValidBlocks) {
                        console.error('Template contains no valid blocks:', template.blocks);
                        this.showToast('Invalid template format: No valid blocks found', 'error');
                        return;
                    }
                    
                    // Confirm if there's an existing pipeline
                    const existingBlocks = document.querySelectorAll('.block');
                    if (existingBlocks.length > 0) {
                        if (!confirm('Loading this template will replace your current pipeline. Continue?')) {
                            return;
                        }
                    }
                    
                    // Process template via API for validation
                    fetch('/api/templates/load', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ template })
                    })
                    .then(response => response.json())
                    .then(result => {
                        if (result.error) {
                            throw new Error(result.error);
                        }
                        
                        // Save to localStorage for future use
                        this.saveTemplateToStorage(template);
                        
                        // Apply the template
                        this.applyTemplate(template);
                        
                        // Store modal reference before applying template (in case DOM changes)
                        const modal = document.getElementById('load-template-modal');
                        
                        // Close the modal safely
                        if (modal) {
                            setTimeout(() => this.closeModal(modal), 100);
                        }
                        
                        this.showToast('Template loaded successfully', 'success');
                    })
                    .catch(err => {
                        console.error('Error validating template:', err);
                        this.showToast('Error validating template: ' + err.message, 'error');
                    });
                    
                } catch (error) {
                    console.error('Error processing template file:', error);
                    this.showToast('Error processing template file: ' + error.message, 'error');
                }
            };
            
            reader.onerror = () => {
                this.showToast('Error reading template file', 'error');
            };
            
            reader.readAsText(file);
            
        } catch (error) {
            console.error('Error handling template file upload:', error);
            this.showToast('Error handling template file upload', 'error');
        }
    }
    
    /**
     * Applies a template to the canvas
     * @param {Object|string} templateData - The template object or template ID to apply
     */
    async applyTemplate(templateData) {
        try {
            this.showProgress(true, 'Loading template...', 'Preparing template data');
            
            // If templateData is a string, assume it's a template ID and try to load it
            let template = templateData;
            if (typeof templateData === 'string') {
                template = this.getTemplate(templateData);
                if (!template) {
                    throw new Error(`Template "${templateData}" not found`);
                }
            }
            
            // Validate template
            if (!template || !template.blocks || !template.connections) {
                throw new Error('Invalid template format');
            }
            
            console.log('Applying template:', template);
            
            // Clear existing pipeline
            this.clearCanvas();
            
            this.updateProgress(30, 'Creating blocks');
            
            // Create all blocks first
            const blocks = template.blocks || {};
            
            // Check if we have any blocks to create
            if (Object.keys(blocks).length === 0) {
                throw new Error('Template contains no blocks');
            }
            
            try {
                // Create all blocks first (in parallel)
                const blockPromises = Object.entries(blocks).map(async ([blockId, blockData]) => {
                    try {
                        // Make sure the ID is properly set in the block data
                        blockData.id = blockId;
                        await this.createBlockFromTemplate(blockData);
                        return blockId;
                    } catch (error) {
                        console.error(`Failed to create block ${blockId}:`, error);
                        return null;
                    }
                });
                
                const createdBlocks = await Promise.all(blockPromises);
                const successfulBlocks = createdBlocks.filter(id => id !== null);
                
                console.log(`Successfully created ${successfulBlocks.length} of ${Object.keys(blocks).length} blocks`);
                
                if (successfulBlocks.length === 0) {
                    throw new Error('Failed to create any blocks from template');
                }
                
                this.updateProgress(70, 'Creating connections');
                
                // Give DOM time to update and process the block elements
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Then create connections
                const connections = template.connections || [];
                let successfulConnections = 0;
                
                // Create connections sequentially to ensure proper order
                for (const connectionData of connections) {
                    try {
                        await this.createConnectionFromTemplate(connectionData);
                        successfulConnections++;
                    } catch (error) {
                        console.error('Failed to create connection:', connectionData, error);
                    }
                }
                
                console.log(`Created ${successfulConnections} of ${connections.length} connections`);
                
                this.updateProgress(90, 'Finalizing');
                
                // Update connections visualization
                if (window.updateConnections) {
                    window.updateConnections();
                }
                
                // Update mini-map if exists
                if (window.updateMiniMap) {
                    window.updateMiniMap();
                }
                
                // Fit all blocks to view
                setTimeout(() => {
                    if (window.fitBlocksToView) {
                        window.fitBlocksToView();
                    }
                }, 500);
                
                this.updateProgress(100, 'Template loaded successfully');
                this.showProgress(false);
                
                this.showToast('Pipeline template loaded successfully', 'success');
                return true;
            } catch (error) {
                console.error('Error processing blocks:', error);
                throw error;
            }
        } catch (error) {
            console.error('Error applying template:', error);
            this.showProgress(false);
            this.showToast('Error applying template: ' + error.message, 'error');
            return false;
        }
    }
    
    /**
     * Clears the canvas of all blocks and connections
     */
    clearCanvas() {
        // Remove all blocks
        const blocks = document.querySelectorAll('.block');
        blocks.forEach(block => {
            if (window.deleteBlock) {
                window.deleteBlock(block);
            } else {
                block.remove();
            }
        });
        
        // Clear all connections
        const connections = document.getElementById('connections');
        if (connections) {
            connections.innerHTML = '';
        }
    }
    
    /**
     * Create a block from template data
     * @param {Object} blockData - Block data from template
     * @returns {Object} - Created block
     */
    createBlockFromTemplate(blockData) {
        console.log("Creating block from template:", blockData);
        
        try {
            // Ensure ID is set
            if (!blockData.id) {
                blockData.id = "block_" + Math.random().toString(36).substr(2, 9);
            }
            
            // Ensure position is valid
            if (!blockData.position) {
                blockData.position = { x: 100, y: 100 };
            }
            
            // Handle custom blocks specifically
            if (blockData.custom && blockData.className) {
                console.log("Creating custom block:", blockData.className);
                
                // First, ensure any required module info is available in storage
                if (blockData.config && blockData.config.moduleInfo) {
                    // Check if the moduleInfo has the required structure
                    const moduleInfo = blockData.config.moduleInfo;
                    if (moduleInfo.library && moduleInfo.module) {
                        // Save the module info for this class
                        this.saveModuleInfo(blockData.className, moduleInfo.library, moduleInfo.module, blockData.id);
                        console.log(`Saved module info for ${blockData.className}: ${moduleInfo.library}.${moduleInfo.module}`);
                    }
                }
                
                // Save methods configuration for the block
                if (blockData.config && blockData.config.methods && blockData.config.methods.length > 0) {
                    this.saveMethods(blockData.className, blockData.config.methods, blockData.id);
                    console.log(`Saved ${blockData.config.methods.length} methods for ${blockData.className}`);
                }
                
                // Create the custom block
                let block;
                
                // Try to use global createCustomBlock function if available
                const createCustomBlockFn = typeof window.createCustomBlock === 'function' ? 
                    window.createCustomBlock : (typeof createCustomBlock === 'function' ? createCustomBlock : null);
                
                if (createCustomBlockFn) {
                    // Use the custom block creation function
                    console.log(`Using createCustomBlock function for ${blockData.className}`);
                    
                    // Add the block with the correct id
                    block = createCustomBlockFn(
                        blockData.className, 
                        blockData.inputs || [],
                        blockData.outputs || [],
                        blockData.id
                    );
                    
                    // Set position
                    if (block && block.style) {
                        block.style.left = `${blockData.position.x}px`;
                        block.style.top = `${blockData.position.y}px`;
                    }
                    
                    // Add to canvas if not already added
                    if (block && block.parentElement === null) {
                        const canvasContainer = document.querySelector('.canvas-container');
                        if (canvasContainer) {
                            canvasContainer.appendChild(block);
                        }
                    }
                    
                    console.log(`Custom block created: ${blockData.id}`);
                } else {
                    // Manual creation as last resort
                    console.log("No custom block creation function found, using manual creation");
                    return this.createBlockManually(blockData);
                }
                
                // Apply saved configuration
                if (block && blockData.config) {
                    const methodSelect = block.querySelector('.method-select');
                    
                    // Set the selected method if available
                    if (methodSelect && blockData.config.selectedMethod) {
                        // Add a small delay to let the methods populate
                        setTimeout(() => {
                            methodSelect.value = blockData.config.selectedMethod;
                            
                            // Trigger change event to update parameters
                            const event = new Event('change');
                            methodSelect.dispatchEvent(event);
                            
                            console.log(`Selected method ${blockData.config.selectedMethod} for ${blockData.className}`);
                            
                            // After method selection, apply parameter values
                            setTimeout(() => {
                                if (blockData.config.parameters) {
                                    // Find all parameter inputs and set their values
                                    Object.entries(blockData.config.parameters).forEach(([paramName, value]) => {
                                        const paramRow = block.querySelector(`.parameter-row[data-param-name="${paramName}"]`);
                                        if (paramRow) {
                                            const input = paramRow.querySelector('input, select, textarea');
                                            if (input) {
                                                input.value = value;
                                                
                                                // Save the parameter value
                                                this.saveParameterValue(blockData.id, paramName, value);
                                                
                                                console.log(`Set parameter ${paramName} = ${value} for ${blockData.className}`);
                                            }
                                        }
                                    });
                                }
                            }, 500);
                        }, 500);
                    }
                }
                
                return block;
            }
            
            // For regular blocks, use the standard approach
            if (typeof window.createBlock === 'function' && !blockData.custom) {
                console.log("Using global createBlock function");
                const block = window.createBlock(blockData.type, blockData.position.x, blockData.position.y);
                
                // Set ID if possible
                if (block && typeof block.id !== 'undefined') {
                    const blockElement = document.getElementById(block.id);
                    if (blockElement) {
                        blockElement.id = blockData.id;
                    }
                    block.id = blockData.id;
                }
                
                return block;
            } else {
                // Manual block creation for regular blocks
                console.log("Creating block manually");
                return this.createBlockManually(blockData);
            }
        } catch (error) {
            console.error("Error in createBlockFromTemplate:", error);
            // Fallback to manual creation
            return this.createBlockManually(blockData);
        }
    }

    /**
     * Create a connection from template data
     * @param {Object} connectionData - Connection data from template
     * @returns {Object} - Created connection
     */
    createConnectionFromTemplate(connectionData) {
        console.log("Creating connection from template:", connectionData);
        
        // Get source and target blocks by ID from the DOM
        const sourceBlock = document.getElementById(connectionData.source.blockId);
        const targetBlock = document.getElementById(connectionData.target.blockId);
        
        if (!sourceBlock || !targetBlock) {
            console.error("Cannot create connection: blocks not found", {
                sourceId: connectionData.source.blockId,
                targetId: connectionData.target.blockId,
                sourceFound: !!sourceBlock,
                targetFound: !!targetBlock
            });
            return null;
        }
        
        try {
            // Try to use global createConnection function if available
            if (typeof window.createConnection === 'function') {
                console.log("Using global createConnection function");
                return window.createConnection(
                    sourceBlock, 
                    targetBlock, 
                    connectionData.source.outputIndex, 
                    connectionData.target.inputIndex
                );
            } else {
                // Manual connection creation as fallback
                return this.createConnectionManually(connectionData);
            }
        } catch (error) {
            console.error("Error in createConnectionFromTemplate:", error);
            // Fallback to manual creation
            return this.createConnectionManually(connectionData);
        }
    }

    /**
     * Find module information for a given class
     * @param {string} className - Name of the class
     * @returns {Object|null} - Module information or null if not found
     */
    findModuleInfoForClass(className) {
        try {
            // Try to find in sessionStorage first
            const customBlocksSession = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
            const blockDataSession = customBlocksSession.find(b => b.className === className);
            
            if (blockDataSession && blockDataSession.moduleInfo) {
                return blockDataSession.moduleInfo;
            }
            
            // If not found in session, try localStorage
            const customBlocksLocal = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            const blockDataLocal = customBlocksLocal.find(b => b.className === className);
            
            if (blockDataLocal && blockDataLocal.moduleInfo) {
                return blockDataLocal.moduleInfo;
            }
            
            // Not found
            return null;
        } catch (e) {
            console.error(`Error finding module info for ${className}:`, e);
            return null;
        }
    }
    
    /**
     * Save module information for a class
     * @param {string} className - Name of the class
     * @param {string} library - Library name
     * @param {string} module - Module name
     * @param {string} blockId - ID of the block (optional)
     */
    saveModuleInfo(className, library, module, blockId = null) {
        try {
            const moduleInfo = { library, module };
            
            // Save to sessionStorage first
            const customBlocksSession = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
            
            // If blockId is provided, try to find that specific block
            if (blockId) {
                const blockIndex = customBlocksSession.findIndex(b => b.id === blockId);
                if (blockIndex >= 0) {
                    customBlocksSession[blockIndex].moduleInfo = moduleInfo;
                    sessionStorage.setItem('customBlocks', JSON.stringify(customBlocksSession));
                    return;
                }
            }
            
            // If not found by ID or no ID provided, find by className
            const blockIndex = customBlocksSession.findIndex(b => b.className === className);
            if (blockIndex >= 0) {
                customBlocksSession[blockIndex].moduleInfo = moduleInfo;
            } else {
                customBlocksSession.push({
                    id: blockId || `block_${Date.now()}`,
                    className: className,
                    moduleInfo: moduleInfo
                });
            }
            
            sessionStorage.setItem('customBlocks', JSON.stringify(customBlocksSession));
            
            // Also save to localStorage for persistence
            const customBlocksLocal = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            const localBlockIndex = customBlocksLocal.findIndex(b => b.className === className);
            
            if (localBlockIndex >= 0) {
                customBlocksLocal[localBlockIndex].moduleInfo = moduleInfo;
            } else {
                customBlocksLocal.push({
                    className: className,
                    moduleInfo: moduleInfo
                });
            }
            
            localStorage.setItem('customBlocks', JSON.stringify(customBlocksLocal));
        } catch (e) {
            console.warn('Failed to save module info to storage:', e);
        }
    }
    
    /**
     * Save methods for a class
     * @param {string} className - Name of the class
     * @param {Array} methods - Array of method names
     * @param {string} blockId - ID of the block (optional)
     */
    saveMethods(className, methods, blockId = null) {
        try {
            // Save to sessionStorage first
            const customBlocksSession = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
            
            // If blockId is provided, try to find that specific block
            if (blockId) {
                const blockIndex = customBlocksSession.findIndex(b => b.id === blockId);
                if (blockIndex >= 0) {
                    customBlocksSession[blockIndex].methods = methods;
                    sessionStorage.setItem('customBlocks', JSON.stringify(customBlocksSession));
                    return;
                }
            }
            
            // If not found by ID or no ID provided, find by className
            const blockIndex = customBlocksSession.findIndex(b => b.className === className);
            if (blockIndex >= 0) {
                customBlocksSession[blockIndex].methods = methods;
            } else {
                customBlocksSession.push({
                    id: blockId || `block_${Date.now()}`,
                    className: className,
                    methods: methods
                });
            }
            
            sessionStorage.setItem('customBlocks', JSON.stringify(customBlocksSession));
            
            // Also save to localStorage for persistence
            const customBlocksLocal = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            const localBlockIndex = customBlocksLocal.findIndex(b => b.className === className);
            
            if (localBlockIndex >= 0) {
                customBlocksLocal[localBlockIndex].methods = methods;
            } else {
                customBlocksLocal.push({
                    className: className,
                    methods: methods
                });
            }
            
            localStorage.setItem('customBlocks', JSON.stringify(customBlocksLocal));
        } catch (e) {
            console.warn('Failed to save methods to storage:', e);
        }
    }
    
    /**
     * Save parameter value for a block
     * @param {string} blockId - ID of the block
     * @param {string} paramName - Name of the parameter
     * @param {string} value - Value of the parameter
     */
    saveParameterValue(blockId, paramName, value) {
        try {
            if (!blockId || !paramName) return;
            
            // Save to sessionStorage first
            const customBlocksSession = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
            const blockIndex = customBlocksSession.findIndex(b => b.id === blockId);
            
            if (blockIndex >= 0) {
                customBlocksSession[blockIndex].parameters = customBlocksSession[blockIndex].parameters || {};
                customBlocksSession[blockIndex].parameters[paramName] = value;
                sessionStorage.setItem('customBlocks', JSON.stringify(customBlocksSession));
            }
        } catch (e) {
            console.warn('Failed to save parameter value to storage:', e);
        }
    }

    /**
     * Create a connection manually when global functions are not available
     * @param {Object} connectionData - Connection data from template
     * @returns {Object} - Created connection object
     */
    createConnectionManually(connectionData) {
        console.log("Creating connection manually:", connectionData);
        
        // Create a basic connection structure
        const connection = {
            id: connectionData.id || "connection_" + Math.random().toString(36).substr(2, 9),
            source: connectionData.source,
            target: connectionData.target,
            data: connectionData.data || {}
        };
        
        // Add to DOM if needed
        const flowContainer = document.querySelector('.canvas-container');
        if (flowContainer) {
            // Find source and target elements
            const sourceBlock = document.getElementById(connection.source.blockId);
            const targetBlock = document.getElementById(connection.target.blockId);
            
            if (sourceBlock && targetBlock) {
                // Create the connection element
                const connectionElement = document.createElement('div');
                connectionElement.id = connection.id;
                connectionElement.className = 'connection';
                connectionElement.style.position = 'absolute';
                connectionElement.style.pointerEvents = 'none';
                connectionElement.style.zIndex = '5';
                
                // Create the SVG element for the connection line
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.style.position = 'absolute';
                svg.style.width = '100%';
                svg.style.height = '100%';
                svg.style.top = '0';
                svg.style.left = '0';
                svg.style.overflow = 'visible';
                
                // Create the path for the connection
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute('stroke', '#5d9cec');
                path.setAttribute('stroke-width', '2');
                path.setAttribute('fill', 'none');
                svg.appendChild(path);
                
                connectionElement.appendChild(svg);
                flowContainer.appendChild(connectionElement);
                
                // Function to update the connection position
                const updateConnection = () => {
                    // Find the source connector
                    const sourceConnectorType = '.output-node';
                    const sourceOutputIndex = connection.source.outputIndex || 0;
                    const sourceConnectors = sourceBlock.querySelectorAll(sourceConnectorType);
                    const sourceConnector = sourceConnectors[sourceOutputIndex] || sourceConnectors[0];
                    
                    // Find the target connector
                    const targetConnectorType = '.input-node';
                    const targetInputIndex = connection.target.inputIndex || 0;
                    const targetConnectors = targetBlock.querySelectorAll(targetConnectorType);
                    const targetConnector = targetConnectors[targetInputIndex] || targetConnectors[0];
                    
                    if (sourceConnector && targetConnector) {
                        // Get source and target positions
                        const sourceRect = sourceConnector.getBoundingClientRect();
                        const targetRect = targetConnector.getBoundingClientRect();
                        const containerRect = flowContainer.getBoundingClientRect();
                        
                        // Calculate positions relative to flow container
                        const sourceX = sourceRect.left + sourceRect.width/2 - containerRect.left + flowContainer.scrollLeft;
                        const sourceY = sourceRect.top + sourceRect.height/2 - containerRect.top + flowContainer.scrollTop;
                        const targetX = targetRect.left + targetRect.width/2 - containerRect.left + flowContainer.scrollLeft;
                        const targetY = targetRect.top + targetRect.height/2 - containerRect.top + flowContainer.scrollTop;
                        
                        // Create a bezier curve path
                        const dx = Math.abs(targetX - sourceX) * 0.5;
                        const path_d = `M ${sourceX} ${sourceY} C ${sourceX + dx} ${sourceY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`;
                        path.setAttribute('d', path_d);
                        
                        // Set connection element size to cover the entire flow container
                        connectionElement.style.width = `${flowContainer.scrollWidth}px`;
                        connectionElement.style.height = `${flowContainer.scrollHeight}px`;
                    }
                };
                
                // Update the connection initially
                updateConnection();
                
                // Update when window is resized
                window.addEventListener('resize', updateConnection);
                
                // Store the update function with the connection
                connection.updatePosition = updateConnection;
            }
        }
        
        // Store reference to the connection
        this.createdConnections = this.createdConnections || [];
        this.createdConnections.push(connection);
        
        return connection;
    }
}

// Initialize the template handler with a delay to ensure all scripts are loaded
let templateHandlerInstance = null;

// Helper function to get the template handler instance
function getTemplateHandler() {
    if (!templateHandlerInstance) {
        templateHandlerInstance = new TemplateHandler();
    }
    return templateHandlerInstance;
}

// Initialize template handler with a delay
setTimeout(() => {
    window.templateHandler = getTemplateHandler();
    console.log('Template handler initialized and attached to window');
}, 500);

// Also handle DOMContentLoaded event to ensure we initialize after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (!window.templateHandler) {
        window.templateHandler = getTemplateHandler();
        console.log('Template handler initialized on DOMContentLoaded');
    }
}); 