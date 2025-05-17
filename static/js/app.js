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

    // At the top of the file, add a variable to track when the template handler's override has been applied
    let blockDragHandlersOverridden = false;

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
        console.log('Starting export process...');
        showProgress(true, 'Exporting Pipeline', 'Starting export process');

        try {
            // Validate the pipeline before exporting
            if (!validatePipeline()) {
                showProgress(false);
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
                        try {
                            const customBlocks = JSON.parse(sessionStorage.getItem('customBlocks') || '[]');
                            const blockData = customBlocks.find(b => b.id === blockId || b.className === className);

                            moduleInfo = {
                                module: blockData.moduleInfo.module,
                                library: blockData.moduleInfo.library
                            };

                        } catch (e) {
                        console.warn('Error finding module info in sessionStorage:', e);
                        }
                            // Create a custom type identifier
                        const modulePath = moduleInfo.module;
                        finalBlockType = `custom_${modulePath}.${className}`;

                    }

                    // Generate configuration for this block
                    blockConfigs[blockId] = {
                        type: finalBlockType,
                        config: getBlockConfig(block)
                    };
                });

                // Format connections for the server
                const formattedConnections = window.connections.map(conn => {
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

                // Log the formatted connections for debugging
                console.log('Formatted connections for export:', formattedConnections);

                updateProgress(50, 'Sending pipeline data to server');
            // Call the export API
                const response = await fetch('/api/blocks/export', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        blocks: blockConfigs,
                        connections: formattedConnections,
                        output_file: 'generated_pipeline.py'
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Failed to export pipeline');
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

                updateProgress(100, 'Export complete');

                // Hide progress after a short delay
                setTimeout(() => {
                    showProgress(false);
                    showToast('Pipeline exported successfully', 'success');
                }, 1000);

                return result.code;
            } catch (error) {
                console.error('Export error:', error);
                showProgress(false);
                showToast(`Export failed: ${error.message}`, 'error');
                throw error;
            }
        } catch (error) {
            console.error('Export error:', error);
            showProgress(false);
            showToast(`Export failed: ${error.message}`, 'error');
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
            // Clear any text selection
            window.getSelection().removeAllRanges();
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

        // Ensure connection updates happen during ANY block drag
        if (document.querySelector('.block.dragging')) {
            updateConnections();
        }
        
        if (isDraggingBlock && draggedBlock) {
            const rect = canvas.getBoundingClientRect();

            // Calculate position relative to canvas, correctly accounting for zoom and pan
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

    // Improve the createConnection function to better handle method nodes
    function createConnection(source, target, inputId, options = {}) {
        // Ensure source and target exist
        if (!source || !target || !inputId) {
            console.error("Missing required parameters for connection creation");
            return null;
        }

        // Get source node (output node)
        let sourceNode = null;
        let sourceMethod = null;
        
        if (options.sourceNode) {
            // If a specific source node was provided, use it
            sourceNode = options.sourceNode;
        } else {
            // Otherwise get the default output node
            const outputElem = source.querySelector('.output-node');
            if (outputElem) {
                sourceNode = outputElem.getAttribute('data-output');
            }
        }

        // Extract method information
        if (sourceNode && sourceNode.includes('_output')) {
            sourceMethod = sourceNode.split('_output')[0];
        } else if (options.sourceMethod) {
            sourceMethod = options.sourceMethod;
        }

        // Extract target method from inputId
        let targetMethod = null;
        if (inputId && inputId.includes('_input')) {
            targetMethod = inputId.split('_input')[0];
        }

        // Create a complete connection object
        const connection = {
            source: source.id,
            target: target.id,
            inputId: inputId,
            sourceNode: sourceNode,
            sourceMethod: sourceMethod,
            targetMethod: targetMethod
        };

        console.log("Creating connection with details:", connection);

        // Add to connections array
        if (!window.connections) window.connections = [];
        window.connections.push(connection);

        // Save to sessionStorage
        try {
            sessionStorage.setItem('connections', JSON.stringify(window.connections));
        } catch (err) {
            console.warn('Error saving connections to sessionStorage:', err);
        }

        // Update visual connections
        updateConnections();
        
        return connection;
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

    // Revert to the original approach that worked for normal blocks
    function updateConnections() {
        const connectionsContainer = document.getElementById('connections');
        connectionsContainer.innerHTML = '';

        window.connections.forEach(connection => {
            const sourceBlock = document.getElementById(connection.source);
            const targetBlock = document.getElementById(connection.target);

            if (!sourceBlock || !targetBlock) {
                return;
            }

            // Determine output node based on the connection source node if available
            let outputNode;
            if (connection.sourceNode) {
                // Use the specified source node
                outputNode = sourceBlock.querySelector(`.output-node[data-output="${connection.sourceNode}"]`);
            } else if (connection.sourceMethod) {
                // Try to find by method
                outputNode = sourceBlock.querySelector(`.output-node[data-output="${connection.sourceMethod}_output"]`);
            } else {
                // Default to the first output node
                outputNode = sourceBlock.querySelector('.output-node');
            }

            if (!outputNode) {
                return;
            }

            // Determine input node from connection inputId
            let inputNode;
            if (connection.inputId) {
                inputNode = targetBlock.querySelector(`.input-node[data-input="${connection.inputId}"]`);
            }

            if (!inputNode) {
                // Fallback to first input node if we couldn't find a matching one
                inputNode = targetBlock.querySelector('.input-node');
            }

            if (!inputNode) {
                return;
            }

            const svgLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');

            // Get positions of nodes
            const outputRect = outputNode.getBoundingClientRect();
            const inputRect = inputNode.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();

            // Calculate positions
            const x1 = ((outputRect.right - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
            const y1 = ((outputRect.top + outputRect.height/2 - canvasRect.top) / zoom) - (currentTranslate.y / zoom);
            const x2 = ((inputRect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom);
            const y2 = ((inputRect.top + inputRect.height/2 - canvasRect.top) / zoom) - (currentTranslate.y / zoom);

            // Use straight line instead of curve
            const d = `M ${x1} ${y1} L ${x2} ${y2}`;

            svgLine.setAttribute('d', d);
            svgLine.setAttribute('class', 'connection-line');
            svgLine.setAttribute('data-source', connection.source);
            svgLine.setAttribute('data-target', connection.target);

            // Store original connection data for later reference
            svgLine.dataset.connection = JSON.stringify(connection);

            connectionsContainer.appendChild(svgLine);

            // Add delete button on hover
            svgLine.addEventListener('mouseover', () => {
                // Check if a delete button already exists
                if (document.querySelector('.connection-delete-btn')) {
                    return;
                }

                const deleteBtn = document.createElement('div');
                deleteBtn.className = 'connection-delete-btn';
                deleteBtn.innerHTML = '×';
                deleteBtn.style.position = 'absolute';

                // Position the delete button at the middle of the curve
                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                deleteBtn.style.left = `${midX}px`;
                deleteBtn.style.top = `${midY}px`;

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    
                    // Get the connection data from the line
                    const connData = JSON.parse(svgLine.dataset.connection);
                    
                    // Remove the connection from the global connections array
                    window.connections = window.connections.filter(c => 
                        !(c.source === connData.source &&
                          c.target === connData.target &&
                          c.inputId === connData.inputId)
                    );
                    
                    // Save to sessionStorage
                    try {
                        sessionStorage.setItem('connections', JSON.stringify(window.connections));
                    } catch (err) {
                        console.warn('Error saving connections to sessionStorage:', err);
                    }
                    
                    // Update the visual connections
                    updateConnections();
                    
                    // Remove the delete button
                    deleteBtn.remove();
                });

                canvas.appendChild(deleteBtn);

                // Use a more reliable method to handle button visibility
                let isOverConnection = false;
                let isOverButton = false;

                svgLine.addEventListener('mouseout', () => {
                    isOverConnection = false;
                    setTimeout(() => {
                        if (!isOverButton && !isOverConnection) {
                            deleteBtn.remove();
                        }
                    }, 100);
                });

                svgLine.addEventListener('mouseover', () => {
                    isOverConnection = true;
                });

                deleteBtn.addEventListener('mouseover', () => {
                    isOverButton = true;
                });

                deleteBtn.addEventListener('mouseout', () => {
                    isOverButton = false;
                    setTimeout(() => {
                        if (!isOverButton && !isOverConnection) {
                            deleteBtn.remove();
                        }
                    }, 100);
                });
            });
        });
    }

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

    // Define action buttons for the UI
    const actionButtons = {
        'fit-to-view': function() {
            if (typeof fitAllBlocksToView === 'function') {
                fitAllBlocksToView();
            }
        },
        'zoom-in': function() {
            if (zoom < MAX_ZOOM) {
                zoom += ZOOM_SPEED;
                updateCanvasTransform();
            }
        },
        'zoom-out': function() {
            if (zoom > MIN_ZOOM) {
                zoom -= ZOOM_SPEED;
                updateCanvasTransform();
            }
        },
        'zoom-fit': function() {
            zoom = 1;
            currentTranslate = { x: 0, y: 0 };
            updateCanvasTransform();
        }
    };

    // Add event listeners to action buttons
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
            case 'custom':
                // For custom blocks, get the selected method
                const methodSelect = block.querySelector('.method-select');
                if (methodSelect && methodSelect.value) {
                    config.selected_method = methodSelect.value;
                }

                // Get active methods from the method rows
                const methodRows = block.querySelectorAll('.method-row');
                if (methodRows.length > 0) {
                    const activeMethods = Array.from(methodRows).map(row =>
                        row.getAttribute('data-method')
                    ).filter(m => m); // Filter out empty values

                    // Always include __init__ as the first method
                    if (!activeMethods.includes('__init__')) {
                        activeMethods.unshift('__init__');
                    }

                    // Store the active methods in config
                    config.selected_methods = activeMethods;

                    // If no single method is selected, use the first active method
                    if (!config.selected_method && activeMethods.length > 1) {
                        config.selected_method = activeMethods[1]; // Use first non-init method
                    }
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

        
        if (type.startsWith('custom_')) {
            // Handle custom blocks
            const statusText = block.querySelector('.status');
            if (statusText) {
                statusText.textContent = result.output || 'Processed successfully';
            }
        }
    }

    // Modify the makeBlockDraggable function to ensure proper coordination with global handlers
    function makeBlockDraggable(block) {
        const dragHandle = block.querySelector('.block-drag-handle');
        if (!dragHandle) return;
        
        dragHandle.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Only left mouse button
            
            // Set global variables to ensure global mousemove handler works
            isDraggingBlock = true;
            draggedBlock = block;
            
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
            
            // Add the mouseMoveHandler function definition
            const mouseMoveHandler = (e) => {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // Apply new position
                block.style.transform = `translate(${translateX + dx}px, ${translateY + dy}px)`;
                
                // CRITICAL: Update connections on EVERY mouse move
                if (typeof window.updateConnections === 'function') {
                    window.updateConnections();
                }
                
                e.preventDefault();
                e.stopPropagation();
            };
            
            const mouseUpHandler = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
                
                // Reset global variables
                isDraggingBlock = false;
                draggedBlock = null;
                
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

        // We don't need to add a mouseup handler here because it's already handled
        // in the global document mouseup event listener
    }

    /**
     * Set up event delegation for handling method row interactions
     * @param {HTMLElement} block - The block to set up method row handling for
     */
    function setupBlockMethodRowsHandling(block) {
        // Use event delegation for method select changes
        const methodSelect = block.querySelector('.method-select');
        if (methodSelect) {
            // Event listener is likely already set in createCustomBlock
            // But we'll add a handler to ensure node connections are properly set up
            methodSelect.addEventListener('change', () => {
                // After a short delay to allow DOM to update
                setTimeout(() => {
                    // Setup node connections for any new nodes added by method row
                    setupNodeConnections(block);
                    // Update connections display
                    updateConnections();
                }, 100);
            });
        }

        // Use event delegation for the block content to handle method row removals
        const blockContent = block.querySelector('.block-content');
        if (blockContent) {
            blockContent.addEventListener('click', (e) => {
                // Find if clicked element is a remove method button
                const removeBtn = e.target.closest('.remove-method-btn');
                if (removeBtn) {
                    // After a short delay to allow DOM to update after removal
                    setTimeout(() => {
                        // Setup node connections for any remaining nodes
                        setupNodeConnections(block);
                        // Update connections display
                        updateConnections();
                        // Update the block's layout to ensure evenly spaced nodes
                        if (typeof updateBlockNodesForMethods === 'function') {
                            updateBlockNodesForMethods(block);
                        }
                    }, 100);
                }
            });
        }
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

            // Set these flags to ensure global mousemove handler works too
            isDraggingBlock = true;
            draggedBlock = block;
            
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

        // Set up method row handling for the block
        setupBlockMethodRowsHandling(block);

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

        // Always ensure nodes are properly positioned as the final step
        if (typeof updateBlockNodesForMethods === 'function') {
            // If the block seems to have no height yet, wait a moment for rendering
            if (block.offsetHeight < 20) {
                setTimeout(() => updateBlockNodesForMethods(block), 100);
            } else {
                updateBlockNodesForMethods(block);
            }
            
            // Also queue an additional positioning after a delay to handle
            // cases where methods are loaded asynchronously
            setTimeout(() => {
                if (typeof updateBlockNodesForMethods === 'function') {
                    updateBlockNodesForMethods(block);
                    // Update connections to reflect node positions
                    if (typeof updateConnections === 'function') {
                        updateConnections();
                    }
                }
            }, 500);
        }

        return block;
    }

    // Click handler to clear text selection when clicking on canvas
    canvas.addEventListener('mousedown', (e) => {
        // Only clear selection if clicking directly on canvas (not on a block)
        if (e.target === canvas) {
            window.getSelection().removeAllRanges();
        }
    });

});

