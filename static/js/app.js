document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const subMenus = document.querySelectorAll('.sub-menu');
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const themeOptions = document.querySelectorAll('.theme-option');
    const mainMenu = document.querySelector('.main-menu');
    const bgColorOptions = document.querySelectorAll('.bg-color-option');
    const canvas = document.getElementById('canvas');

    // Initialize dark mode
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    const savedTheme = localStorage.getItem('theme') || 'system';
    
    // Set initial dark mode state
    if (savedDarkMode || (!localStorage.getItem('darkMode') && prefersDarkMode)) {
        document.body.classList.add('dark-mode');
        if (themeOptions) {
            themeOptions.forEach(option => {
                option.classList.remove('active');
                if (option.dataset.theme === 'dark') {
                    option.classList.add('active');
                }
            });
        }
    } else {
        if (themeOptions) {
            themeOptions.forEach(option => {
                option.classList.remove('active');
                if (option.dataset.theme === savedTheme) {
                    option.classList.add('active');
                }
            });
        }
    }

    // Handle theme option clicks
    if (themeOptions) {
        themeOptions.forEach(option => {
            option.addEventListener('click', () => {
                const theme = option.dataset.theme;

                // Remove active class from all options
                themeOptions.forEach(opt => opt.classList.remove('active'));

                // Add active class to clicked option
                option.classList.add('active');

                // Apply theme
                if (theme === 'dark') {
                    document.body.classList.add('dark-mode');
                    localStorage.setItem('darkMode', 'true');
                } else if (theme === 'light') {
                    document.body.classList.remove('dark-mode');
                    localStorage.setItem('darkMode', 'false');
                } else if (theme === 'system') {
                    if (prefersDarkMode) {
                        document.body.classList.add('dark-mode');
                    } else {
                        document.body.classList.remove('dark-mode');
                    }
                    localStorage.removeItem('darkMode');
                }

                localStorage.setItem('theme', theme);
            });
        });
    }

    // Handle sidebar toggle
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('expanded');
        // Close all sub-menus when collapsing sidebar
        if (!sidebar.classList.contains('expanded')) {
            subMenus.forEach(menu => menu.classList.remove('active'));
            menuItems.forEach(item => item.classList.remove('active'));
        }
        // Save sidebar state
        localStorage.setItem('sidebarExpanded', sidebar.classList.contains('expanded'));
    });

    // Initialize custom block handler
    const customBlockHandler = new CustomBlockHandler();

    // Connect create custom block button to show modal
    document.getElementById('create-custom-block-btn')?.addEventListener('click', () => {
        customBlockHandler.showModal();
    });

    const exportButton = document.getElementById('export-pipeline');
    exportButton.addEventListener('click', () => { // This is what used to cause exportPipeline to run twice
        exportPipeline()
    })

    // Handle menu item clicks
    menuItems.forEach(item => {
        // Skip the logout button
        if (item.id === 'logout-button') return;
        
        item.addEventListener('click', () => {
            const menuType = item.dataset.menu;

            // Hide all content sections
            document.querySelectorAll('.menu-content').forEach(content => {
                content.classList.remove('active');
            });

            // Show the selected content section
            const selectedContent = document.getElementById(`${menuType}-content`);
            if (selectedContent) {
                selectedContent.classList.add('active');

                // Add submenu-open class to sidebar and main-menu when not on main menu
                if (menuType !== 'main-menu') {
                    sidebar.classList.add('submenu-open');
                    mainMenu.classList.add('submenu-open');
                } else {
                    sidebar.classList.remove('submenu-open');
                    mainMenu.classList.remove('submenu-open');
                }
            }

            // Update active state of menu items
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });

    // Handle back button clicks
    document.querySelectorAll('.back-button').forEach(button => {
        button.addEventListener('click', () => {
            // Hide all content sections
            document.querySelectorAll('.menu-content').forEach(content => {
                content.classList.remove('active');
            });

            // Show main menu content
            document.getElementById('main-menu-content').classList.add('active');

            // Remove active state from all menu items
            menuItems.forEach(item => item.classList.remove('active'));

            // Remove submenu-open class
            sidebar.classList.remove('submenu-open');
            mainMenu.classList.remove('submenu-open');
        });
    });

    // Initialize with main menu content visible
    document.getElementById('main-menu-content').classList.add('active');

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();

            // Ensure sidebar is expanded when clicking a menu item
            if (!sidebar.classList.contains('expanded')) {
                sidebar.classList.add('expanded');
                localStorage.setItem('sidebarExpanded', 'true');
            }

            // Remove active class from all menu items
            menuItems.forEach(mi => mi.classList.remove('active'));

            // Add active class to clicked menu item
            item.classList.add('active');

            const menuType = item.dataset.menu;
            const targetMenu = document.getElementById(`${menuType}-menu`);

            // Close all open sub-menus
            subMenus.forEach(menu => {
                if (menu.classList.contains('active')) {
                    menu.classList.remove('active');
                }
            });

            // Open selected sub-menu
            if (targetMenu) {
                targetMenu.classList.add('active');

                // Position the sub-menu properly
                const menuRect = mainMenu.getBoundingClientRect();
                targetMenu.style.top = `${menuRect.top}px`;

                // Adjust left position based on sidebar state
                if (sidebar.classList.contains('expanded')) {
                    targetMenu.style.left = `${menuRect.right + 10}px`;
                } else {
                    targetMenu.style.left = `${menuRect.left}px`;
                }
            }
        });
    });

    // Initialize canvas background color from localStorage
    const savedBgColor = localStorage.getItem('canvasBgColor') || 'default';
    canvas.setAttribute('data-bg-color', savedBgColor);

    // Set active class on the saved background color option
    if (bgColorOptions) {
        bgColorOptions.forEach(option => {
            option.classList.remove('active');
            if (option.dataset.color === savedBgColor) {
                option.classList.add('active');
            }
        });
    }

    // Handle background color option clicks
    if (bgColorOptions) {
        bgColorOptions.forEach(option => {
            option.addEventListener('click', () => {
                const color = option.dataset.color;

                // Remove active class from all options
                bgColorOptions.forEach(opt => opt.classList.remove('active'));

                // Add active class to clicked option
                option.classList.add('active');

                // Apply color to canvas
                canvas.setAttribute('data-bg-color', color);

                // Save color preference
                localStorage.setItem('canvasBgColor', color);
            });
        });
    }

    const connectionsContainer = document.getElementById('connections');
    const blockTemplates = document.querySelectorAll('.block-template');
    const searchInput = document.getElementById('block-search');
    let blockCounter = 1;
    // Make connections a global window property so it's accessible to template-handler.js
    window.connections = [];
    let draggedBlock = null;
    let draggingConnection = false;
    let tempConnection = null;
    let sourceNode = null;
    let hoveredInputNode = null;
    let selectedConnection = null;
    let isDraggingBlock = false;
    let dragOffset = { x: 0, y: 0 };

    // Add search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        blockTemplates.forEach(template => {
            const blockName = template.querySelector('.block-drag-handle').textContent.toLowerCase();
            if (blockName.includes(searchTerm)) {
                template.style.display = 'flex';
            } else {
                template.style.display = 'none';
            }
        });
    });

    // Add new variables for canvas manipulation
    const canvasContainer = document.querySelector('.canvas-container');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const zoomFitBtn = document.getElementById('zoom-fit');
    const zoomLevelDisplay = document.querySelector('.zoom-level');

    let isPanning = false;
    let startPoint = { x: 0, y: 0 };
    let currentTranslate = { x: 0, y: 0 };
    let zoom = 1;
    const ZOOM_SPEED = 0.1;
    const MIN_ZOOM = 0.1;
    const MAX_ZOOM = 2;

    // Create a single block container for all blocks
    const blockContainer = document.createElement('div');
    blockContainer.className = 'block-container';
    canvasContainer.appendChild(blockContainer);

    // Add these utility functions at the top of the file
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = message;
        document.getElementById('toast-container').appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    function showProgress(show = true, title = 'Processing...', status = 'Initializing...') {
        const modal = document.getElementById('progress-modal');
        if (show) {
            document.getElementById('progress-title').textContent = title;
            document.getElementById('progress-status').textContent = status;
            document.querySelector('.progress-fill').style.width = '0%';
            modal.style.display = 'flex';
        } else {
            modal.style.display = 'none';
        }
    }

    function updateProgress(percent, status) {
        document.querySelector('.progress-fill').style.width = `${percent}%`;
        if (status) {
            document.getElementById('progress-status').textContent = status;
        }
    }

    // Add pipeline validation function
    function validatePipeline() {
        // Check if there are any blocks at all
        const blocks = document.querySelectorAll('.block');

        // Check if there are any blocks at all
        if (blocks.length === 0) {
            return {
                valid: false,
                error: 'Pipeline is empty. Add some blocks first.'
            };
        }
        // If blocks are present, the pipeline is valid
        return {
            valid: true
        };
    }

    // Update the exportPipeline function
    async function exportPipeline() {
        // Show progress indicator
        showProgress(true, 'Exporting Pipeline', 'Validating pipeline');

        // Validate the pipeline
        const validationResult = validatePipeline();
        if (!validationResult.valid) {
            showProgress(false);
            showToast(validationResult.error, 'error');
            return;
        }

        updateProgress(25, 'Collecting block configurations');

        try {
            // Get the block configurations and connections
            const blockConfigs = {};
            document.querySelectorAll('.block').forEach(block => {
                const blockId = block.getAttribute('id');
                const blockType = block.getAttribute('data-block-type');

                // For custom blocks, include the full module path and class name
                let finalBlockType = blockType;
                if (blockType === 'custom') {
                    const className = block.getAttribute('data-class-name');

                    // Find module info from sessionStorage to get the full path
                    let moduleInfo = null;

                    // First try to find in customBlocks array in sessionStorage
                    try {
                        const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
                        const blockData = customBlocks.find(b => b.className === className || b.id === blockId);
                        if (blockData && blockData.moduleInfo) {
                            moduleInfo = blockData.moduleInfo;
                        }
                    } catch (e) {
                        console.warn('Error finding module info in sessionStorage:', e);
                    }

                    // If not found, try localStorage as a fallback
                    if (!moduleInfo) {
                        try {
                            const localStorageData = JSON.parse(localStorage.getItem('customBlocks') || '[]');
                            const localData = localStorageData.find(b => b.className === className);
                            if (localData && localData.moduleInfo) {
                                moduleInfo = localData.moduleInfo;
                            }
                        } catch (e) {
                            console.warn('Error finding module info in localStorage:', e);
                        }
                    }

                    // If we found module info, build the full path
                    if (moduleInfo && moduleInfo.module) {
                        finalBlockType = `custom_${moduleInfo.module}.${className}`;
                        console.log(`Using full path for custom block: ${finalBlockType}`);
                    } else {
                        // Default to just using the class name
                        finalBlockType = `custom_${className}`;
                        console.log(`Using just class name for custom block: ${finalBlockType}`);
                    }
                }

                // Get methods from sessionStorage if available
                let methods = [];
                try {
                    const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
                    const blockData = customBlocks.find(b => b.id === blockId);
                    if (blockData && blockData.methods) {
                        methods = blockData.methods;
                    }
                } catch (e) {
                    console.warn('Error reading methods from sessionStorage:', e);
                }

                blockConfigs[blockId] = {
                    id: blockId,
                    type: finalBlockType,
                    config: {
                        ...getBlockConfig(block),
                        methods: methods
                    }
                };
            });


            updateProgress(50, 'Generating Python code');

            // Call the export API
            const response = await fetch('/api/blocks/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    blocks: blockConfigs,
                    connections: window.connections,
                    output_file: 'generated_pipeline.py'
                }),
            });

            if (!response.ok) {
                throw new Error('Export failed: ' + (await response.text()));
            }

            const result = await response.json();
            updateProgress(100, 'Export complete');

            // Create a modal to display the code
            const modal = document.createElement('div');
            modal.className = 'code-preview-modal';
            modal.innerHTML = `
                <div class="code-preview-content">
                    <div class="code-preview-header">
                        <h3>Generated Python Code</h3>
                        <button class="close-button">&times;</button>
                    </div>
                    <pre class="code-preview-body">${escapeHtml(result.code)}</pre>
                    <div class="code-preview-footer">
                        <button class="copy-button">Copy to Clipboard</button>
                        <button class="save-button">Save as File</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Close modal when clicking the close button or outside the content
            const closeButton = modal.querySelector('.close-button');
            closeButton.addEventListener('click', () => {
                document.body.removeChild(modal);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.body.removeChild(modal);
                }
            });

            // Copy to clipboard functionality
            const copyButton = modal.querySelector('.copy-button');
            copyButton.addEventListener('click', () => {
                const codeText = result.code;
                navigator.clipboard.writeText(codeText)
                    .then(() => {
                        showToast('Code copied to clipboard', 'success');
                    })
                    .catch(() => {
                        showToast('Failed to copy code', 'error');
                    });
            });

            // Save as file functionality
            const saveButton = modal.querySelector('.save-button');
            saveButton.addEventListener('click', () => {
                const blob = new Blob([result.code], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'generated_pipeline.py';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 0);
            });

            showProgress(false);
            showToast('Code generated successfully', 'success');
        } catch (error) {
            console.error('Export error:', error);
            showProgress(false);
            showToast('Failed to generate code: ' + error.message, 'error');
        }
    }

    // Helper function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update block processing function
    async function processBlock(block) {
        const blockId = block.id;
        const type = block.getAttribute('data-block-type');
        const isCustomBlock = type.startsWith('custom_');

        updateBlockStatus(block, 'processing');

        try {
            // Get the block configuration
            const config = getBlockConfig(block);

            // Add debug mode flag
            const debugMode = document.getElementById('debug-mode')?.checked || false;
            config.debug_mode = debugMode;

            // Special case for chat input to prevent overwriting
            if (type === 'query_input') {
                const messages = block.querySelector('.chat-messages');
                const lastMessage = messages.lastElementChild;
                if (lastMessage && lastMessage.classList.contains('user-message')) {
                    config.chat_input = lastMessage.textContent.trim();
                }
            }

            console.log(`Processing ${type} block:`, config);

            // Make API call to process the block
            const response = await fetch('/api/blocks/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    block_id: blockId,
                    type: isCustomBlock ? type.substring(7) : type, // Remove 'custom_' prefix if it's a custom block
                    config: config,
                    debug_mode: debugMode
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.status === 'error') {
                throw new Error(result.output || 'Unknown error');
            }

            console.log(`${type} block result:`, result);

            // Update block content based on result
            updateBlockContent(block, type, result);

            // Propagate data to connected blocks
            propagateData(block);

            updateBlockStatus(block, 'success');
            return result;
        } catch (error) {
            console.error(`Error processing ${type} block:`, error);
            updateBlockStatus(block, 'error', error.message);
            throw error;
        }
    }

    function updateBlockStatus(block, status) {
        const statusIndicator = block.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }

        const statusText = block.querySelector('.status');
        if (statusText) {
            statusText.textContent = status === 'success' ? 'Ready' : 'Error';
        }
    }

    function splitTextIntoChunks(text, size) {
        const chunks = [];
        for (let i = 0; i < text.length; i += size) {
            chunks.push(text.slice(i, i + size));
        }
        return chunks;
    }

    function propagateData(sourceBlock) {
        // Get the source block ID and type
        const sourceId = sourceBlock.id;
        const sourceType = sourceBlock.getAttribute('data-block-type');

        console.log(`Propagating data from ${sourceType} block (${sourceId})`);

        // Find all connections where this block is the source
        const outgoingConnections = window.connections.filter(conn => conn.source === sourceId);

        if (outgoingConnections.length === 0) {
            console.log(`No outgoing connections from ${sourceId}`);
            return;
        }

        console.log(`Found ${outgoingConnections.length} outgoing connections from ${sourceId}`);

        // Get the output data from this block
        let outputData;
        try {
            outputData = JSON.parse(sourceBlock.dataset.output);
            console.log(`Output data from ${sourceId}:`, outputData);
        } catch (e) {
            console.error(`Error parsing output data from ${sourceId}:`, e);
            return;
        }

        // Check if the output is valid
        if (!outputData || outputData.status === 'error') {
            console.warn(`Invalid or error output from ${sourceId}, skipping propagation`);
            return;
        }

        // Special handling for query_input blocks to ensure query persistence
        if (sourceType === 'query_input' && outputData.query) {
            // Store the query in a more permanent way
            sourceBlock.setAttribute('data-last-query', outputData.query);
            console.log(`Stored persistent query: ${outputData.query}`);
        }

        // Process each connected block
        for (const connection of outgoingConnections) {
            const targetId = connection.target;
            const targetBlock = document.getElementById(targetId);

            if (!targetBlock) {
                console.warn(`Target block ${targetId} not found`);
                continue;
            }

            const targetType = targetBlock.getAttribute('data-block-type');
            console.log(`Propagating to ${targetType} block (${targetId})`);

            // Automatically process the target block with a small delay to allow UI updates
            setTimeout(() => {
                console.log(`Processing connected block ${targetType} (${targetId})`);
                processBlock(targetBlock)
                    .then(result => {
                        console.log(`Successfully processed connected block ${targetId}`, result);
                    })
                    .catch(err => {
                        console.error(`Error processing connected block ${targetId}:`, err);
                    });
            }, 100);
        }
    }

    // Block template drag functionality
    blockTemplates.forEach(template => {
        template.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', template.getAttribute('data-block-type'));
        });
    });

    // Canvas drag and drop handling
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData('text/plain');
        if (blockType) {
            // Get the canvas rectangle
            const rect = canvas.getBoundingClientRect();

            // Calculate position in canvas coordinates, accounting for zoom and transform
            // This is the key calculation that ensures accuracy at any zoom level
            const x = (e.clientX - rect.left - currentTranslate.x) / zoom;
            const y = (e.clientY - rect.top - currentTranslate.y) / zoom;

            if (blockType === 'custom') {
                // This is a custom block, retrieve the additional data
                const blockId = e.dataTransfer.getData('blockId');
                const className = e.dataTransfer.getData('className');
                const inputNodes = JSON.parse(e.dataTransfer.getData('inputNodes') || '[]');
                const outputNodes = JSON.parse(e.dataTransfer.getData('outputNodes') || '[]');

                console.log(`Creating custom block from drag with ID ${blockId} and class ${className}`);

                // Create a canvas instance of the block with original blockId as reference
                // This ensures we preserve the methods associated with this specific block
                const newBlockId = `${blockId}-canvas-${Date.now()}`;

                // Log the original block ID to help with debugging
                console.log(`Using original block ID ${blockId} as reference for methods`);

                const newBlock = createCustomBlock(className, inputNodes, outputNodes, newBlockId, blockId);

                // Position the block
                newBlock.style.transform = `translate(${snapToGrid(x)}px, ${snapToGrid(y)}px)`;

                // Ensure proper styling is applied
                if (!newBlock.classList.contains('custom-block')) {
                    newBlock.classList.add('custom-block');
                }

                setupCustomBlock(newBlock)

                // Add to canvas
                blockContainer.appendChild(newBlock);
            } else {
                // Regular block
                createBlock(blockType, x, y);
            }
        }
    });

    // Optimize throttle function with requestAnimationFrame
    function throttle(func, limit) {
        let waiting = false;
        return function (...args) {
            if (!waiting) {
                waiting = true;
                requestAnimationFrame(() => {
                    func.apply(this, args);
                    waiting = false;
                });
            }
        };
    }

    // Canvas pan functionality
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 && !e.target.closest('select')) { // Left mouse button only
            isPanning = true;
            canvas.classList.add('grabbing');
            startPoint = {
                x: e.clientX - currentTranslate.x,
                y: e.clientY - currentTranslate.y
            };
            e.preventDefault();
            e.stopPropagation();
        }
    });

    // Add grid snapping function
    function snapToGrid(value) {
        const gridSize = 40; // Match the CSS grid size
        return Math.round(value / gridSize) * gridSize;
    }

    // Update mousemove handler for block dragging
    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            currentTranslate = {
                x: e.clientX - startPoint.x,
                y: e.clientY - startPoint.y
            };
            updateCanvasTransform();
            e.preventDefault();
        }

        if (isDraggingBlock && draggedBlock) {
            const rect = canvas.getBoundingClientRect();

            // Calculate position relative to canvas, correctly accounting for zoom and pan
            // This calculation ensures the block stays under the cursor at any zoom level
            const x = (e.clientX - rect.left - currentTranslate.x) / zoom - dragOffset.x;
            const y = (e.clientY - rect.top - currentTranslate.y) / zoom - dragOffset.y;

            draggedBlock.style.transform = `translate(${snapToGrid(x)}px, ${snapToGrid(y)}px)`;
            // IMPORTANT: Update connections in real-time during dragging
            updateConnections();
            e.preventDefault();
        }

        if (draggingConnection && tempConnection && sourceNode) {
            const canvasRect = canvas.getBoundingClientRect();
            
            // IMPROVED: Calculate more accurately using node center
            const sourceRect = sourceNode.getBoundingClientRect();
            const sourceCenterX = sourceRect.left + (sourceRect.width / 2);
            const sourceCenterY = sourceRect.top + (sourceRect.height / 2);

            // Calculate connection points accounting for canvas transform
            const x1 = ((sourceRect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom) + sourceNode.offsetWidth/2;
            const y1 = ((sourceRect.top - canvasRect.top) / zoom) - (currentTranslate.y / zoom) + sourceNode.offsetHeight/2;
            const x2 = ((e.clientX - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
            const y2 = ((e.clientY - canvasRect.top) / zoom) - (currentTranslate.y / zoom);

            tempConnection.setAttribute('x1', x1);
            tempConnection.setAttribute('y1', y1);
            tempConnection.setAttribute('x2', x2);
            tempConnection.setAttribute('y2', y2);

            // Check for input nodes under mouse
            const elemUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            if (elemUnderMouse && elemUnderMouse.classList.contains('input-node')) {
                const sourceBlock = sourceNode.closest('.block');
                const targetBlock = elemUnderMouse.closest('.block');
                if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                    if (hoveredInputNode && hoveredInputNode !== elemUnderMouse) {
                        hoveredInputNode.classList.remove('input-node-hover');
                    }
                    hoveredInputNode = elemUnderMouse;
                    hoveredInputNode.classList.add('input-node-hover');
                    
                    // Add hover effect to connection
                    tempConnection.classList.add('connection-hover');
                }
            } else if (hoveredInputNode) {
                hoveredInputNode.classList.remove('input-node-hover');
                hoveredInputNode = null;
                tempConnection.classList.remove('connection-hover');
            }
        }
    });

    // Update mouseup handler for better connection handling
    document.addEventListener('mouseup', (e) => {
        if (isPanning) {
            isPanning = false;
            canvas.classList.remove('grabbing');
        }

        if (isDraggingBlock) {
            isDraggingBlock = false;
            if (draggedBlock) {
                draggedBlock.style.zIndex = '1';
                draggedBlock = null;
            }
        }

        if (draggingConnection) {
            // Get the element under the mouse - be more thorough in checking for input nodes
            let elemUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            
            // Search up for an input-node parent if element is a child of input-node
            let inputNodeFound = null;
            let currentElem = elemUnderMouse;
            
            // Check if it's directly an input-node or traverse up to find one
            while (currentElem && !inputNodeFound) {
                if (currentElem.classList && currentElem.classList.contains('input-node')) {
                    inputNodeFound = currentElem;
                    break;
                }
                // Try to find within node-label or tooltip-container which are children of input-node
                if (currentElem.parentElement) {
                    const parent = currentElem.parentElement;
                    if (parent.classList && parent.classList.contains('input-node')) {
                        inputNodeFound = parent;
                        break;
                    }
                    // Check for tooltip-container parent
                    if (parent.classList && parent.classList.contains('tooltip-container') && 
                        parent.parentElement && parent.parentElement.classList.contains('input-node')) {
                        inputNodeFound = parent.parentElement;
                        break;
                    }
                }
                currentElem = currentElem.parentElement;
            }
            
            // If we found an input node and have a source node, create the connection
            if (inputNodeFound && sourceNode) {
                const sourceBlock = sourceNode.closest('.block');
                const targetBlock = inputNodeFound.closest('.block');
                
                if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                    const inputId = inputNodeFound.getAttribute('data-input');
                    if (inputId) {
                        removeConnectionsToInput(targetBlock.id, inputId);
                        createConnection(sourceBlock, targetBlock, inputId);
                        console.log(`Created connection from ${sourceBlock.id} to ${targetBlock.id}:${inputId}`);
                    }
                }
            }

            if (hoveredInputNode) {
                hoveredInputNode.classList.remove('input-node-hover');
            }

            draggingConnection = false;
            sourceNode = null;
            hoveredInputNode = null;
            if (tempConnection) {
                tempConnection.remove();
                tempConnection = null;
            }
        }
    });

    function deleteBlock(block) {
        window.connections = window.connections.filter(conn => {
            if (conn.source === block.id || conn.target === block.id) {
                const targetBlock = document.getElementById(conn.target);
                if (targetBlock && targetBlock.getAttribute('data-block-type') === 'display') {
                    const display = targetBlock.querySelector('.output-display');
                    display.textContent = 'No input';
                }
                return false;
            }
            return true;
        });
        updateConnections();
        block.remove();
    }

    function removeConnectionsToInput(targetBlockId, inputId) {
        window.connections = window.connections.filter(conn => {
            if (conn.target === targetBlockId && conn.inputId === inputId) {
                const targetBlock = document.getElementById(targetBlockId);
                if (targetBlock && targetBlock.getAttribute('data-block-type') === 'display') {
                    const display = targetBlock.querySelector('.output-display');
                    display.textContent = 'No input';
                }
                return false;
            }
            return true;
        });
        updateConnections();
    }

    function createConnection(source, target, inputId) {
        const connection = {
            source: source.id,
            target: target.id,
            inputId: inputId
        };

        window.connections.push(connection);
        updateConnections();
        processBlock(target);
    }

    // Zoom controls
    zoomInBtn.addEventListener('click', () => {
        zoom = Math.min(zoom + ZOOM_SPEED, MAX_ZOOM);
        updateCanvasTransform();
    });

    zoomOutBtn.addEventListener('click', () => {
        zoom = Math.max(zoom - ZOOM_SPEED, MIN_ZOOM);
        updateCanvasTransform();
    });

    zoomFitBtn.addEventListener('click', () => {
        zoom = 1;
        currentTranslate = { x: 0, y: 0 };
        updateCanvasTransform();
    });

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -ZOOM_SPEED : ZOOM_SPEED;
            const oldZoom = zoom;
            zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom + delta));

            // Zoom towards mouse position
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            currentTranslate.x += mouseX * (1 - zoom/oldZoom);
            currentTranslate.y += mouseY * (1 - zoom/oldZoom);

            updateCanvasTransform();
        }
    });

    // Update the createBlock function
    function createBlock(type, x, y) {
        const template = document.querySelector(`.block-template[data-block-type="${type}"]`);
        if (!template) return;

        const block = template.cloneNode(true);
        block.classList.remove('block-template');
        block.classList.add('block');
        block.id = `block-${blockCounter++}`;

        // Add delete button
        const deleteButton = document.createElement('div');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '×';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBlock(block);
        });
        block.appendChild(deleteButton);

        // Position the block
        block.style.transform = `translate(${snapToGrid(x)}px, ${snapToGrid(y)}px)`;

        // Make block draggable
        const dragHandle = block.querySelector('.block-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // Only left mouse button
                isDraggingBlock = true;
                draggedBlock = block;

                // Calculate offset from the mouse to the block's top-left corner
                // This is critical for the block to stay at the correct position relative to cursor
                const rect = block.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();

                // Get the block's transform to find its real position
                const transform = window.getComputedStyle(block).transform;
                const matrix = new DOMMatrixReadOnly(transform);
                const blockX = matrix.m41;
                const blockY = matrix.m42;

                // Get mouse position in canvas coordinates
                const mouseX = (e.clientX - canvasRect.left - currentTranslate.x) / zoom;
                const mouseY = (e.clientY - canvasRect.top - currentTranslate.y) / zoom;

                // Calculate offset between mouse and block origin
                dragOffset.x = mouseX - blockX;
                dragOffset.y = mouseY - blockY;

                block.style.zIndex = '1000';
                e.preventDefault();
                e.stopPropagation();
            });
        }

        // Add connection handling
        const outputNode = block.querySelector('.output-node');
        const inputNodes = block.querySelectorAll('.input-node');

        if (outputNode) {
            outputNode.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                draggingConnection = true;
                sourceNode = outputNode;

                const nodeRect = outputNode.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();

                // Calculate node center in ABSOLUTE document coordinates
                const nodeCenterX = nodeRect.left + (nodeRect.width / 2);
                const nodeCenterY = nodeRect.top + (nodeRect.height / 2);
                
                // Convert to SVG coordinates with zoom compensation
                const x1 = ((nodeCenterX - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
                const y1 = ((nodeCenterY - canvasRect.top) / zoom) - (currentTranslate.y / zoom);

                tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tempConnection.setAttribute('x1', x1);
                tempConnection.setAttribute('y1', y1);
                tempConnection.setAttribute('x2', x1);
                tempConnection.setAttribute('y2', y1);
                tempConnection.setAttribute('class', 'connection-line dragging');
                connectionsContainer.appendChild(tempConnection);
            });
        }

        inputNodes.forEach(inputNode => {
            inputNode.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            inputNode.addEventListener('mouseover', (e) => {
                if (draggingConnection && sourceNode) {
                    const sourceBlock = sourceNode.closest('.block');
                    const targetBlock = inputNode.closest('.block');
                    if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                        hoveredInputNode = inputNode;
                        inputNode.classList.add('input-node-hover');
                        // Add an effect to better visualize the potential connection
                        if (tempConnection) {
                            tempConnection.classList.add('connection-hover');
                        }
                        e.stopPropagation();
                    }
                }
            });

            inputNode.addEventListener('mouseout', (e) => {
                if (hoveredInputNode === inputNode) {
                    hoveredInputNode = null;
                    inputNode.classList.remove('input-node-hover');
                    // Remove the connection hover effect
                    if (tempConnection) {
                        tempConnection.classList.remove('connection-hover');
                    }
                    e.stopPropagation();
                }
            });
        });

        // Handle file input changes
        const fileInput = block.querySelector('.file-input');
        if (fileInput) {
            fileInput.addEventListener('change', () => {
                processBlock(block);
            });
            fileInput.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        }

        // Handle number input changes
        const numberInputs = block.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('change', () => {
                processBlock(block);
            });
            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
        });

        // Add to canvas
        blockContainer.appendChild(block);

        // Initialize block based on type
        initializeBlock(block, type);

        return block;
    }

    function initializeBlock(block, type) {
        switch (type) {
            case 'query_input':
                const queryInterface = block.querySelector('.chat-interface');
                if (queryInterface) {
                    const input = queryInterface.querySelector('input');
                    const sendButton = queryInterface.querySelector('button');
                    const messages = queryInterface.querySelector('.chat-messages');

                    // Initialize query history if not already present
                    if (!block.hasAttribute('data-query-history')) {
                        block.setAttribute('data-query-history', JSON.stringify([]));
                    }

                    // Function to update the messages display
                    const updateMessagesDisplay = () => {
                        try {
                            const queryHistory = JSON.parse(block.getAttribute('data-query-history') || '[]');
                            messages.innerHTML = '';

                            queryHistory.forEach((query, index) => {
                                const messageDiv = document.createElement('div');
                                messageDiv.className = 'message';
                                messageDiv.textContent = query;
                                messageDiv.setAttribute('data-index', index);

                                // Add delete button
                                const deleteBtn = document.createElement('span');
                                deleteBtn.className = 'delete-message';
                                deleteBtn.innerHTML = '&times;';
                                deleteBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    // Remove this query from history
                                    queryHistory.splice(index, 1);
                                    block.setAttribute('data-query-history', JSON.stringify(queryHistory));

                                    // Update the current query to the last one in history
                                    const lastQuery = queryHistory[queryHistory.length - 1] || '';
                                    const outputData = {
                                        status: 'success',
                                        output: "Query received",
                                        query: lastQuery,
                                        block_id: block.id
                                    };
                                    block.dataset.output = JSON.stringify(outputData);

                                    // Update display and propagate changes
                                    updateMessagesDisplay();
                                    propagateData(block);
                                };

                                // Make message clickable to select it
                                messageDiv.onclick = () => {
                                    // Set this as the current query
                                    const outputData = {
                                        status: 'success',
                                        output: "Query received",
                                        query: query,
                                        block_id: block.id
                                    };
                                    block.dataset.output = JSON.stringify(outputData);

                                    // Highlight this message
                                    document.querySelectorAll('.message.selected').forEach(el => {
                                        el.classList.remove('selected');
                                    });
                                    messageDiv.classList.add('selected');

                                    // Propagate this query
                                    propagateData(block);
                                };

                                messageDiv.appendChild(deleteBtn);
                                messages.appendChild(messageDiv);
                            });

                            // Scroll to bottom
                            messages.scrollTop = messages.scrollHeight;
                        } catch (e) {
                            console.error('Error updating messages display:', e);
                        }
                    };

                    // Initial display update
                    updateMessagesDisplay();

                    const sendMessage = () => {
                        const text = input.value.trim();
                        if (text) {
                            try {
                                // Add to query history
                                const queryHistory = JSON.parse(block.getAttribute('data-query-history') || '[]');
                                queryHistory.push(text);
                                block.setAttribute('data-query-history', JSON.stringify(queryHistory));

                                // Clear input
                                input.value = '';

                                // Update the output data with the new query
                                const outputData = {
                                    status: 'success',
                                    output: "Query received",
                                    query: text,
                                    block_id: block.id
                                };
                                block.dataset.output = JSON.stringify(outputData);

                                // Update display and propagate
                                updateMessagesDisplay();
                                propagateData(block);
                            } catch (e) {
                                console.error('Error sending message:', e);
                            }
                        }
                    };

                    sendButton.onclick = sendMessage;
                    input.onkeypress = (e) => {
                        if (e.key === 'Enter') sendMessage();
                    };
                }
                break;

            case 'rag_prompt':
                const ragInterface = block.querySelector('.chat-interface');
                if (ragInterface) {
                    const input = ragInterface.querySelector('input');
                    const sendButton = ragInterface.querySelector('button');
                    const messages = ragInterface.querySelector('.chat-messages');

                    const sendMessage = () => {
                        const text = input.value.trim();
                        if (text) {
                            messages.innerHTML += `<div class="message">${text}</div>`;
                            input.value = '';
                            messages.scrollTop = messages.scrollHeight;

                            // Store the message in the block's data and propagate
                            block.dataset.output = text;
                            propagateData(block);
                        }
                    };

                    sendButton.onclick = sendMessage;
                    input.onkeypress = (e) => {
                        if (e.key === 'Enter') sendMessage();
                    };
                }
                break;

            case 'ai_model':
                config.model = block.querySelector('.model-selector').value;
                config.temperature = parseFloat(block.querySelector('.temperature').value);
                config.prompt = block.querySelector('.prompt-template').value;

                // Get query from connected query input block
                const queryConnection = window.connections.find(conn =>
                    conn.target === block.id && conn.inputId === 'Query'
                );
                if (queryConnection) {
                    const queryBlock = document.getElementById(queryConnection.source);
                    if (queryBlock) {
                        const queryText = queryBlock.dataset.output;
                        config.prompt = config.prompt.replace('{query}', queryText || '');
                    }
                }

                // Get context from connected vector store or ranking block
                const contextConnection = window.connections.find(conn =>
                    conn.target === block.id && conn.inputId === 'Context'
                );
                if (contextConnection) {
                    const contextBlock = document.getElementById(contextConnection.source);
                    if (contextBlock) {
                        try {
                            const contextData = JSON.parse(contextBlock.dataset.output);
                            config.prompt = config.prompt.replace('{context}', contextData.context || '');
                        } catch (e) {
                            config.prompt = config.prompt.replace('{context}', contextBlock.dataset.output || '');
                        }
                    }
                }
                break;
        }
    }

    // Revert to the original approach that worked for normal blocks
    function updateConnections() {
        if (!connectionsContainer) return;

        connectionsContainer.innerHTML = '';
        connections.forEach((conn, index) => {
            const sourceBlock = document.getElementById(conn.source);
            const targetBlock = document.getElementById(conn.target);

            if (!sourceBlock || !targetBlock) return;

            // Find the exact output node and input node we need to connect
            const sourceNode = sourceBlock.querySelector('.output-node');
            const targetNode = targetBlock.querySelector(`[data-input="${conn.inputId}"]`);

            if (!sourceNode || !targetNode) return;

            // Get accurate SVG coordinates for each node
            const canvasRect = canvasContainer.getBoundingClientRect();
            const sourceRect = sourceNode.getBoundingClientRect();
            const targetRect = targetNode.getBoundingClientRect();
            
            // Calculate positions with respect to the SVG canvas and zoom level
            const x1 = (sourceRect.left + sourceRect.width/2 - canvasRect.left) / zoom;
            const y1 = (sourceRect.top + sourceRect.height/2 - canvasRect.top) / zoom;
            const x2 = (targetRect.left + targetRect.width/2 - canvasRect.left) / zoom;
            const y2 = (targetRect.top + targetRect.height/2 - canvasRect.top) / zoom;
            
            // Create the SVG line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('class', 'connection-line');
            line.setAttribute('data-connection-index', index);

            line.addEventListener('click', (e) => {
                if (selectedConnection === line) {
                    connections.splice(index, 1);
                    updateConnections();
                    selectedConnection = null;
                } else {
                    if (selectedConnection) {
                        selectedConnection.classList.remove('selected');
                    }
                    selectedConnection = line;
                    line.classList.add('selected');
                }
            });

            connectionsContainer.appendChild(line);
        });
    }
    
    // Make updateConnections available globally
    window.updateConnections = updateConnections;

    // Update the canvas transform function
    function updateCanvasTransform() {
        canvasContainer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${zoom})`;
        zoomLevelDisplay.textContent = `${Math.round(zoom * 100)}%`;
        updateConnections();
        
        // Update miniature map viewport
        const miniMap = document.querySelector('.mini-map');
        const miniMapViewport = document.querySelector('.mini-map-viewport');
        const miniMapSVG = document.querySelector('.mini-map-svg');
        if (miniMap && miniMapViewport && miniMapSVG) {
            const canvasWidth = 10000; // Total canvas width
            const canvasHeight = 10000; // Total canvas height
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            // Calculate the scale factor for the miniature map
            const scaleX = miniMap.offsetWidth / canvasWidth;
            const scaleY = miniMap.offsetHeight / canvasHeight;
            
            // Calculate the viewport position and size in the miniature map
            let viewportX = (-currentTranslate.x / zoom) * scaleX;
            let viewportY = (-currentTranslate.y / zoom) * scaleY;
            let viewportWidthScaled = (viewportWidth / zoom) * scaleX;
            let viewportHeightScaled = (viewportHeight / zoom) * scaleY;

            // Clamp the viewport rectangle so it always stays visible in the mini-map
            if (viewportX < 0) viewportX = 0;
            if (viewportY < 0) viewportY = 0;
            if (viewportX + viewportWidthScaled > miniMap.offsetWidth) viewportX = miniMap.offsetWidth - viewportWidthScaled;
            if (viewportY + viewportHeightScaled > miniMap.offsetHeight) viewportY = miniMap.offsetHeight - viewportHeightScaled;
            // Prevent negative width/height
            if (viewportWidthScaled > miniMap.offsetWidth) {
                viewportX = 0;
                viewportWidthScaled = miniMap.offsetWidth;
            }
            if (viewportHeightScaled > miniMap.offsetHeight) {
                viewportY = 0;
                viewportHeightScaled = miniMap.offsetHeight;
            }
            // Clamp again in case of overflows
            if (viewportX < 0) viewportX = 0;
            if (viewportY < 0) viewportY = 0;

            // Update the viewport rectangle
            miniMapViewport.style.left = `${viewportX}px`;
            miniMapViewport.style.top = `${viewportY}px`;
            miniMapViewport.style.width = `${viewportWidthScaled}px`;
            miniMapViewport.style.height = `${viewportHeightScaled}px`;

            // Render live SVG preview of blocks and connections
            miniMapSVG.innerHTML = '';
            // Draw connections
            connections.forEach(conn => {
                const sourceBlock = document.getElementById(conn.source);
                const targetBlock = document.getElementById(conn.target);
                if (!sourceBlock || !targetBlock) return;
                // Get block positions
                const getBlockCenter = block => {
                    const transform = block.style.transform;
                    const match = /translate\(([-\d.]+)px,\s*([\-\d.]+)px\)/.exec(transform);
                    if (match) {
                        const blockX = parseFloat(match[1]);
                        const blockY = parseFloat(match[2]);
                        // Center of block (approximate)
                        return {
                            x: (blockX + block.offsetWidth / 2) * scaleX,
                            y: (blockY + block.offsetHeight / 2) * scaleY
                        };
                    }
                    return null;
                };
                const src = getBlockCenter(sourceBlock);
                const tgt = getBlockCenter(targetBlock);
                if (src && tgt) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', src.x);
                    line.setAttribute('y1', src.y);
                    line.setAttribute('x2', tgt.x);
                    line.setAttribute('y2', tgt.y);
                    line.setAttribute('stroke', '#888');
                    line.setAttribute('stroke-width', '1.5');
                    line.setAttribute('opacity', '0.7');
                    miniMapSVG.appendChild(line);
                }
            });
            // Draw blocks
            const blocks = blockContainer.querySelectorAll('.block');
            blocks.forEach(block => {
                const transform = block.style.transform;
                const match = /translate\(([-\d.]+)px,\s*([\-\d.]+)px\)/.exec(transform);
                if (match) {
                    const blockX = parseFloat(match[1]);
                    const blockY = parseFloat(match[2]);
                    const miniX = blockX * scaleX;
                    const miniY = blockY * scaleY;
                    const w = Math.max(8, block.offsetWidth * scaleX);
                    const h = Math.max(8, block.offsetHeight * scaleY);
                    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                    rect.setAttribute('x', miniX);
                    rect.setAttribute('y', miniY);
                    rect.setAttribute('width', w);
                    rect.setAttribute('height', h);
                    rect.setAttribute('rx', 2);
                    rect.setAttribute('fill', '#00a67e');
                    rect.setAttribute('stroke', '#fff');
                    rect.setAttribute('stroke-width', '1');
                    rect.setAttribute('opacity', '0.85');
                    miniMapSVG.appendChild(rect);
                }
            });
        }
    }

    Object.entries(actionButtons).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    });

    // Add notification handling
    const notificationBanner = document.getElementById('notification-banner');
    const topBar = document.getElementById('top-bar');
    const closeNotificationBtn = document.querySelector('.close-notification');

    closeNotificationBtn.addEventListener('click', () => {
        notificationBanner.classList.add('notification-hidden');
        topBar.classList.remove('with-notification');
    });

    // Add export button handler
    exportButton.addEventListener('click', exportPipeline);

    function getBlockConfig(block) {
        const type = block.getAttribute('data-block-type');
        const config = {};

        switch (type) {
            case 'pdf_loader':
                const fileInput = block.querySelector('.file-input');
                config.files = Array.from(fileInput.files).map(f => f.name);
                break;

            case 'text_splitter':
                config.chunk_size = parseInt(block.querySelector('.chunk-size').value);
                config.chunk_overlap = parseInt(block.querySelector('.chunk-overlap').value);
                break;

            case 'embedding':
                config.model = block.querySelector('.model-selector').value;
                break;

            case 'chat_model':
                config.model = block.querySelector('.model-selector').value;
                config.temperature = parseFloat(block.querySelector('.temperature').value);
                break;

            case 'rag_prompt':
                config.template = block.querySelector('.prompt-template').value;
                break;

            case 'ai_model':
                config.model = block.querySelector('.model-selector').value;
                config.temperature = parseFloat(block.querySelector('.temperature').value);
                config.prompt = block.querySelector('.prompt-template').value;

                // Get query from connected query input block
                const queryConnection = window.connections.find(conn =>
                    conn.target === block.id && conn.inputId === 'Query'
                );
                if (queryConnection) {
                    const queryBlock = document.getElementById(queryConnection.source);
                    if (queryBlock) {
                        const queryText = queryBlock.dataset.output;
                        config.prompt = config.prompt.replace('{query}', queryText || '');
                    }
                }

                // Get context from connected vector store or ranking block
                const contextConnection = window.connections.find(conn =>
                    conn.target === block.id && conn.inputId === 'Context'
                );
                if (contextConnection) {
                    const contextBlock = document.getElementById(contextConnection.source);
                    if (contextBlock) {
                        try {
                            const contextData = JSON.parse(contextBlock.dataset.output);
                            config.prompt = config.prompt.replace('{context}', contextData.context || '');
                        } catch (e) {
                            config.prompt = config.prompt.replace('{context}', contextBlock.dataset.output || '');
                        }
                    }
                }
                break;
            case 'custom':
                // For custom blocks, get the selected method
                const methodSelect = block.querySelector('.method-select');
                if (methodSelect && methodSelect.value) {
                    config.selected_method = methodSelect.value;
                }

                // Get any parameter values - support both dropdown and text input
                const paramRows = block.querySelectorAll('.parameter-row');
                if (paramRows.length > 0) {
                    config.parameters = {};

                    paramRows.forEach(row => {
                        // Check for dropdown parameter selector first (new style)
                        const nameDropdown = row.querySelector('.param-name-select');
                        const nameInput = row.querySelector('.param-name');
                        const valueInput = row.querySelector('.param-value');

                        let paramName = '';
                        if (nameDropdown && nameDropdown.value) {
                            paramName = nameDropdown.value;
                        } else if (nameInput && nameInput.value) {
                            paramName = nameInput.value;
                        }

                        if (paramName && valueInput) {
                            config.parameters[paramName] = valueInput.value;
                        }
                    });
                }

                // Get the class name
                const className = block.getAttribute('data-class-name');
                if (className) {
                    config.class_name = className;
                }

                // Try to get methods from sessionStorage
                try {
                    const blockId = block.id;
                    const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
                    const blockData = customBlocks.find(b => b.id === blockId);

                    if (blockData && blockData.methods) {
                        config.methods = blockData.methods;

                        // If selected_method isn't already set, use the first method or __init__
                        if (!config.selected_method) {
                            const nonInitMethods = blockData.methods.filter(m => m !== '__init__');
                            if (nonInitMethods.length > 0) {
                                config.selected_method = nonInitMethods[0];
                            } else if (blockData.methods.includes('__init__')) {
                                config.selected_method = '__init__';
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Error getting methods from sessionStorage:', e);
                }
                break;
        }

        return config;
    }

    function updateBlockContent(block, type, result) {
        // Store the entire result object in the block's dataset
        block.dataset.output = JSON.stringify(result);

        // Handle specific block types
        if (type === 'query_input') {
            // Update chat interface with the query
            if (result.query) {
                const messagesContainer = block.querySelector('.chat-messages');
                // Store the last query for reference
                block.setAttribute('data-last-query', result.query);
            }
        } else if (type === 'pdf_loader') {
            // Update the block with information about loaded files
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = result.output || 'PDF loaded';
            }
        } else if (type === 'text_splitter') {
            // Update with chunk count information
            const chunksCount = result.chunks ? result.chunks.length : 0;
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = `${chunksCount} chunks created`;
            }
        } else if (type === 'embedding') {
            // Update with embedding count information
            const embeddingsCount = result.embeddings ? result.embeddings.length : 0;
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = `${embeddingsCount} embeddings created`;
            }
        } else if (type === 'vector_store') {
            // Update with retrieved documents information
            const retrievedCount = result.retrieved_chunks ? result.retrieved_chunks.length : 0;
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = `${retrievedCount} documents retrieved`;
            }
        } else if (type === 'ai_model') {
            // Update with answer information
            if (result.answer) {
                const statusText = block.querySelector('.status');
                if (statusText) {
                    statusText.textContent = 'Answer generated';
                }

                // Update the answer display if it exists
                const answerDisplay = block.querySelector('.answer-preview');
                if (answerDisplay) {
                    answerDisplay.textContent = result.answer.length > 100
                        ? result.answer.substring(0, 100) + '...'
                        : result.answer;
                }
            }
        } else if (type === 'answer_display') {
            // Update the answer display
            const display = block.querySelector('.answer-display');
            if (display) {
                if (result.answer) {
                    display.textContent = result.answer;
                } else if (result.output) {
                    display.textContent = result.output;
                }
            }
        } else if (type === 'retrieval_ranking') {
            // Update with ranked documents information
            const rankedCount = result.ranked_chunks ? result.ranked_chunks.length : 0;
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = `${rankedCount} documents ranked`;
            }
        } else if (type.startsWith('custom_')) {
            // Handle custom blocks
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = result.output || 'Processed successfully';
            }
        }
    }

    // Make a block draggable
    function makeBlockDraggable(block) {
        const dragHandle = block.querySelector('.block-drag-handle');
        if (!dragHandle) return;
        
        dragHandle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left mouse button
            
            block.classList.add('dragging');
            block.style.zIndex = '1000';
            
            const startX = e.clientX;
            const startY = e.clientY;
            
            // Calculate block's current position from transform
            const transform = window.getComputedStyle(block).transform;
            let translateX = 0, translateY = 0;
            
            if (transform !== 'none') {
                const matrix = new DOMMatrixReadOnly(transform);
                translateX = matrix.m41;
                translateY = matrix.m42;
            }
            
            // Create a throttled update function to prevent too many updates
            const throttledUpdate = throttle(() => {
                // Force browser to recalculate layout before updating connections
                void document.body.offsetHeight; 
                
                // Use requestAnimationFrame for smooth updating
                requestAnimationFrame(() => {
                    updateConnections();
                });
            }, 16); // ~60fps
            
            const mouseMoveHandler = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                block.style.transform = `translate(${translateX + dx}px, ${translateY + dy}px)`;
                
                // Update connections in real-time during drag with throttling for performance
                throttledUpdate();
                
                e.preventDefault();
            };
            
            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                block.classList.remove('dragging');
                block.style.zIndex = '1';
                
                // Final update without throttling to ensure accuracy
                void document.body.offsetHeight; // Force reflow
                updateConnections();
            };
            
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            e.preventDefault();
        });
    }

    // Setup node connections for a block
    function setupNodeConnections(block) {
        const outputNodes = block.querySelectorAll('.output-node');
        const inputNodes = block.querySelectorAll('.input-node');

        outputNodes.forEach(outputNode => {
            outputNode.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                draggingConnection = true;
                sourceNode = outputNode;

                const nodeRect = outputNode.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();

                // Calculate node center in ABSOLUTE document coordinates
                const nodeCenterX = nodeRect.left + (nodeRect.width / 2);
                const nodeCenterY = nodeRect.top + (nodeRect.height / 2);
                
                // Convert to SVG coordinates with zoom compensation
                const x1 = ((nodeCenterX - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
                const y1 = ((nodeCenterY - canvasRect.top) / zoom) - (currentTranslate.y / zoom);

                tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                tempConnection.setAttribute('x1', x1);
                tempConnection.setAttribute('y1', y1);
                tempConnection.setAttribute('x2', x1);
                tempConnection.setAttribute('y2', y1);
                tempConnection.setAttribute('class', 'connection-line dragging');
                connectionsContainer.appendChild(tempConnection);
            });
        });

        inputNodes.forEach(inputNode => {
            inputNode.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            inputNode.addEventListener('mouseover', (e) => {
                if (draggingConnection && sourceNode) {
                    const sourceBlock = sourceNode.closest('.block');
                    const targetBlock = inputNode.closest('.block');
                    if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                        hoveredInputNode = inputNode;
                        inputNode.classList.add('input-node-hover');
                        // Add an effect to better visualize the potential connection
                        if (tempConnection) {
                            tempConnection.classList.add('connection-hover');
                        }
                        e.stopPropagation();
                    }
                }
            });

            inputNode.addEventListener('mouseout', (e) => {
                if (hoveredInputNode === inputNode) {
                    hoveredInputNode = null;
                    inputNode.classList.remove('input-node-hover');
                    // Remove the connection hover effect
                    if (tempConnection) {
                        tempConnection.classList.remove('connection-hover');
                    }
                    e.stopPropagation();
                }
            });
        });
    }

    // Function to handle block deletion and clean up connections
    function deleteBlockConnections(block) {
        const blockId = block.id;

        // Remove all connections to/from this block
        window.connections = window.connections.filter(conn =>
            conn.source !== blockId && conn.target !== blockId
        );

        // Update the visual connections
        updateConnections();
    }

    // Mini-map interactive navigation
    const miniMap = document.querySelector('.mini-map');
    const miniMapViewport = document.querySelector('.mini-map-viewport');
    let isDraggingMiniMapViewport = false;
    let miniMapDragOffset = { x: 0, y: 0 };

    if (miniMap && miniMapViewport) {
        // Helper to get scale factors
        function getMiniMapScale() {
            const canvasWidth = 10000;
            const canvasHeight = 10000;
            return {
                scaleX: miniMap.offsetWidth / canvasWidth,
                scaleY: miniMap.offsetHeight / canvasHeight
            };
        }

        // Click to pan
        miniMap.addEventListener('mousedown', (e) => {
            // Only left mouse button
            if (e.button !== 0) return;
            // If clicking on the viewport, start drag
            if (e.target === miniMapViewport) {
                isDraggingMiniMapViewport = true;
                miniMapDragOffset.x = e.offsetX;
                miniMapDragOffset.y = e.offsetY;
                document.body.style.userSelect = 'none';
            } else {
                // Only pan if not clicking on the viewport rectangle
                if (!isDraggingMiniMapViewport) {
                    const rect = miniMap.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    const { scaleX, scaleY } = getMiniMapScale();
                    // Center the main canvas on the clicked point
                    currentTranslate.x = -((x / scaleX) - (window.innerWidth / (2 * zoom)));
                    currentTranslate.y = -((y / scaleY) - (window.innerHeight / (2 * zoom)));
                    updateCanvasTransform();
                }
            }
        });

        // Drag the viewport rectangle
        document.addEventListener('mousemove', (e) => {
            if (isDraggingMiniMapViewport) {
                const rect = miniMap.getBoundingClientRect();
                const { scaleX, scaleY } = getMiniMapScale();
                let x = e.clientX - rect.left - miniMapDragOffset.x + miniMapViewport.offsetWidth / 2;
                let y = e.clientY - rect.top - miniMapDragOffset.y + miniMapViewport.offsetHeight / 2;
                // Clamp to mini-map bounds
                x = Math.max(0, Math.min(x, miniMap.offsetWidth));
                y = Math.max(0, Math.min(y, miniMap.offsetHeight));
                // Pan the main canvas so the viewport is centered at (x, y)
                currentTranslate.x = -((x / scaleX) - (window.innerWidth / (2 * zoom)));
                currentTranslate.y = -((y / scaleY) - (window.innerHeight / (2 * zoom)));
                updateCanvasTransform();
            }
        });
        document.addEventListener('mouseup', () => {
            isDraggingMiniMapViewport = false;
            document.body.style.userSelect = '';
        });
    }

    // Add global event listener for the fit-to-view button
    document.addEventListener('click', function(e) {
        const target = e.target.closest('#fit-to-view, .fit-to-view-button');
        if (target) {
            fitAllBlocksToView();
        }
    });

    // Function to fit all blocks to view
    function fitAllBlocksToView() {
        console.log("Fitting all blocks to view");
        const blocks = document.querySelectorAll('.block');
        if (blocks.length === 0) {
            showToast("No blocks to fit", "info");
            return;
        }

        try {
            // Calculate the bounds of all blocks in their current positions
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            blocks.forEach(block => {
                // Get block position from transform
                const transform = block.style.transform;
                const match = /translate\(([-\d.]+)px,\s*([\-\d.]+)px\)/.exec(transform);
                if (match) {
                    const x = parseFloat(match[1]);
                    const y = parseFloat(match[2]);
                    const width = block.offsetWidth;
                    const height = block.offsetHeight;

                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x + width);
                    maxY = Math.max(maxY, y + height);
                }
            });

            if (minX === Infinity) {
                console.log("Could not determine block bounds");
                return;
            }

            // Add padding
            const padding = 50;
            minX -= padding;
            minY -= padding;
            maxX += padding;
            maxY += padding;

            // Calculate dimensions
            const width = maxX - minX;
            const height = maxY - minY;
            const centerX = minX + (width / 2);
            const centerY = minY + (height / 2);

            // Calculate scale to fit
            const canvasWidth = canvas.offsetWidth;
            const canvasHeight = canvas.offsetHeight;
            const scaleX = canvasWidth / width;
            const scaleY = canvasHeight / height;
            const newZoom = Math.min(scaleX, scaleY, 1.5);

            // Important: Just like the zoom buttons, ONLY update these two variables
            // and let updateCanvasTransform do all the work
            zoom = newZoom;
            currentTranslate.x = (canvasWidth / 2) - (centerX * zoom);
            currentTranslate.y = (canvasHeight / 2) - (centerY * zoom);

            // Do NOT set any global flags or variables that might interfere with the
            // well-functioning drag and drop functionality

            // Use the same function that the zoom buttons use
            updateCanvasTransform();

            showToast("Adjusted view to fit all blocks", "success");
        } catch (e) {
            console.error("Error in fitAllBlocksToView:", e);
            showToast("Could not fit blocks to view", "error");
        }
    }

    // Handle block dragging with zoom compensation
    function initBlockDragging() {
        let isDragging = false;
        let currentBlock = null;
        let startX, startY;
        let blockStartX, blockStartY;

        // Function to handle block mousedown event
        document.addEventListener('mousedown', function(e) {
            // Check if target is a block drag handle
            const dragHandle = e.target.closest('.block-drag-handle');
            if (!dragHandle) return;

            const block = dragHandle.closest('.block');
            if (!block) return;

            // Start dragging
            isDragging = true;
            currentBlock = block;
            
            // Mark the block as being dragged - critical for connection positioning
            block.classList.add('dragging');
            block.setAttribute('data-dragging', 'true');
            document.body.setAttribute('data-block-dragging', block.id);

            // Get current block position from its transform style
            const transform = window.getComputedStyle(block).transform;
            const matrix = new DOMMatrixReadOnly(transform);
            blockStartX = matrix.m41;
            blockStartY = matrix.m42;

            // Get mouse position in screen coordinates
            startX = e.clientX;
            startY = e.clientY;

            // Set cursor and add dragging class
            document.body.style.cursor = 'grabbing';
            block.style.zIndex = '1000';

            // Prevent default to avoid text selection
            e.preventDefault();
        });

        // Function to handle block mousemove event
        document.addEventListener('mousemove', function(e) {
            if (!isDragging || !currentBlock) return;

            // Calculate the mouse movement delta in screen coordinates
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            // Apply the delta, adjusted for zoom level to maintain proper scaling
            const newX = blockStartX + (deltaX / zoom);
            const newY = blockStartY + (deltaY / zoom);

            // Apply the new position
            currentBlock.style.transform = `translate(${newX}px, ${newY}px)`;

            // Update connections with every move to keep them accurate
            updateConnections();
        });

        // Function to handle block mouseup event
        document.addEventListener('mouseup', function() {
            if (!isDragging) return;

            isDragging = false;
            if (currentBlock) {
                currentBlock.classList.remove('dragging');
                currentBlock.removeAttribute('data-dragging');
                document.body.removeAttribute('data-block-dragging');
                currentBlock.style.zIndex = '1';
                currentBlock = null;
                
                // Final update to ensure connections are correct
                updateConnections();
            }
            document.body.style.cursor = '';
        });
    }

    // Initialize block dragging
    initBlockDragging();

    // Simple welcome message handler
    const welcomeMessage = document.getElementById('welcome-message');
    if (welcomeMessage) {
        // Hide message when a block is created
        document.addEventListener('DOMNodeInserted', function(e) {
            if (e.target && e.target.classList && e.target.classList.contains('block')) {
                welcomeMessage.style.display = 'none';
            }
        }, true);
    }

    // Function to ensure custom blocks have proper node setup
    function setupCustomBlock(block) {
        console.log('Setting up custom block:', block.id);

        // Make sure the block is draggable
        makeBlockDraggable(block);

        // Set up node connections
        setupNodeConnections(block);

        // Position block on canvas if not already positioned
        if (!block.style.transform) {
            const canvas = document.querySelector('.canvas-container');
            if (canvas) {
                const canvasRect = canvas.getBoundingClientRect();
                const x = (Math.random() * 200) + 100;
                const y = (Math.random() * 200) + 100;
                block.style.transform = `translate(${snapToGrid(x)}px, ${snapToGrid(y)}px)`;
            }
        }

        return block;
    }

});

