document.addEventListener('DOMContentLoaded', () => {
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
        const blocks = document.querySelectorAll('.block');
        if (blocks.length === 0) {
            return { valid: false, error: 'Pipeline is empty. Add some blocks first.' };
        }

        // Check for required block types
        const blockTypes = Array.from(blocks).map(b => b.getAttribute('data-block-type'));
        const hasVectorStore = blockTypes.includes('vector_store');
        const hasAIModel = blockTypes.includes('ai_model');

        if (!hasVectorStore) {
            return { valid: false, error: 'Pipeline must include a Vector Store block.' };
        }
        if (!hasAIModel) {
            return { valid: false, error: 'Pipeline must include an AI Model block.' };
        }

        // Check connections
        for (const block of blocks) {
            const inputNodes = block.querySelectorAll('.input-node');
            for (const inputNode of inputNodes) {
                const hasConnection = connections.some(conn => 
                    conn.target === block.id && conn.inputId === inputNode.getAttribute('data-input')
                );
                if (!hasConnection) {
                    const blockType = block.getAttribute('data-block-type');
                    const inputType = inputNode.getAttribute('data-input');
                    return { 
                        valid: false, 
                        error: `${blockType} block is missing connection for ${inputType} input.`
                    };
                }
            }
        }

        return { valid: true };
    }

    // Update the exportPipeline function
    async function exportPipeline() {
        showProgress(true, 'Exporting Pipeline', 'Collecting block configurations...');
        
        try {
            // Validate pipeline first
            const validationResult = validatePipeline();
            if (!validationResult.valid) {
                showToast(validationResult.error, 'error');
                showProgress(false);
                return;
            }

            // Get all blocks and their configurations
            const blocks = document.querySelectorAll('.block');
            const blockData = {};
            let processedBlocks = 0;
            
            for (const block of blocks) {
                const id = block.id;
                const type = block.getAttribute('data-block-type');
                
                updateProgress(
                    (processedBlocks / blocks.length) * 50,
                    `Processing ${type} configuration...`
                );
                
                blockData[id] = {
                    type: type,
                    config: getBlockConfig(block)
                };
                processedBlocks++;
            }

            updateProgress(75, 'Generating Python code...');

            // Send to backend
            const response = await fetch('/api/blocks/export', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    blocks: blockData,
                    connections: connections,
                    output_file: 'generated_rag.py'
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                updateProgress(100, 'Export completed!');
                setTimeout(() => {
                    showProgress(false);
                    showToast(
                        `Pipeline exported successfully to ${result.file}! 🎉`,
                        'success'
                    );
                }, 1000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            showToast(`Export failed: ${error.message}`, 'error');
            showProgress(false);
        }
    }

    // Update block processing function
    async function processBlock(block) {
        const type = block.getAttribute('data-block-type');
        const config = getBlockConfig(block);
        
        // Log for debugging
        console.log(`Processing block: ${type} (ID: ${block.id})`);
        
        try {
            if (type === 'answer_display') {
                // Find the input connection
                const inputConnection = connections.find(conn => conn.target === block.id);
                if (inputConnection) {
                    const sourceBlock = document.getElementById(inputConnection.source);
                    if (sourceBlock) {
                        const display = block.querySelector('.answer-display');
                        const sourceType = sourceBlock.getAttribute('data-block-type');
                        
                        // Get the value from the source block
                        let value;
                        try {
                            const blockData = JSON.parse(sourceBlock.dataset.output);
                            // For AI model, use the answer field
                            if (sourceType === 'ai_model' && blockData.answer) {
                                value = blockData.answer;
                            } else {
                                value = blockData;
                            }
                        } catch (e) {
                            console.log('Error parsing block data:', e);
                            value = sourceBlock.dataset.output;
                        }
                        
                        console.log(`Display Block: Received value from ${sourceType}:`, value);
                        
                        // Format the output based on type
                        if (value === undefined || value === null) {
                            display.textContent = "No data available";
                        } else if (typeof value === 'object') {
                            try {
                                display.innerHTML = `<pre class="json-output">${JSON.stringify(value, null, 2)}</pre>`;
                            } catch (err) {
                                display.textContent = `[Object]: ${value.toString()}`;
                            }
                        } else {
                            display.textContent = value;
                        }
                        
                        // Add block type info for debugging
                        const chunks = block.querySelector('.context-chunks');
                        chunks.innerHTML = `<div class="debug-info">Source: ${sourceType} block</div>`;
                        
                        // Store the value in the block's own dataset as well
                        block.dataset.output = typeof value === 'object' ? JSON.stringify(value) : value;
                    } else {
                        console.log(`Display Block: Source block not found for connection ${inputConnection.source}`);
                    }
                } else {
                    console.log(`Display Block: No input connection found`);
                }
                return;
            }

            const response = await fetch('/api/blocks/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    block_id: block.id,
                    type: type,
                    config: config
                })
            });

            if (!response.ok) {
                const error = await response.json();
                console.error(`Error processing ${type} block:`, error);
                throw new Error(error.message || 'Failed to process block');
            }

            const result = await response.json();
            console.log(`${type} block processed:`, result);
            
            // Update block status
            updateBlockStatus(block, 'success');
            
            // Store the entire result object in the block's dataset
            block.dataset.output = JSON.stringify(result);
            console.log(`${type} block output stored:`, block.dataset.output);
            
            return result;
        } catch (error) {
            console.error(`Error in ${type} block:`, error);
            updateBlockStatus(block, 'error');
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
        const type = sourceBlock.getAttribute('data-block-type');
        const outgoingConnections = connections.filter(conn => conn.source === sourceBlock.id);
        
        console.log(`Propagating data from ${type} block to ${outgoingConnections.length} connections`);
        
        if (outgoingConnections.length === 0) {
            console.log(`No outgoing connections from ${type} block`);
            return; // No outgoing connections
        }
        
        // Show a small toast notification
        showToast(`Propagating data from ${type}...`, 'info', 1000);
        
        // Process each connected block
        outgoingConnections.forEach(async conn => {
            const targetBlock = document.getElementById(conn.target);
            const targetType = targetBlock ? targetBlock.getAttribute('data-block-type') : 'unknown';
            console.log(`Propagating from ${type} to ${targetType} (input: ${conn.inputId})`);
            
            if (targetBlock) {
                try {
                    await processBlock(targetBlock);
                    // Recursively propagate to next blocks
                    propagateData(targetBlock);
                } catch (error) {
                    console.error(`Error processing ${targetType}:`, error);
                    showToast(`Error in ${targetType}: ${error.message}`, 'error');
                }
            } else {
                console.error(`Target block ${conn.target} not found`);
            }
        });
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
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - currentTranslate.x) / zoom;
            const y = (e.clientY - rect.top - currentTranslate.y) / zoom;
            createBlock(blockType, x, y);
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
            
            // Snap to grid
            const snappedX = snapToGrid(x);
            const snappedY = snapToGrid(y);
            
            draggedBlock.style.transform = `translate(${snappedX}px, ${snappedY}px)`;
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
            const elemUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
            if (elemUnderMouse && elemUnderMouse.classList.contains('input-node') && sourceNode) {
                const sourceBlock = sourceNode.closest('.block');
                const targetBlock = elemUnderMouse.closest('.block');
                if (sourceBlock && targetBlock && sourceBlock !== targetBlock) {
                    const inputId = elemUnderMouse.getAttribute('data-input');
                    removeConnectionsToInput(targetBlock.id, inputId);
                    createConnection(sourceBlock, targetBlock, inputId);
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
                const rect = block.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                dragOffset.x = (e.clientX - rect.left) / zoom;
                dragOffset.y = (e.clientY - rect.top) / zoom;
                
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

                    const sendMessage = () => {
                        const text = input.value.trim();
                        if (text) {
                            messages.innerHTML += `<div class="message">${text}</div>`;
                            input.value = '';
                            messages.scrollTop = messages.scrollHeight;
                            
                            // Store the query in the block's data and propagate
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

    function createCustomBlock(type, inputs, outputs) {
        const block = document.createElement('div');
        block.className = 'block';
        block.id = `block-${blockCounter++}`;
        block.setAttribute('data-block-type', type);

        const dragHandle = document.createElement('div');
        dragHandle.className = 'block-drag-handle';
        dragHandle.textContent = type;
        block.appendChild(dragHandle);

        const blockContent = document.createElement('div');
        blockContent.className = 'block-content';

        inputs.forEach(input => {
            const inputGroup = document.createElement('div');
            inputGroup.className = 'input-group';
            const inputNode = document.createElement('div');
            inputNode.className = 'input-node';
            inputNode.setAttribute('data-input', input);
            inputGroup.appendChild(inputNode);
            blockContent.appendChild(inputGroup);
        });

        outputs.forEach(output => {
            const outputNode = document.createElement('div');
            outputNode.className = 'output-node';
            outputNode.setAttribute('data-output', output);
            blockContent.appendChild(outputNode);
        });

        block.appendChild(blockContent);
        blockContainer.appendChild(block);
    }

    // Initialize management panel
    const managementButton = document.getElementById('management-button');
    const managementPanel = document.getElementById('system-management');
    
    if (!managementButton || !managementPanel) {
        console.error('Management panel elements not found!');
        return;
    }

    // Management panel event listeners
    managementButton.addEventListener('click', () => {
        console.log('Opening management panel');
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

    // Add export button handler
    const exportButton = document.getElementById('export-pipeline');
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

        return config;
    }
});
