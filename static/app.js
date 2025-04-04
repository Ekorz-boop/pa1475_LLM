document.addEventListener('DOMContentLoaded', () => {
    const menuItems = document.querySelectorAll('.menu-item');
    const subMenus = document.querySelectorAll('.sub-menu');

    // Initialize custom block handler
    const customBlockHandler = new CustomBlockHandler();

    // Connect create custom block button to show modal
    document.getElementById('create-custom-block-btn')?.addEventListener('click', () => {
        customBlockHandler.showModal();
    });

    // Add export button handler
    const exportButton = document.getElementById('export-pipeline');
    console.log('Export button found:', exportButton); // Debug log
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            console.log('Export button clicked'); // Debug log
            exportPipeline();
        });
    } else {
        console.error('Export button not found in the DOM'); // Debug log
    }

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();

            // Remove active class from all menu items
            menuItems.forEach(mi => mi.classList.remove('active'));

            // Add active class to clicked menu item
            item.classList.add('active');

            const menuType = item.dataset.menu;
            const targetMenu = document.getElementById(`${menuType}-menu`);
            const sidebar = document.getElementById('sidebar');

            // Close all open sub-menus
            subMenus.forEach(menu => {
                if (menu.classList.contains('active')) {
                    menu.classList.remove('active');
                    sidebar.classList.remove('menu-active');
                }
            });

            // Open selected sub-menu
            if (targetMenu) {
                targetMenu.classList.add('active');
                sidebar.classList.add('menu-active');
            }
        });
    });

    // Close sub-menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.sub-menu') && !e.target.closest('.menu-item')) {
            subMenus.forEach(menu => menu.classList.remove('active'));
            menuItems.forEach(item => item.classList.remove('active'));
            document.getElementById('sidebar').classList.remove('menu-active');
        }
    });

    const canvas = document.getElementById('canvas');
    const connectionsContainer = document.getElementById('connections');
    const blockTemplates = document.querySelectorAll('.block-template');
    const runAllButton = document.getElementById('run-all');
    const searchInput = document.getElementById('block-search');
    let blockCounter = 1;
    let connections = [];
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

    // Run all blocks button
    runAllButton.addEventListener('click', () => {
        runPipeline();
    });

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

    // Update the runPipeline function
    async function runPipeline() {
        showProgress(true, 'Running Pipeline', 'Analyzing pipeline structure...');
        const blocks = document.querySelectorAll('.block');
        const totalBlocks = blocks.length;
        let processedBlocks = 0;

        try {
            // First validate the pipeline
            const validationResult = validatePipeline();
            if (!validationResult.valid) {
                showToast(validationResult.error, 'error');
                showProgress(false);
                return;
            }

            // Process blocks in order
            for (const block of blocks) {
                const type = block.getAttribute('data-block-type');
                updateProgress(
                    (processedBlocks / totalBlocks) * 100,
                    `Processing ${type} block...`
                );

                try {
                    await processBlock(block);
                    processedBlocks++;
                } catch (error) {
                    showToast(`Error in ${type} block: ${error.message}`, 'error');
                    showProgress(false);
                    return;
                }
            }

            updateProgress(100, 'Pipeline completed successfully!');
            setTimeout(() => {
                showProgress(false);
                showToast('Pipeline executed successfully!', 'success');
            }, 1000);
        } catch (error) {
            showToast(`Pipeline error: ${error.message}`, 'error');
            showProgress(false);
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
                    connections: connections,
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
        const outgoingConnections = connections.filter(conn => conn.source === sourceId);

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

    // When a custom block template is dropped on the canvas
    canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const blockType = e.dataTransfer.getData('text/plain');

        if (blockType) {
            const rect = canvas.getBoundingClientRect();
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

                // Make sure the block is properly set up
                setupCustomBlock(newBlock);

                // Add to canvas
                blockContainer.appendChild(newBlock);
            } else {
                // Regular block
                const block = createBlock(blockType, x, y);
                if (block && blockType.startsWith('custom_')) {
                    setupCustomBlock(block);
                }
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
        if (e.button === 1 || (e.button === 0 && e.altKey)) {
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
            // Calculate position relative to canvas, accounting for zoom and pan
            const x = (e.clientX - rect.left - currentTranslate.x) / zoom - dragOffset.x;
            const y = (e.clientY - rect.top - currentTranslate.y) / zoom - dragOffset.y;

            draggedBlock.style.transform = `translate(${snapToGrid(x)}px, ${snapToGrid(y)}px)`;
            updateConnections();

            e.preventDefault();
        }

        if (draggingConnection && tempConnection && sourceNode) {
            const canvasRect = canvas.getBoundingClientRect();
            const sourceRect = sourceNode.getBoundingClientRect();

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
                }
            } else if (hoveredInputNode) {
                hoveredInputNode.classList.remove('input-node-hover');
                hoveredInputNode = null;
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
            console.log('Connection dragging ended');
            const elemUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            console.log('Element under mouse:', elemUnderMouse);

            if (elemUnderMouse && elemUnderMouse.classList.contains('input-node') && sourceNode) {
                console.log('Found input node under mouse');
                const sourceBlock = sourceNode.closest('.block');
                const targetBlock = elemUnderMouse.closest('.block');
                console.log('Source block:', sourceBlock ? sourceBlock.id : 'none');
                console.log('Target block:', targetBlock ? targetBlock.id : 'none');

                if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                    const inputId = elemUnderMouse.getAttribute('data-input');
                    console.log('Input ID:', inputId);
                    removeConnectionsToInput(targetBlock.id, inputId);
                    createConnection(sourceBlock, targetBlock, inputId);
                    console.log('Connection created between', sourceBlock.id, 'and', targetBlock.id);
                } else {
                    console.log('Invalid connection - same block or missing block');
                }
            } else {
                console.log('No valid input node found under mouse or source node is missing');
                if (!sourceNode) {
                    console.log('Source node is null - this should not happen');
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
        connections = connections.filter(conn => {
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
        connections = connections.filter(conn => {
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

        connections.push(connection);
        updateConnections();

        // Send the connection to the server API
        fetch('/api/blocks/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: source.id,
                target: target.id
            })
        }).catch(error => {
            console.error('Error connecting blocks on server:', error);
        });

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
        makeBlockDraggable(block);

        // Add connection handling for input and output nodes
        setupNodeConnections(block);

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

        console.log(`Created new block: ${type} with ID ${block.id}`);
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
                const queryConnection = connections.find(conn =>
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
                const contextConnection = connections.find(conn =>
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

    // Update the updateConnections function
    function updateConnections() {
        if (!connectionsContainer) return;

        connectionsContainer.innerHTML = '';
        connections.forEach((conn, index) => {
            const sourceBlock = document.getElementById(conn.source);
            const targetBlock = document.getElementById(conn.target);

            if (!sourceBlock || !targetBlock) return;

            const sourceNode = sourceBlock.querySelector('.output-node');
            const targetNode = targetBlock.querySelector(`[data-input="${conn.inputId}"]`);

            if (!sourceNode || !targetNode) return;

            const sourceRect = sourceNode.getBoundingClientRect();
            const targetRect = targetNode.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();

            // Calculate positions accounting for canvas transform
            const x1 = ((sourceRect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom) + sourceNode.offsetWidth/2;
            const y1 = ((sourceRect.top - canvasRect.top) / zoom) - (currentTranslate.y / zoom) + sourceNode.offsetHeight/2;
            const x2 = ((targetRect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom) + targetNode.offsetWidth/2;
            const y2 = ((targetRect.top - canvasRect.top) / zoom) - (currentTranslate.y / zoom) + targetNode.offsetHeight / 2;

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

    // Update the canvas transform function
    function updateCanvasTransform() {
        canvasContainer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${zoom})`;
        zoomLevelDisplay.textContent = `${Math.round(zoom * 100)}%`;
        updateConnections();
    }

    // System Management Panel
    const managementButton = document.getElementById('management-button');
    const managementPanel = document.getElementById('system-management');


    if (!managementButton || !managementPanel) {
        console.error('Management panel elements not found!');
        return;
    }

    // Management panel event listeners

    managementButton.addEventListener('click', () => {
        managementPanel.classList.add('visible');
        updateSystemStatus();
    });

    managementPanel.querySelector('.close-button').addEventListener('click', () => {
        managementPanel.classList.remove('visible');
    });

    // Initialize action buttons
    const actionButtons = {
        'install-ollama': installOllama,
        'ollama-guide': showOllamaGuide,
        'clear-temp': clearTemp,
        'remove-models': removeModels
    };

    Object.entries(actionButtons).forEach(([id, handler]) => {
        const button = document.getElementById(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    });

    // Check Ollama status periodically
    checkOllamaStatus();
    setInterval(checkOllamaStatus, 30000); // Check every 30 seconds

    function showOllamaGuide() {
        const system = navigator.platform.toLowerCase();
        let instructions = '';

        if (system.includes('win')) {
            instructions =
                '1. Open the Start menu\n' +
                '2. Search for "Ollama"\n' +
                '3. Click on the Ollama application to start it\n\n' +
                'Note: The Ollama icon should appear in your system tray when running.';
        } else if (system.includes('mac')) {
            instructions =
                '1. Open Terminal (you can find it in Applications > Utilities)\n' +
                '2. Type: ollama serve\n' +
                '3. Press Enter\n\n' +
                'Note: Keep the Terminal window open while using Ollama.';
        } else {
            instructions =
                '1. Open a terminal\n' +
                '2. Type: ollama serve\n' +
                '3. Press Enter\n\n' +
                'Note: Keep the terminal window open while using Ollama.';
        }

        alert('How to Start Ollama:\n\n' + instructions);
    }

    async function updateSystemStatus() {
        try {
            const response = await fetch('/api/system/status');
            const data = await response.json();
            const ollamaStatus = document.getElementById('ollama-status');

            if (data.ollama_status === 'running') {
                ollamaStatus.textContent = 'Running';
                ollamaStatus.className = 'status-value running';
                // Update both models list and model selectors
                await Promise.all([updateModelsList(), updateModelSelectors()]);
            } else {
                ollamaStatus.textContent = 'Not Running';
                ollamaStatus.className = 'status-value not-running';
                document.getElementById('ollama-models').innerHTML = 'Ollama must be running to view models';
            }
        } catch (error) {
            console.error('Failed to check Ollama status:', error);
        }
    }

    function updateStatusDisplay(elementId, status) {
        const element = document.getElementById(elementId);
        element.className = 'status-value ' + status;

        switch(status) {
            case 'running':
                element.textContent = 'Running';
                break;
            case 'not_running':
                element.textContent = 'Not Running';
                break;
            case 'installed':
                element.textContent = 'Installed';
                break;
            case 'not_installed':
                element.textContent = 'Not Installed';
                break;
            case 'downloading':
                element.textContent = 'Downloading...';
                break;
        }
    }

    function updateStorageDisplay(storage) {
        document.getElementById('storage-usage').textContent =
            formatBytes(storage.models_size);
        document.getElementById('temp-files').textContent =
            formatBytes(storage.temp_size);
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async function installOllama() {
        const button = document.getElementById('install-ollama');
        button.disabled = true;

        try {
            const response = await fetch('/api/system/install-ollama', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.status === 'manual_install_required') {
                window.open(data.download_url, '_blank');
                alert('Please download and install Ollama from the opened page.');
            } else if (data.status === 'success') {
                alert('Ollama installed successfully! Please restart the application.');
            }
        } catch (error) {
            alert('Failed to install Ollama: ' + error.message);
        } finally {
            button.disabled = false;
            updateSystemStatus();
        }
    }

    // Add notification handling
    const notificationBanner = document.getElementById('notification-banner');
    const topBar = document.getElementById('top-bar');
    const openManagementBtn = document.getElementById('open-management');
    const closeNotificationBtn = document.querySelector('.close-notification');

    function checkOllamaStatus() {
        fetch('/api/system/status')
            .then(response => response.json())
            .then(data => {
                if (data.ollama_status === 'not_running') {
                    notificationBanner.classList.remove('notification-hidden');
                    topBar.classList.add('with-notification');
                } else {
                    notificationBanner.classList.add('notification-hidden');
                    topBar.classList.remove('with-notification');
                }
            });
    }

    openManagementBtn.addEventListener('click', () => {
        const managementPanel = document.getElementById('system-management');
        managementPanel.classList.add('visible');
        updateSystemStatus();
    });

    closeNotificationBtn.addEventListener('click', () => {
        notificationBanner.classList.add('notification-hidden');
        topBar.classList.remove('with-notification');
    });

    // Check Ollama status periodically
    checkOllamaStatus();
    setInterval(checkOllamaStatus, 30000); // Check every 30 seconds

    async function updateModelsList() {
        try {
            const response = await fetch('/api/models/list');
            const data = await response.json();
            const modelsDiv = document.getElementById('ollama-models');

            if (response.ok) {
                if (data.models && data.models.length > 0) {
                    modelsDiv.innerHTML = data.models.map(model => `
                        <div class="model-item">
                            <span class="model-name">${model.name}</span>
                            <span class="model-size">${formatSize(model.size)}</span>
                        </div>
                    `).join('');
                } else {
                    modelsDiv.innerHTML = 'No models installed';
                }
            } else {
                modelsDiv.innerHTML = data.error || 'Failed to load models';
            }
        } catch (error) {
            document.getElementById('ollama-models').innerHTML = 'Failed to load models';
            console.error('Failed to fetch models:', error);
        }
    }

    function formatSize(bytes) {
        if (!bytes) return 'N/A';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    // Add this function to update model selectors when models list changes
    async function updateModelSelectors() {
        try {
            const response = await fetch('/api/models/list');
            const data = await response.json();

            if (response.ok && data.models) {
                const modelSelectors = document.querySelectorAll('.model-selector');
                modelSelectors.forEach(selector => {
                    const currentValue = selector.value;
                    // Clear existing options
                    selector.innerHTML = '';
                    // Add new options
                    data.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.name;
                        option.textContent = model.name;
                        selector.appendChild(option);
                    });
                    // Try to restore previous selection
                    if (data.models.some(m => m.name === currentValue)) {
                        selector.value = currentValue;
                    }
                });
            }
        } catch (error) {
            console.error('Failed to update model selectors:', error);
        }
    }

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
                const queryConnection = connections.find(conn =>
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
                const contextConnection = connections.find(conn =>
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

                // Get any parameter values
                const paramRows = block.querySelectorAll('.parameter-row');
                if (paramRows.length > 0) {
                    config.parameters = {};

                    paramRows.forEach(row => {
                        const nameInput = row.querySelector('.param-name');
                        const valueInput = row.querySelector('.param-value');

                        if (nameInput && valueInput && nameInput.value) {
                            config.parameters[nameInput.value] = valueInput.value;
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
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // Only left mouse button
                isDraggingBlock = true;
                draggedBlock = block;

                // Calculate offset from the mouse to the block's top-left corner
                const rect = block.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                dragOffset.x = (e.clientX - rect.left) / zoom;
                dragOffset.y = (e.clientY - rect.top) / zoom;

                block.style.zIndex = '1000';
                e.preventDefault();
                e.stopPropagation();
            });
        }
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

                const rect = outputNode.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();

                tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x1 = ((rect.left - canvasRect.left) / zoom) - (currentTranslate.x / zoom) + outputNode.offsetWidth/2;
                const y1 = ((rect.top - canvasRect.top) / zoom) - (currentTranslate.y / zoom) + outputNode.offsetHeight/2;

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
                        e.stopPropagation();
                    }
                }
            });

            inputNode.addEventListener('mouseout', (e) => {
                if (hoveredInputNode === inputNode) {
                    hoveredInputNode = null;
                    inputNode.classList.remove('input-node-hover');
                    e.stopPropagation();
                }
            });
        });
    }

    // Function to handle block deletion and clean up connections
    function deleteBlockConnections(block) {
        const blockId = block.id;

        // Remove all connections to/from this block
        connections = connections.filter(conn =>
            conn.source !== blockId && conn.target !== blockId
        );

        // Update the visual connections
        updateConnections();
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


