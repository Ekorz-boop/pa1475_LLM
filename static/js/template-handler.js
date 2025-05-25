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
        
        // Make sure we override makeBlockDraggable right away
        this.overrideMakeBlockDraggable();
        
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
            console.log(saveMethods)
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
        const saveTemplateBtn = document.getElementById('saveTemplateBtn');
        if (saveTemplateBtn) {
            saveTemplateBtn.addEventListener('click', () => this.saveTemplateModal());
        }

        // Load template button in sidebar
        const loadTemplateBtn = document.getElementById('loadTemplateBtn');
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
     * Shows the load template modal
     */
    showLoadTemplateModal() {
        // Create a file input element
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);
        
        // Set up change event handler
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleTemplateFileUpload(e.target.files[0]);
            }
            
            // Remove the element after use
            document.body.removeChild(fileInput);
        });
        
        // Trigger the file dialog
        fileInput.click();
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
                
                // Get accurate position from element style
                let position = { x: 0, y: 0 };
                
                // Extract position from transform property
                const transform = blockEl.style.transform;
                if (transform && transform.includes('translate')) {
                    const match = /translate\(\s*([-\d.]+)px\s*,\s*([-\d.]+)px\s*\)/.exec(transform);
                    if (match) {
                        position = {
                            x: parseFloat(match[1]),
                            y: parseFloat(match[2])
                        };
                    }
                } else if (blockEl.style.left && blockEl.style.top) {
                    // Fallback to left/top if transform isn't set
                    position = {
                        x: parseInt(blockEl.style.left, 10) || 0,
                        y: parseInt(blockEl.style.top, 10) || 0
                    };
                }
                
                // If position values are both 0, try to get from DOM rect as a fallback
                if (position.x === 0 && position.y === 0) {
                    const rect = blockEl.getBoundingClientRect();
                    const canvasContainer = document.querySelector('.canvas-container');
                    if (rect && canvasContainer) {
                        const canvasRect = canvasContainer.getBoundingClientRect();
                        // Calculate position relative to canvas container
                        position.x = rect.left - canvasRect.left + canvasContainer.scrollLeft;
                        position.y = rect.top - canvasRect.top + canvasContainer.scrollTop;
                    }
                }
                
                console.log(`Saving position for block ${blockId}: x=${position.x}, y=${position.y}`);
                
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
                        console.log("\nblock data:", blockData)
                        // Get module info
                        blockConfig.moduleInfo = blockData.moduleInfo || this.findModuleInfoForClass(className);
                        console.log("\nblock data moduleinfo", blockData.moduleInfo)
                        
                        // Get methods
                        blockConfig.methods = blockData.methods || [];
                        console.log("\nblock data methods")
                        
                        // Get selected method
                        const methodSelect = blockEl.querySelector('.method-select');
                        if (methodSelect) {
                            blockConfig.selectedMethod = methodSelect.value;
                            console.log("\nselected methods", methodSelect)
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
                
                // Capture late initialization setting
                const lateInitToggle = blockEl.querySelector('.late-init-toggle');
                if (lateInitToggle) {
                    blockConfig.late_initialization = lateInitToggle.checked;
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
            
            // CRITICAL FIX: Use the helper method to get connections
            const connections = this.getConnectionsData();
            console.log(`Found ${connections.length} connections for template`);
            console.log("\nconnections found were:", connections) // maybe format them?
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
            
            // Always download template file
            this.downloadTemplateFile(template, templateName);
            
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
        // Don't save to localStorage to avoid persisting templates
        // The template will still be downloaded as a file
    }
    
    /**
     * Loads saved templates from localStorage
     */
    loadSavedTemplates() {
        try {
            return []; // Return empty array to show no saved templates
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
                        
                        // Apply the template directly (don't save to localStorage)
                        this.applyTemplate(template);
                        
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
            // Clear the current workspace
            this.updateProgress(10, 'Clearing workspace');
            await this.clearWorkspace();
            
            // Parse template blocks and connections
            this.updateProgress(20, 'Parsing template data');
            if (!templateData.blocks) {
                throw new Error('No blocks found in template data');
            }
            
            const blocks = templateData.blocks || {};
            const connections = templateData.connections || [];
            const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]'); 
            const customBlocksLocal = JSON.parse(localStorage.getItem('customBlocks') || '[]');
            
            try {
                // First, add all custom blocks to the sidebar to ensure session storage is properly populated
                this.updateProgress(40, 'Setting up custom blocks');
                const customBlocks = Object.values(blocks).filter(blockData => blockData.custom && blockData.className);
                
                // First register blocks in session storage
                customBlocks.forEach(blockData => {
                    // Save the block data to session storage first
                    this.saveCustomBlockToSessionStorage(blockData);
                });
                
                // Then add to sidebar UI
                customBlocks.forEach(blockData => {
                    // Use the global function if available
                    if (typeof window.addCustomBlockToMenu === 'function') {
                        window.addCustomBlockToMenu(
                            blockData.className, 
                            blockData.id, 
                            blockData.inputs || [], 
                            blockData.outputs || []
                        );
                    } else {
                        this.addToCustomBlocksList(blockData);
                    }
                });
                
                // Create all blocks in the canvas
                this.updateProgress(50, 'Creating blocks in canvas');
                const createdBlocks = {};
                
                for (const blockId in blocks) {
                    const blockData = blocks[blockId];
                    blockData.id = blockId; // Ensure ID is set in block data
                    
                    // Skip any blocks with missing required data
                    if (!blockData.type && !blockData.className) {
                        console.warn(`Skipping block ${blockId} due to missing type or className`);
                        continue;
                    }
                    
                    const block = this.createBlockFromTemplate(blockData);
                    if (block) {
                        createdBlocks[blockId] = block;
                        
                        // Set up custom block if needed
                        if (blockData.custom && typeof window.setupCustomBlock === 'function') {
                            window.setupCustomBlock(block);
                        }
                    }
                }
                
                // Ensure all blocks have their nodes positioned correctly
                this.updateProgress(70, 'Positioning nodes on blocks');
                for (const blockId in createdBlocks) {
                    const block = createdBlocks[blockId];
                    // Make sure the block is fully initialized
                    if (typeof window.updateBlockNodesForMethods === 'function') {
                        // Ensure all method nodes are properly positioned
                        window.updateBlockNodesForMethods(block);
                    }
                }
                
                // Create connections between blocks
                this.updateProgress(80, 'Creating connections');
                if (connections && connections.length > 0) {
                    for (const connectionData of connections) {
                        this.createConnectionFromTemplate(connectionData);
                    }
                    
                    // Update all connections visually
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                }
                
                this.updateProgress(90, 'Loading configuration');
                
                // Show success message
                this.updateProgress(100, 'Template loaded successfully');
                if (typeof window.showToast === 'function') {
                    window.showToast('Template loaded successfully', 'success');
                }
                
                return true;
            } catch (e) {
                console.error('Error applying template:', e);
                this.updateProgress(100, 'Error loading template');
                if (typeof window.showToast === 'function') {
                    window.showToast('Error loading template: ' + e.message, 'error');
                }
                return false;
            }
        } catch (error) {
            console.error('Error applying template:', error);
            this.updateProgress(100, 'Error loading template');
            if (typeof window.showToast === 'function') {
                window.showToast('Error loading template: ' + error.message, 'error');
            }
            return false;
        }
    }
    
    /**
     * Clears the workspace of all blocks and connections
     * @returns {Promise<boolean>} - Promise that resolves to true if workspace was cleared
     */
    clearWorkspace() {
        return new Promise((resolve) => {
            try {
                // Clear the canvas
                this.clearCanvas();
                console.log('Workspace cleared successfully');
                resolve(true);
            } catch (error) {
                console.error('Error clearing workspace:', error);
                resolve(false);
            }
        });
    }
    
    /**
     * Clears the canvas of all blocks and connections
     */
    clearCanvas() {
        // Get references to required elements
        const connectionsContainer = document.getElementById('connections');
        
        // Clear connections container first
        if (connectionsContainer) {
            connectionsContainer.innerHTML = '';
        }
        
        // Also remove any div-based connections that might have been created
        const oldConnectionDivs = document.querySelectorAll('div.connection');
        oldConnectionDivs.forEach(connDiv => {
            connDiv.remove();
        });
        
        // Clear global connections array if available
        if (window.connections && Array.isArray(window.connections)) {
            window.connections.length = 0;
        }
        
        // Remove all blocks
        const blocks = document.querySelectorAll('.block');
        blocks.forEach(block => {
            if (typeof window.deleteBlock === 'function') {
                window.deleteBlock(block);
            } else {
                block.remove();
            }
        });
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
                    
                    // Set position - CRITICAL FIX: use translate instead of left/top to ensure draggability
                    if (block) {
                        console.log(`Setting position for ${blockData.id} to x:${blockData.position.x}, y:${blockData.position.y}`);
                        block.style.transform = `translate(${blockData.position.x}px, ${blockData.position.y}px)`;
                        // Remove any left/top positioning that might interfere with dragging
                        block.style.left = '';
                        block.style.top = '';
                    }
                    
                    // Add to canvas if not already added
                    if (block && block.parentElement === null) {
                        const blockContainer = document.querySelector('.block-container');
                        if (blockContainer) {
                            blockContainer.appendChild(block);
                        } else {
                            const canvasContainer = document.querySelector('.canvas-container');
                            if (canvasContainer) {
                                canvasContainer.appendChild(block);
                            }
                        }
                    }
                    
                    console.log(`Custom block created: ${blockData.id}`);
                } else {
                    // Manual creation as last resort
                    console.log("No custom block creation function found, using manual creation");
                    return this.createBlockManually(blockData);
                }
                
                // CRITICAL FIX: Explicitly initialize the block with ALL parameters immediately
                if (block) {
                    console.log("CRITICAL FIX: Explicitly updating block parameters on creation");
                    
                    // 1. Find the method select element 
                    const methodSelect = block.querySelector('.method-select');
                    
                    // 2. If it exists, select the first method from savedMethods if any
                    if (methodSelect && blockData.config && blockData.config.methods && blockData.config.methods.length > 0) {
                        // Get all the selected methods, should include __init__ and any other methods
                        const selectedMethods = blockData.config.methods;
                        
                        // Make sure to update method rows for multi-method blocks
                        if (typeof window.updateMethodsDisplay === 'function' && selectedMethods.length > 1) {
                            window.updateMethodsDisplay(block, selectedMethods, blockData.id);
                        }
                        
                        // Ensure init is explicitly chosen as first method
                        if (methodSelect.options.length > 0) {
                            // Try to find __init__ option
                            let initOption = null;
                            for (let i = 0; i < methodSelect.options.length; i++) {
                                if (methodSelect.options[i].value === '__init__') {
                                    initOption = methodSelect.options[i];
                                    break;
                                }
                            }
                            
                            // If found, select it
                            if (initOption) {
                                methodSelect.value = '__init__';
                                
                                // Trigger change event to update parameters
                                const event = new Event('change');
                                methodSelect.dispatchEvent(event);
                                
                                console.log("Selected __init__ method and triggered parameter update");
                            }
                        }
                        
                        // Now explicitly call updateBlockParameters for each method with staggered timing 
                        if (typeof window.updateBlockParameters === 'function') {
                            // Start with __init__
                            window.updateBlockParameters(block, '__init__');
                            
                            // Then update each additional method with a small delay
                            selectedMethods.forEach((method, index) => {
                                if (method !== '__init__') {
                                    setTimeout(() => {
                                        window.updateBlockParameters(block, method);
                                        console.log(`Updated parameters for method ${method}`);
                                    }, 300 * (index + 1)); // Stagger by 300ms
                                }
                            });
                        }
                    }
                }
                
                // Apply saved configuration
                if (block && blockData.config) {
                    const methodSelect = block.querySelector('.method-select');
                    
                    // Set the selected method if available
                    if (methodSelect && blockData.config.selectedMethod) {
                        // Store the parameters for later application
                        const parameters = blockData.config.parameters || {};
                        
                        // Wait for methods to be fully loaded before trying to select one
                        const waitForMethodsToLoad = () => {
                            if (methodSelect.options.length <= 1) {
                                // Methods are not yet loaded, wait and try again
                                console.log(`Waiting for methods to load for ${blockData.className}...`);
                                setTimeout(waitForMethodsToLoad, 250);
                                return;
                            }
                            
                            // Now methods are loaded, set the selected method
                            methodSelect.value = blockData.config.selectedMethod;
                            console.log(`Selected method ${blockData.config.selectedMethod} for ${blockData.className}`);
                            
                            // Trigger change event to update parameters
                            const event = new Event('change');
                            methodSelect.dispatchEvent(event);
                            
                            // Wait for parameter rows to be created before setting values
                            const waitForParametersToLoad = () => {
                                // First, get the selected methods for this block
                                let selectedMethods = [];
                                
                                // Add selected method from config
                                if (blockData.config.selectedMethod) {
                                    selectedMethods.push(blockData.config.selectedMethod);
                                }
                                
                                // Add methods from config.selected_methods (multi method blocks)
                                if (blockData.config.selected_methods && Array.isArray(blockData.config.selected_methods)) {
                                    // Add without duplicates
                                    blockData.config.selected_methods.forEach(method => {
                                        if (!selectedMethods.includes(method)) {
                                            selectedMethods.push(method);
                                        }
                                    });
                                }
                                
                                // For multi method blocks, we need to ensure all method rows are created
                                if (selectedMethods.length > 1) {
                                    const methodsContainer = block.querySelector('.block-methods');
                                    if (methodsContainer) {
                                        const existingMethodRows = methodsContainer.querySelectorAll('.method-row');
                                        
                                        // If some method rows are missing, update the display
                                        if (existingMethodRows.length < selectedMethods.length - 1) { // -1 for __init__
                                            console.log(`Adding method rows for multi method block: ${blockData.id}`);
                                            // Filter out __init__ since it's not displayed as a row
                                            const methodsToDisplay = selectedMethods.filter(m => m !== '__init__');
                                            updateMethodsDisplay(block, methodsToDisplay, blockData.id);
                                            
                                            // Wait another cycle to ensure method rows are created
                                            setTimeout(waitForParametersToLoad, 250);
                                            return;
                                        }
                                    }
                                }
                                    
                                // Now check if parameter rows are created
                                const paramRows = block.querySelectorAll('.parameter-row');
                                const paramNames = Object.keys(parameters);
                                
                                // Consider the parameter loading ready if we have some rows or after several attempts
                                if (paramRows.length === 0 && paramNames.length > 0) {
                                    console.log(`Waiting for parameters to load for ${blockData.className}...`);
                                    setTimeout(waitForParametersToLoad, 250);
                                    return;
                                }
                                
                                console.log(`Setting ${paramNames.length} parameters for ${blockData.className}`);
                                
                                // Make sure we load parameters from localStorage (they might be stored there too)
                                let localStorageParams = {};
                                try {
                                    const localParams = JSON.parse(localStorage.getItem(`blockParams-${blockData.id}`) || '{}');
                                    localStorageParams = localParams;
                                } catch (e) {
                                    console.warn('Error loading parameters from localStorage:', e);
                                }
                                
                                // Combine parameters from config and localStorage
                                const allParameters = {...parameters, ...localStorageParams};
                                
                                // Now parameters are loaded, set their values
                                Object.entries(allParameters).forEach(([paramName, value]) => {
                                    const paramRow = block.querySelector(`.parameter-row[data-param-name="${paramName}"]`);
                                    if (paramRow) {
                                        const input = paramRow.querySelector('input, select, textarea');
                                        if (input) {
                                            input.value = value;
                                            
                                            // Save the parameter value
                                            this.saveParameterValue(blockData.id, paramName, value);
                                            
                                            console.log(`Set parameter ${paramName} = ${value} for ${blockData.className}`);
                                        }
                                    } else {
                                        // Parameter row doesn't exist - we may need to add it
                                        // We should update parameters for each method to ensure all parameters are shown
                                        console.log(`Parameter row for ${paramName} not found, may need to add it`);
                                        
                                        // For multi method blocks, we need to ensure parameters are displayed
                                        if (selectedMethods.length > 1) {
                                            const paramsContainer = block.querySelector('.block-parameters');
                                            if (paramsContainer && paramsContainer.querySelector('.active-parameters')) {
                                                const activeParamsContainer = paramsContainer.querySelector('.active-parameters');
                                                const genericParams = [{name: paramName, type: 'Any', required: false}];
                                                
                                                if (typeof addParameterRowForMethod === 'function') {
                                                    // Add parameter row if the function exists
                                                    const newRow = addParameterRowForMethod(activeParamsContainer, paramName, value, genericParams, blockData.id, '__init__');
                                                    console.log(`Added missing parameter row for ${paramName}`);
                                                }
                                            }
                                        }
                                    }
                                });
                                
                                // CRITICAL FIX: Force immediate display of parameters
                                console.log(`CRITICAL: Forcing immediate parameter display for block ${blockData.id}`);
                                
                                // Force immediate parameter updates for all methods
                                if (selectedMethods.length > 0) {
                                    // Start with the first method (usually __init__)
                                    if (typeof updateBlockParameters === 'function') {
                                        // First update for the selected method (immediate)
                                        const firstMethod = selectedMethods[0];
                                        updateBlockParameters(block, firstMethod);
                                        console.log(`Immediately updated parameters for ${firstMethod}`);
                                        
                                        // Then update for each additional method with staggered timing
                                        selectedMethods.slice(1).forEach((method, index) => {
                                            setTimeout(() => {
                                                console.log(`Updating parameters for method ${method} (delayed)`);
                                                updateBlockParameters(block, method);
                                            }, 300 * (index + 1)); // Stagger by 300ms per method
                                        });
                                    }
                                }
                                
                                // Update the block parameters for all methods to ensure everything is properly displayed
                                if (selectedMethods.length > 1) {
                                    // For each method in the multi method block, make sure its parameters are shown
                                    selectedMethods.forEach(method => {
                                        if (method !== '__init__' && typeof updateBlockParameters === 'function') {
                                            console.log(`Updating parameters for method ${method}`);
                                            setTimeout(() => updateBlockParameters(block, method), 300);
                                        }
                                    });
                                }
                            };
                            
                            // Start waiting for parameters
                            setTimeout(waitForParametersToLoad, 250);
                        };
                        
                        // Start waiting for methods
                        waitForMethodsToLoad();
                    }
                }
                
                // Make block draggable in the canvas - CRITICAL FIX: Ensure the drag handler is properly attached
                if (block) {
                    // First make sure we have a consistent transform value (use translate, not left/top)
                    if (!block.style.transform.includes('translate')) {
                        block.style.transform = `translate(${blockData.position.x}px, ${blockData.position.y}px)`;
                    }
                    
                    // Apply draggable functionality
                    if (typeof window.makeBlockDraggable === 'function') {
                        window.makeBlockDraggable(block);
                        console.log(`Made block ${blockData.id} draggable`);
                    } else {
                        // Fallback to manual drag initialization
                        this.makeBlockDraggableManually(block);
                    }
                }
                
                // CRITICAL FIX: Set up node connections with our improved function
                if (block) {
                    this.setupNodeConnections(block);
                    console.log(`Set up node connections for block ${blockData.id}`);
                    
                    // Add enhanced drag event listeners
                    this.addDragEventListeners(block);
                }
                
                return block;
            }
            
            // For regular blocks, use the standard approach
            if (typeof window.createBlock === 'function' && !blockData.custom) {
                console.log("Using global createBlock function");
                // Make sure to pass position to createBlock
                const block = window.createBlock(blockData.type, blockData.position.x, blockData.position.y);
                
                // Set ID if possible
                if (block && typeof block.id !== 'undefined') {
                    const blockElement = document.getElementById(block.id);
                    if (blockElement) {
                        blockElement.id = blockData.id;
                        
                        // Set position correctly using transform
                        if (blockElement.style) {
                            console.log(`Setting position for ${blockData.id} to x:${blockData.position.x}, y:${blockData.position.y}`);
                            blockElement.style.transform = `translate(${blockData.position.x}px, ${blockData.position.y}px)`;
                            // Remove any left/top positioning that might interfere with dragging
                            blockElement.style.left = '';
                            blockElement.style.top = '';
                        }
                        
                        // Make block draggable
                        if (typeof window.makeBlockDraggable === 'function') {
                            window.makeBlockDraggable(blockElement);
                            console.log(`Made block ${blockData.id} draggable`);
                        }
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
        const sourceBlock = document.getElementById(connectionData.source);
        const targetBlock = document.getElementById(connectionData.target);
        
        if (!sourceBlock || !targetBlock) {
            console.error("Cannot create connection: blocks not found", {
                sourceId: connectionData.source,
                targetId: connectionData.target,
                sourceFound: !!sourceBlock,
                targetFound: !!targetBlock
            });
            return null;
        }

        try {
            // IMPORTANT: Ensure nodes are properly positioned before creating connections
            if (typeof window.updateBlockNodesForMethods === 'function') {
                // Update node positions for both source and target blocks
                window.updateBlockNodesForMethods(sourceBlock);
                window.updateBlockNodesForMethods(targetBlock);
            }
            
            // Check if a global createConnection function is available
            if (typeof window.createConnection === 'function') {
                console.log("Using global createConnection function");
                
                // If we have source method information, find the correct source node
                let sourceNode = null;
                
                if (connectionData.sourceNode) {
                    // Source node ID is directly specified
                    sourceNode = sourceBlock.querySelector(`.output-node[data-output="${connectionData.sourceNode}"]`);
                    
                    // If not found, try with a different approach (method_output format)
                    if (!sourceNode && connectionData.sourceMethod) {
                        sourceNode = sourceBlock.querySelector(`.output-node[data-output="${connectionData.sourceMethod}_output"]`);
                    }
                } else if (connectionData.sourceMethod) {
                    // Try to find by method name with _output suffix
                    sourceNode = sourceBlock.querySelector(`.output-node[data-output="${connectionData.sourceMethod}_output"]`);
                }
                
                // Fall back to first output node if needed
                if (!sourceNode) {
                    sourceNode = sourceBlock.querySelector('.output-node');
                }
                
                // Get input node by ID if specified
                let inputNode = null;
                if (connectionData.inputId) {
                    inputNode = targetBlock.querySelector(`.input-node[data-input="${connectionData.inputId}"]`);
                }
                
                // Fall back to first input node if needed
                if (!inputNode) {
                    inputNode = targetBlock.querySelector('.input-node');
                }
                
                if (!sourceNode || !inputNode) {
                    console.error("Could not find nodes for connection", {
                        sourceNodeFound: !!sourceNode,
                        inputNodeFound: !!inputNode,
                        connectionData
                    });
                    return null;
                }
                
                // Create the connection using the global function
                return window.createConnection(sourceBlock, targetBlock, connectionData.inputId, {
                    sourceNode: sourceNode,
                    inputNode: inputNode,
                    sourceMethod: connectionData.sourceMethod,
                    targetMethod: connectionData.targetMethod
                });
            } else {
                // If window.createConnection is not available, create the connection directly in the SVG container
                console.log("No global createConnection function found, creating connection manually via SVG");
                
                // Find the existing SVG connections container
                const connectionsContainer = document.getElementById('connections');
                if (!connectionsContainer || !(connectionsContainer instanceof SVGElement)) {
                    console.error("SVG connections container not found!");
                    return null;
                }

                const inputId = connectionData.inputId;
                const sourceNode = connectionData.sourceNode;

                // Determine output node based on the connection source node if available
                let outputNode;
                if (connectionData.sourceNode) {
                    // Use the specified source node
                    outputNode = sourceBlock.querySelector(`.output-node[data-output="${connectionData.sourceNode}"]`);
                } else if (connectionData.sourceMethod) {
                    // Try to find by method
                    outputNode = sourceBlock.querySelector(`.output-node[data-output="${connectionData.sourceMethod}_output"]`);
                } else {
                    // Default to the first output node
                    outputNode = sourceBlock.querySelector('.output-node');
                }

                // Determine input node from connection inputId
                let inputNode;
                if (connectionData.inputId) {
                    inputNode = targetBlock.querySelector(`.input-node[data-input="${connectionData.inputId}"]`);
                }

                if (!inputNode) {
                    // Fallback to first input node if we couldn't find a matching one
                    inputNode = targetBlock.querySelector('.input-node');
                }
                
                if (!outputNode || !inputNode) {
                    console.error("Failed to find connection nodes", {
                        outputNodeFound: !!outputNode,
                        inputNodeFound: !!inputNode,
                        connectionData
                    });
                    return null;
                }
                
                // Calculate positions for the connection line
                const canvasContainer = document.querySelector('.canvas-container');
                const canvasRect = canvasContainer.getBoundingClientRect();
                const outputRect = outputNode.getBoundingClientRect();
                const inputRect = inputNode.getBoundingClientRect();
                
                // Calculate positions with zoom and translation
                const zoom = window.zoom || 1;
                const currentTranslate = window.currentTranslate || { x: 0, y: 0 };
                
                const x1 = ((outputRect.right - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
                const y1 = ((outputRect.top + outputRect.height/2 - canvasRect.top) / zoom) - (currentTranslate.y / zoom);
                const x2 = ((inputRect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
                const y2 = ((inputRect.top + inputRect.height/2 - canvasRect.top) / zoom) - (currentTranslate.y / zoom);
                
                // Create SVG line element
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', '#5d9cec');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('class', 'connection-line');
                
                // Set data attributes to track connection info
                line.setAttribute('data-source', sourceBlock.id);
                line.setAttribute('data-target', targetBlock.id);
                
                // Add to connections container
                connectionsContainer.appendChild(line);
                // Add to global connections array 
                if (window.connections && Array.isArray(window.connections)) {
                    const connection = {
                        source: connectionData.source,
                        target: connectionData.target,
                        inputId: inputId,
                        sourceNode: connectionData.sourceNode,
                        sourceMethod: connectionData.sourceMethod,
                        targetMethod: connectionData.targetMethod
                    };
                    window.connections.push(connection);
                }
                
                return { source: sourceBlock, target: targetBlock, inputId: inputId, sourceNode: sourceNode};
            }
        } catch (error) {
            console.error("Error in createConnectionFromTemplate:", error);
            return null;
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
                
                // Also sync with localStorage for persistence
                // This is critical for multi method blocks to keep parameters across sessions
                try {
                    const blockParamsKey = `blockParams-${blockId}`;
                    const localStorageParams = JSON.parse(localStorage.getItem(blockParamsKey) || '{}');
                    localStorageParams[paramName] = value;
                    localStorage.setItem(blockParamsKey, JSON.stringify(localStorageParams));
                    console.log(`Saved parameter ${paramName}=${value} to localStorage for block ${blockId}`);
                } catch (e) {
                    console.warn('Failed to save parameter to localStorage:', e);
                }
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
        
        // Create a basic connection structure for tracking
        const connection = {
            id: connectionData.id || "connection_" + Math.random().toString(36).substr(2, 9),
            source: connectionData.source.blockId,
            target: connectionData.target.blockId,
            inputId: connectionData.target.inputId,
            data: connectionData.data || {}
        };
        
        try {
            // Find the existing SVG connections container
            const connectionsContainer = document.getElementById('connections');
            if (!connectionsContainer || !(connectionsContainer instanceof SVGElement)) {
                console.error("SVG connections container not found!");
                return null;
            }
            
            // Find source and target elements
            const sourceBlock = document.getElementById(connection.source);
            const targetBlock = document.getElementById(connection.target);
            
            if (!sourceBlock || !targetBlock) {
                console.error("Source or target block not found");
                return null;
            }
            
            // Get the source output node
            const sourceNodeIndex = connectionData.source.outputIndex || 0;
            const sourceNodes = sourceBlock.querySelectorAll('.output-node');
            const sourceNode = sourceNodes[sourceNodeIndex] || sourceNodes[0];
            
            // Get the target input node based on inputId if available
            let targetNode = null;
            if (connection.inputId) {
                // Try to find input node with matching data-input
                const inputNodes = targetBlock.querySelectorAll('.input-node');
                for (let i = 0; i < inputNodes.length; i++) {
                    if (inputNodes[i].getAttribute('data-input') === connection.inputId) {
                        targetNode = inputNodes[i];
                        break;
                    }
                }
            }
            
            // Fallback to index if no inputId match
            if (!targetNode) {
                const targetNodeIndex = connectionData.target.inputIndex || 0;
                const targetNodes = targetBlock.querySelectorAll('.input-node');
                targetNode = targetNodes[targetNodeIndex] || targetNodes[0];
            }
            
            if (sourceNode && targetNode) {
                // Calculate positions for the connection
                const canvasContainer = document.querySelector('.canvas-container');
                if (!canvasContainer) {
                    console.error("Canvas container not found");
                    return null;
                }
                
                const sourceRect = sourceNode.getBoundingClientRect();
                const targetRect = targetNode.getBoundingClientRect();
                const containerRect = canvasContainer.getBoundingClientRect();
                
                // Calculate positions relative to canvas - handle zoom and transform correctly
                const zoom = window.zoom || 1;
                const currentTranslate = window.currentTranslate || { x: 0, y: 0 };
                
                const sourceX = ((sourceRect.left - containerRect.left) / zoom) - (currentTranslate.x / zoom) + sourceNode.offsetWidth/2;
                const sourceY = ((sourceRect.top - containerRect.top) / zoom) - (currentTranslate.y / zoom) + sourceNode.offsetHeight/2;
                const targetX = ((targetRect.left - containerRect.left) / zoom) - (currentTranslate.x / zoom) + targetNode.offsetWidth/2;
                const targetY = ((targetRect.top - containerRect.top) / zoom) - (currentTranslate.y / zoom) + targetNode.offsetHeight/2;
                
                // Create the SVG line element and add it to the connections container
                const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute('x1', sourceX);
                line.setAttribute('y1', sourceY);
                line.setAttribute('x2', targetX);
                line.setAttribute('y2', targetY);
                line.setAttribute('stroke', '#5d9cec');
                line.setAttribute('stroke-width', '2');
                line.setAttribute('class', 'connection-line');
                
                // Add data attributes to track this connection
                line.setAttribute('data-source-id', connection.source);
                line.setAttribute('data-target-id', connection.target);
                line.setAttribute('data-input-id', connection.inputId || '');
                
                // Add to the SVG connections container
                connectionsContainer.appendChild(line);
                
                // Add to the window.connections array if it exists
                if (window.connections && Array.isArray(window.connections)) {
                    window.connections.push({
                        source: connection.source,
                        target: connection.target,
                        inputId: connection.inputId
                    });
                }
                
                // Update connections visualization if needed
                if (typeof window.updateConnections === 'function') {
                    window.updateConnections();
                }
            } else {
                console.error("Source or target node not found");
                return null;
            }
        } catch (error) {
            console.error("Error creating connection manually:", error);
        }
        
        return connection;
    }

    /**
     * Create a block manually when global functions are not available
     * @param {Object} blockData - Block data from template
     * @returns {HTMLElement} - Created block element
     */
    createBlockManually(blockData) {
        console.log("Creating block manually:", blockData);
        
        try {
            // Get the canvas container
            const canvasContainer = document.querySelector('.canvas-container');
            if (!canvasContainer) {
                throw new Error("Canvas container not found");
            }
            
            // Create block element
            const block = document.createElement('div');
            block.id = blockData.id;
            block.className = 'block';
            
            if (blockData.custom) {
                block.classList.add('custom-block');
            }
            
            // Set type attribute
            block.setAttribute('data-type', blockData.type);
            block.setAttribute('data-block-type', blockData.type);
            
            // Set class name if available
            if (blockData.className) {
                block.setAttribute('data-class-name', blockData.className);
            }
            
            // Set position
            block.style.position = 'absolute';
            block.style.left = `${blockData.position.x}px`;
            block.style.top = `${blockData.position.y}px`;
            
            // Add block content (header, body, etc.)
            let blockContent = `
                <div class="block-header">
                    <div class="block-title">${blockData.className || blockData.type}</div>
                    <div class="block-actions">
                        <button class="block-delete-btn" title="Delete block">×</button>
                    </div>
                </div>
                <div class="block-body"></div>
            `;
            
            // Add input nodes if specified
            if (blockData.inputs && blockData.inputs.length > 0) {
                blockContent += '<div class="input-nodes">';
                blockData.inputs.forEach((input, index) => {
                    blockContent += `
                        <div class="input-node" data-input="${input || index}">
                            <div class="node-label">${input || 'Input ' + (index + 1)}</div>
                        </div>
                    `;
                });
                blockContent += '</div>';
            }
            
            // Add output nodes if specified
            if (blockData.outputs && blockData.outputs.length > 0) {
                blockContent += '<div class="output-nodes">';
                blockData.outputs.forEach((output, index) => {
                    blockContent += `
                        <div class="output-node" data-output="${output || index}">
                            <div class="node-label">${output || 'Output ' + (index + 1)}</div>
                        </div>
                    `;
                });
                blockContent += '</div>';
            }
            
            // Set inner HTML
            block.innerHTML = blockContent;
            
            // Add to canvas
            const blockContainer = document.querySelector('.block-container');
            if (blockContainer) {
                blockContainer.appendChild(block);
            } else {
                const canvasContainer = document.querySelector('.canvas-container');
                if (canvasContainer) {
                    canvasContainer.appendChild(block);
                }
            }
            
            // Make block draggable if the function exists
            if (typeof window.makeBlockDraggable === 'function') {
                window.makeBlockDraggable(block);
            }
            
            // Set up node connections if the function exists
            if (typeof window.setupNodeConnections === 'function') {
                window.setupNodeConnections(block);
            }
            
            // Set up custom block if applicable
            if (blockData.custom && typeof window.setupCustomBlock === 'function') {
                window.setupCustomBlock(block);
            }
            
            // Add enhanced drag event listeners
            this.addDragEventListeners(block);
            
            // Add to custom blocks list in sidebar if it's a custom block
            if (blockData.custom && blockData.className) {
                this.addToCustomBlocksList(blockData);
            }
            
            return block;
        } catch (error) {
            console.error("Error in createBlockManually:", error);
            return null;
        }
    }
    
    /**
     * Adds a block to the custom blocks list in the sidebar
     * @param {Object} blockData - Block data
     */
    addToCustomBlocksList(blockData) {
        try {
            // Check if window.addCustomBlockToMenu exists and use it instead
            if (typeof window.addCustomBlockToMenu === 'function') {
                console.log(`Using global addCustomBlockToMenu for ${blockData.className}`);
                window.addCustomBlockToMenu(
                    blockData.className, 
                    blockData.id, 
                    blockData.inputs || [], 
                    blockData.outputs || []
                );
                return;
            }
            
            // Fallback implementation if the global function isn't available
            // Check if the custom blocks container exists
            const customBlocksContainer = document.getElementById('custom-blocks-container');
            if (!customBlocksContainer) {
                console.warn("Custom blocks container not found");
                return;
            }
            
            // Show the custom blocks section header
            const sectionHeader = document.getElementById('custom-blocks-section-header');
            if (sectionHeader) {
                sectionHeader.style.display = 'flex';
            }
            
            // Check if this block type already exists in the list
            const existingBlock = customBlocksContainer.querySelector(`[data-block-id="${blockData.id}"]`);
            if (existingBlock) {
                console.log(`Block ${blockData.id} already exists in menu, skipping`);
                return;
            }
            
            // Create the block template element
            const blockTemplate = document.createElement('div');
            blockTemplate.className = 'block-template custom-block-template';
            blockTemplate.setAttribute('draggable', 'true');
            blockTemplate.setAttribute('data-block-type', 'custom');
            blockTemplate.setAttribute('data-block-id', blockData.id);
            blockTemplate.setAttribute('data-class-name', blockData.className);
            
            let blockName = blockData.className;
            
            // Extract display name from full class path
            const parts = blockName.split('.');
            if (parts.length > 0) {
                blockName = parts[parts.length - 1];
            }
            
            // Create simplified block structure for the menu
            blockTemplate.innerHTML = `
                <div class="block-header">
                    <div class="block-drag-handle" contenteditable="false">${blockName}</div>
                </div>
            `;
            
            // Add drag start event listener with correct data
            blockTemplate.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', 'custom');
                e.dataTransfer.setData('blockId', blockData.id);
                e.dataTransfer.setData('className', blockData.className);
                e.dataTransfer.setData('inputNodes', JSON.stringify(blockData.inputs || []));
                e.dataTransfer.setData('outputNodes', JSON.stringify(blockData.outputs || []));
                
                // Also set block-type for compatibility
                e.dataTransfer.setData('block-type', `custom_${blockData.className}`);
                e.dataTransfer.setData('custom-block', 'true');
            });
            
            // Add event listener for the block-drag-handle
            const dragHandle = blockTemplate.querySelector('.block-drag-handle');
            if (dragHandle) {
                // Store the original class name as a data attribute
                dragHandle.setAttribute('data-original-name', blockData.className);
                
                // Add click event to make it editable
                dragHandle.addEventListener('click', (e) => {
                    // Only make editable on direct click (not during drag)
                    if (e.target === dragHandle) {
                        dragHandle.contentEditable = 'true';
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
                    dragHandle.contentEditable = 'false';
                    const newName = dragHandle.textContent.trim();
                    if (newName && newName !== blockName) {
                        // Update the block's class name attribute
                        blockTemplate.setAttribute('data-class-name', blockData.className);
                        
                        // Update the block in sessionStorage if the function exists
                        if (typeof window.updateBlockNameInStorage === 'function') {
                            window.updateBlockNameInStorage(blockData.id, newName);
                        }
                        
                        console.log(`Block name changed from "${blockName}" to "${newName}"`);
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
            this.saveCustomBlockToSessionStorage(blockData);
            
            console.log(`Added ${blockData.className} to custom blocks list`);
        } catch (error) {
            console.error("Error adding to custom blocks list:", error);
        }
    }
    
    /**
     * Save custom block to session storage for persistence
     * @param {Object} blockData - The block data to save
     */
    saveCustomBlockToSessionStorage(blockData) {
        try {
            // Get existing blocks or initialize empty array
            const existingBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
            
            // Ensure we have methods for this block
            let methods = ['__init__']; // Default to constructor only
            
            if (blockData.config && blockData.config.methods && blockData.config.methods.length > 0) {
                methods = [...blockData.config.methods];
                // Ensure __init__ is always included
                if (!methods.includes('__init__')) {
                    methods.unshift('__init__');
                }
            } else {
                // Try to find existing methods for this class
                const existingBlock = existingBlocks.find(b => b.className === blockData.className);
                if (existingBlock && existingBlock.methods && existingBlock.methods.length > 0) {
                    methods = [...existingBlock.methods];
                }
            }
            
            // Capture selected method and parameters from template
            let selectedMethod = blockData.config && blockData.config.selectedMethod ? 
                blockData.config.selectedMethod : null;
            
            let parameters = blockData.config && blockData.config.parameters ? 
                {...blockData.config.parameters} : {};
                
            // Check if block already exists
            const existingBlockIndex = existingBlocks.findIndex(block => block.id === blockData.id);
            
            if (existingBlockIndex >= 0) {
                // Update existing block
                existingBlocks[existingBlockIndex] = {
                    ...existingBlocks[existingBlockIndex],
                    className: blockData.className,
                    methods: methods,
                    selectedMethod: selectedMethod,
                    parameters: parameters,
                    id: blockData.id
                };
                
                // Store module info if available
                if (blockData.config && blockData.config.moduleInfo) {
                    existingBlocks[existingBlockIndex].moduleInfo = blockData.config.moduleInfo;
                }
                
                console.log(`Updated existing block in session storage: ${blockData.id}`);
            } else {
                // Add new block
                existingBlocks.push({
                    className: blockData.className,
                    methods: methods,
                    selectedMethod: selectedMethod,
                    parameters: parameters,
                    id: blockData.id,
                    moduleInfo: blockData.config && blockData.config.moduleInfo ? blockData.config.moduleInfo : null
                });
                
                console.log(`Added new block to session storage: ${blockData.id}`);
            }
            
            // Save to session storage
            sessionStorage.setItem('customBlocks', JSON.stringify(existingBlocks));
            
            // Also ensure we have block-specific parameter storage in localStorage
            if (parameters && Object.keys(parameters).length > 0) {
                const key = `blockParams-${blockData.id}`;
                const existingParams = localStorage.getItem(key);
                
                if (!existingParams) {
                    localStorage.setItem(key, JSON.stringify(parameters));
                    console.log(`Initialized blockParams for ${blockData.id}`);
                } else {
                    // Merge with existing parameters for multi method blocks
                    try {
                        const savedParams = JSON.parse(existingParams);
                        const mergedParams = {...savedParams, ...parameters};
                        localStorage.setItem(key, JSON.stringify(mergedParams));
                        console.log(`Updated blockParams for ${blockData.id} with ${Object.keys(parameters).length} parameters`);
                    } catch (e) {
                        // If there's an error, overwrite with new parameters
                        localStorage.setItem(key, JSON.stringify(parameters));
                        console.warn('Error merging parameters, overwrote with new values:', e);
                    }
                }
            }
            
            console.log(`Saved custom block to session storage: ${blockData.className} (ID: ${blockData.id})`);
        } catch (e) {
            console.error('Error saving custom block to session storage:', e);
        }
    }

    // Add this new method to help with draggability
    makeBlockDraggableManually(block) {
        try {
            if (!block) return;
            
            // Setup drag handling on the block's drag handle
            const dragHandle = block.querySelector('.block-drag-handle');
            if (!dragHandle) return;
            
            // Remove any existing listeners to prevent duplicates
            const newDragHandle = dragHandle.cloneNode(true);
            dragHandle.parentNode.replaceChild(newDragHandle, dragHandle);
            
            // Set up new drag handling
            newDragHandle.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return; // Only left mouse button
                
                // Mark as dragging
                block.classList.add('dragging');
                block.style.zIndex = '1000';
                
                // Get starting positions
                const startX = e.clientX;
                const startY = e.clientY;
                
                // Get current transform
                const transform = window.getComputedStyle(block).transform;
                let translateX = 0, translateY = 0;
                
                if (transform && transform !== 'none') {
                    const matrix = new DOMMatrixReadOnly(transform);
                    translateX = matrix.m41;
                    translateY = matrix.m42;
                }
                
                // Handler for mouse movement
                function mouseMoveHandler(e) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    
                    // Apply new transform with the delta applied
                    block.style.transform = `translate(${translateX + dx}px, ${translateY + dy}px)`;
                    
                    // IMPORTANT: Always update connections with each movement
                    // This ensures real-time connection updates during dragging
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                // Handler for mouse up
                function mouseUpHandler() {
                    document.removeEventListener('mousemove', mouseMoveHandler);
                    document.removeEventListener('mouseup', mouseUpHandler);
                    
                    block.classList.remove('dragging');
                    block.style.zIndex = '1';
                    
                    // Update connections one final time
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                }
                
                // Add temporary document-level event listeners
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
                
                e.preventDefault();
                e.stopPropagation();
            });
            
            console.log(`Block ${block.id} made draggable manually`);
        } catch (error) {
            console.error('Error making block draggable:', error);
        }
    }

    // Add this new helper function to get connections data
    getConnectionsData() {
        let connections = [];
        
        // First priority: Use the global window.connections array if it's available and is an array
        if (window.connections && Array.isArray(window.connections)) {
            console.log('Using global window.connections array', window.connections.length);
            
            connections = window.connections.map(conn => {
                // Create a basic connection object
                const formattedConn = {
                    source: conn.source,
                    target: conn.target,
                    inputId: conn.inputId
                };

                // Add method-specific information if available
                if (conn.sourceMethod) {
                    formattedConn.sourceMethod = conn.sourceMethod;
                }

                if (conn.targetMethod) {
                    formattedConn.targetMethod = conn.targetMethod;
                }

                if (conn.sourceNode) {
                    formattedConn.sourceNode = conn.sourceNode;
                }

                return formattedConn;
            });
        }
        
        // If we still don't have connections, try to get them from the SVG container
        if (connections.length === 0) {
            const connectionsContainer = document.getElementById('connections');
            if (connectionsContainer && connectionsContainer instanceof SVGElement) {
                console.log('Extracting connections from SVG container');
                
                const lines = connectionsContainer.querySelectorAll('line, path');
                lines.forEach((line, index) => {
                    // Extract source and target IDs from data attributes
                    const sourceId = line.getAttribute('data-source-id');
                    const targetId = line.getAttribute('data-target-id');
                    const inputId = line.getAttribute('data-input-id');
                    
                    if (sourceId && targetId) {
                        connections.push({
                            id: line.id || `conn_${index}`,
                            source: {
                                blockId: sourceId,
                                outputIndex: 0
                            },
                            target: {
                                blockId: targetId,
                                inputIndex: 0,
                                inputId: inputId
                            }
                        });
                    }
                });
            }
        }
        
        return connections;
    }

    // Fix the setupNodeConnections function to properly bind events to nodes in loaded blocks
    setupNodeConnections(block) {
        if (!block) return;
        
        const outputNodes = block.querySelectorAll('.output-node');
        const inputNodes = block.querySelectorAll('.input-node');
        
        // CRITICAL FIX: Remove any existing event listeners by cloning and replacing nodes
        // This ensures we don't have duplicate event handlers
        
        // Process output nodes
        outputNodes.forEach(outputNode => {
            // Clone and replace to remove existing listeners
            const newOutputNode = outputNode.cloneNode(true);
            outputNode.parentNode.replaceChild(newOutputNode, outputNode);
            
            // Add mousedown handler for connection initiation
            newOutputNode.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                console.log("Starting connection drag from output node");
                
                // Set global state
                window.draggingConnection = true;
                window.sourceNode = newOutputNode;
                
                // Get SVG container for temporary connection
                const connectionsContainer = document.getElementById('connections');
                if (!connectionsContainer) {
                    console.error("Connections container not found!");
                    return;
                }
                
                // Calculate the starting position for the connection line
                const nodeRect = newOutputNode.getBoundingClientRect();
                const canvasRect = document.querySelector('.canvas-container').getBoundingClientRect();
                
                // Get the current zoom and translate values
                const zoom = window.zoom || 1;
                const currentTranslate = window.currentTranslate || { x: 0, y: 0 };
                
                // Calculate node center in ABSOLUTE document coordinates
                const nodeCenterX = nodeRect.left + (nodeRect.width / 2);
                const nodeCenterY = nodeRect.top + (nodeRect.height / 2);
                
                // Convert to SVG coordinates with zoom compensation
                const x1 = ((nodeCenterX - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
                const y1 = ((nodeCenterY - canvasRect.top) / zoom) - (currentTranslate.y / zoom);
                
                // Create temporary connection line
                const tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tempConnection.setAttribute('x1', x1);
                tempConnection.setAttribute('y1', y1);
                tempConnection.setAttribute('x2', x1);  // Start at same point
                tempConnection.setAttribute('y2', y1);
                tempConnection.setAttribute('class', 'connection-line dragging');
                tempConnection.id = 'temp-connection';
                
                // Add to connections container
                connectionsContainer.appendChild(tempConnection);
                
                // Store the temp connection in window for access by mousemove handler
                window.tempConnection = tempConnection;
                
                // Add a mousemove handler to document to update the connection
                const moveHandler = (e) => {
                    if (!window.draggingConnection || !window.tempConnection) return;
                    
                    // Calculate current mouse position relative to canvas
                    const canvasRect = document.querySelector('.canvas-container').getBoundingClientRect();
                    const zoom = window.zoom || 1;
                    const currentTranslate = window.currentTranslate || { x: 0, y: 0 };
                    
                    // Update the end position of the temporary connection
                    const x2 = ((e.clientX - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
                    const y2 = ((e.clientY - canvasRect.top) / zoom) - (currentTranslate.y / zoom);
                    
                    window.tempConnection.setAttribute('x2', x2);
                    window.tempConnection.setAttribute('y2', y2);
                    
                    // Check for potential input nodes under the mouse
                    const elemUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                    if (elemUnderMouse && elemUnderMouse.classList.contains('input-node')) {
                        const sourceBlock = window.sourceNode.closest('.block');
                        const targetBlock = elemUnderMouse.closest('.block');
                        
                        if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                            if (window.hoveredInputNode && window.hoveredInputNode !== elemUnderMouse) {
                                window.hoveredInputNode.classList.remove('input-node-hover');
                            }
                            window.hoveredInputNode = elemUnderMouse;
                            window.hoveredInputNode.classList.add('input-node-hover');
                            
                            // Add hover effect to connection
                            window.tempConnection.classList.add('connection-hover');
                        }
                    } else if (window.hoveredInputNode) {
                        window.hoveredInputNode.classList.remove('input-node-hover');
                        window.hoveredInputNode = null;
                        window.tempConnection.classList.remove('connection-hover');
                    }
                };
                
                // Add a mouseup handler to document to finalize the connection
                const upHandler = (e) => {
                    // Remove event listeners
                    document.removeEventListener('mousemove', moveHandler);
                    document.removeEventListener('mouseup', upHandler);
                    
                    if (!window.draggingConnection) return;
                    
                    // Get the element under the mouse
                    let elemUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                    let inputNode = null;
                    
                    // Find the input node (either directly or a parent)
                    while (elemUnderMouse && !inputNode) {
                        if (elemUnderMouse.classList && elemUnderMouse.classList.contains('input-node')) {
                            inputNode = elemUnderMouse;
                            break;
                        }
                        elemUnderMouse = elemUnderMouse.parentElement;
                    }
                    
                    // If we found an input node, create a connection
                    if (inputNode && window.sourceNode) {
                        const sourceBlock = window.sourceNode.closest('.block');
                        const targetBlock = inputNode.closest('.block');
                        
                        if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                            const inputId = inputNode.getAttribute('data-input');
                            const sourceNodeId = window.sourceNode.getAttribute('data-output');
                            
                            if (inputId) {
                                // Remove existing connections to this input
                                if (window.removeConnectionsToInput && typeof window.removeConnectionsToInput === 'function') {
                                    window.removeConnectionsToInput(targetBlock.id, inputId);
                                } else if (window.connections && Array.isArray(window.connections)) {
                                    // Manually remove connections
                                    window.connections = window.connections.filter(conn => {
                                        return !(conn.target === targetBlock.id && conn.inputId === inputId);
                                    });
                                }
                                
                                // Create the connection with explicit sourceNode and method information
                                const sourceMethod = sourceNodeId ? sourceNodeId.split('_output')[0] : null;
                                const targetMethod = inputId ? inputId.split('_input')[0] : null;
                                
                                if (window.createConnection && typeof window.createConnection === 'function') {
                                    window.createConnection(sourceBlock, targetBlock, inputId, {
                                        sourceNode: sourceNodeId,
                                        sourceMethod: sourceMethod,
                                        targetMethod: targetMethod
                                    });
                                    console.log(`Created connection from ${sourceBlock.id}:${sourceNodeId} to ${targetBlock.id}:${inputId}`);
                                } else {
                                    // Fallback if createConnection is not available
                                    if (!window.connections) window.connections = [];
                                    window.connections.push({
                                        source: sourceBlock.id,
                                        target: targetBlock.id,
                                        inputId: inputId,
                                        sourceNode: sourceNodeId,
                                        sourceMethod: sourceMethod,
                                        targetMethod: targetMethod
                                    });
                                    updateConnections();
                                }
                            }
                        }
                    }
                    
                    // Clean up hover state
                    if (window.hoveredInputNode) {
                        window.hoveredInputNode.classList.remove('input-node-hover');
                        window.hoveredInputNode = null;
                    }
                    
                    // Clean up
                    window.draggingConnection = false;
                    window.sourceNode = null;
                    
                    if (window.tempConnection) {
                        window.tempConnection.remove();
                        window.tempConnection = null;
                    }
                };
                
                // Add the event listeners to document
                document.addEventListener('mousemove', moveHandler);
                document.addEventListener('mouseup', upHandler);
            });
        });
        
        // Process input nodes
        inputNodes.forEach(inputNode => {
            // Clone and replace to remove existing listeners
            const newInputNode = inputNode.cloneNode(true);
            inputNode.parentNode.replaceChild(newInputNode, inputNode);
            
            // Prevent click on input node from propagating to block
            newInputNode.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            
            // Add hover handling for active connection
            newInputNode.addEventListener('mouseover', (e) => {
                if (window.draggingConnection && window.sourceNode) {
                    const sourceBlock = window.sourceNode.closest('.block');
                    const targetBlock = newInputNode.closest('.block');
                    
                    if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                        window.hoveredInputNode = newInputNode;
                        newInputNode.classList.add('input-node-hover');
                        
                        // Add effect to visualize potential connection
                        if (window.tempConnection) {
                            window.tempConnection.classList.add('connection-hover');
                        }
                        
                        e.stopPropagation();
                    }
                }
            });
            
            newInputNode.addEventListener('mouseout', (e) => {
                if (window.hoveredInputNode === newInputNode) {
                    window.hoveredInputNode = null;
                    newInputNode.classList.remove('input-node-hover');
                    
                    // Remove connection hover effect
                    if (window.tempConnection) {
                        window.tempConnection.classList.remove('connection-hover');
                    }
                    
                    e.stopPropagation();
                }
            });
        });
        
        console.log(`Set up node connections for block ${block.id}`);
    }

    // Add this new function to ensure template blocks update connections while dragging
    addDragEventListeners(block) {
        // Skip if block doesn't exist
        if (!block) return;
        
        console.log(`Adding enhanced drag event listeners to block ${block.id}`);
        
        // Set up a MutationObserver to listen for transform changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'style' && 
                    mutation.target.style.transform &&
                    typeof window.updateConnections === 'function') {
                    // Update connections when transform changes
                    window.updateConnections();
                }
            });
        });
        
        // Start observing
        observer.observe(block, {
            attributes: true,
            attributeFilter: ['style']
        });
        
        // Also add event listener for mousedown on the drag handle
        const dragHandle = block.querySelector('.block-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', () => {
                // Set a data attribute to track that this block is being dragged
                block.setAttribute('data-being-dragged', 'true');
                
                // Set up a temporary mousemove listener on document
                const moveHandler = () => {
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                };
                
                document.addEventListener('mousemove', moveHandler);
                
                // Clean up on mouseup
                const upHandler = () => {
                    document.removeEventListener('mousemove', moveHandler);
                    document.removeEventListener('mouseup', upHandler);
                    block.removeAttribute('data-being-dragged');
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                };
                
                document.addEventListener('mouseup', upHandler, { once: true });
            });
        }
        
        return block;
    }

    // Override the makeBlockDraggable function for template blocks
    overrideMakeBlockDraggable() {
        // Store the original function if it exists
        const originalMakeBlockDraggable = window.makeBlockDraggable;
        
        // Create an enhanced version that ensures updates happen in real time
        window.makeBlockDraggable = (block) => {
            console.log(`Enhanced makeBlockDraggable called for block ${block.id}`);
            
            // First call the original function if it exists
            if (typeof originalMakeBlockDraggable === 'function') {
                originalMakeBlockDraggable(block);
            }
            
            // Now add our own enhanced event handling
            const dragHandle = block.querySelector('.block-drag-handle');
            if (!dragHandle) return;
            
            // Remove existing listeners and replace with new one to prevent duplicates
            const newDragHandle = dragHandle.cloneNode(true);
            dragHandle.parentNode.replaceChild(newDragHandle, dragHandle);
            
            // Add enhanced mousedown handler
            newDragHandle.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return; // Only left mouse button
                
                // Mark the block as being dragged - critical for connection positioning
                block.classList.add('dragging');
                block.setAttribute('data-dragging', 'true');
                document.body.setAttribute('data-block-dragging', block.id);
                block.style.zIndex = '1000';
                
                // Get the initial positions
                const startX = e.clientX;
                const startY = e.clientY;
                
                // Get the current transform matrix
                const transform = window.getComputedStyle(block).transform;
                let translateX = 0, translateY = 0;
                
                if (transform && transform !== 'none') {
                    const matrix = new DOMMatrixReadOnly(transform);
                    translateX = matrix.m41;
                    translateY = matrix.m42;
                }
                
                // Enhanced mousemove handler with forced connection updates
                function mouseMoveHandler(e) {
                    const dx = e.clientX - startX;
                    const dy = e.clientY - startY;
                    
                    // Apply new position
                    block.style.transform = `translate(${translateX + dx}px, ${translateY + dy}px)`;
                    
                    // CRITICAL: Force connection update on EVERY move
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                // Enhanced mouseup handler
                function mouseUpHandler() {
                    document.removeEventListener('mousemove', mouseMoveHandler);
                    document.removeEventListener('mouseup', mouseUpHandler);
                    
                    // Clean up
                    block.classList.remove('dragging');
                    block.removeAttribute('data-dragging');
                    document.body.removeAttribute('data-block-dragging');
                    block.style.zIndex = '1';
                    
                    // Final connection update
                    if (typeof window.updateConnections === 'function') {
                        window.updateConnections();
                    }
                }
                
                // Add temporary event listeners
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', mouseUpHandler);
                
                e.preventDefault();
                e.stopPropagation();
            });
        };
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