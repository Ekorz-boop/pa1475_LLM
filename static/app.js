document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('canvas');
    const connectionsContainer = document.getElementById('connections');
    const blockTemplates = document.querySelectorAll('.block-template');
    const runAllButton = document.getElementById('run-all');
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

    async function runPipeline() {
        const blocks = document.querySelectorAll('.block');
        for (const block of blocks) {
            await processBlock(block);
        }
    }

    async function processBlock(block) {
        const type = block.getAttribute('data-block-type');
        const displayElement = block.querySelector('.output-display');

        switch (type) {
            case 'file-loader':
                const fileInput = block.querySelector('.file-input');
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const text = await file.text();
                    block.dataset.output = text;
                    propagateData(block);
                }
                break;

            case 'text-splitter':
                const inputConnection = connections.find(conn => conn.target === block.id);
                if (inputConnection) {
                    const sourceBlock = document.getElementById(inputConnection.source);
                    const text = sourceBlock.dataset.output;
                    const chunkSize = parseInt(block.querySelector('.chunk-size').value);
                    const chunks = splitTextIntoChunks(text, chunkSize);
                    block.dataset.output = JSON.stringify(chunks);
                    propagateData(block);
                }
                break;

            case 'display':
                const connection = connections.find(conn => conn.target === block.id);
                if (connection) {
                    const sourceBlock = document.getElementById(connection.source);
                    const data = sourceBlock.dataset.output;
                    if (data) {
                        displayElement.textContent = data;
                    } else {
                        displayElement.textContent = 'No data';
                    }
                } else {
                    displayElement.textContent = 'No input';
                }
                break;

            case 'string-addition':
                const inputConnection1 = connections.find(conn => conn.target === block.id && conn.inputId === 'Text1');
                const inputConnection2 = connections.find(conn => conn.target === block.id && conn.inputId === 'Text2');
                if (inputConnection1 && inputConnection2) {
                    const sourceBlock1 = document.getElementById(inputConnection1.source);
                    const sourceBlock2 = document.getElementById(inputConnection2.source);
                    const text1 = sourceBlock1.dataset.output;
                    const text2 = sourceBlock2.dataset.output;
                    const result = text1 + text2;
                    block.dataset.output = result;
                    propagateData(block);
                }
                break;

            case 'ai-model':
                const modelInputConnection = connections.find(conn => conn.target === block.id);
                if (modelInputConnection) {
                    const sourceBlock = document.getElementById(modelInputConnection.source);
                    const inputText = sourceBlock.dataset.output;
                    
                    // Show loading state
                    block.dataset.output = 'Generating...';
                    propagateData(block);
                    
                    // Call the API
                    fetch('/api/generate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ input: inputText })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            block.dataset.output = 'Error: ' + data.error;
                        } else {
                            block.dataset.output = data.output;
                        }
                        propagateData(block);
                    })
                    .catch(error => {
                        block.dataset.output = 'Error: ' + error.message;
                        propagateData(block);
                    });
                }
                break;
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
        const outgoingConnections = connections.filter(conn => conn.source === sourceBlock.id);
        outgoingConnections.forEach(conn => {
            const targetBlock = document.getElementById(conn.target);
            if (targetBlock) {
                processBlock(targetBlock);
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

        // Create a new block from template
        const block = document.createElement('div');
        block.className = 'block';
        block.id = `block-${blockCounter++}`;
        block.setAttribute('data-block-type', type);
        block.innerHTML = template.innerHTML;

        // Add delete button
        const deleteButton = document.createElement('div');
        deleteButton.className = 'delete-button';
        deleteButton.innerHTML = '×';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBlock(block);
        });
        block.appendChild(deleteButton);

        // Add to container first
        blockContainer.appendChild(block);

        // Position the block (snapped to grid)
        const snappedX = snapToGrid(x);
        const snappedY = snapToGrid(y);
        block.style.transform = `translate(${snappedX}px, ${snappedY}px)`;

        // Make only the drag handle draggable
        const dragHandle = block.querySelector('.block-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('mousedown', (e) => {
                if (e.button !== 0) return; // Only left mouse button
                isDraggingBlock = true;
                draggedBlock = block;
                
                // Calculate offset from the mouse to the block's center
                const rect = block.getBoundingClientRect();
                dragOffset.x = rect.width / 2;
                dragOffset.y = 12; // Half of drag handle height
                
                block.style.zIndex = '1000';
                e.preventDefault();
                e.stopPropagation();
            });
        }

        // Node connection handling
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

        return block;
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

    // Create and add the management button
    const managementButton = document.createElement('button');
    managementButton.className = 'management-button';
    managementButton.textContent = 'System Management';
    document.body.appendChild(managementButton);

    // Load and inject the management panel HTML
    fetch('/static/management.html')
        .then(response => response.text())
        .then(html => {
            document.body.insertAdjacentHTML('beforeend', html);
            initializeManagementPanel();
        });

    function initializeManagementPanel() {
        const panel = document.getElementById('system-management');
        const closeButton = panel.querySelector('.close-button');
        
        managementButton.addEventListener('click', () => {
            panel.classList.add('visible');
            updateSystemStatus();
        });
        
        closeButton.addEventListener('click', () => {
            panel.classList.remove('visible');
        });
        
        // Initialize action buttons
        document.getElementById('install-ollama').addEventListener('click', installOllama);
        document.getElementById('install-model').addEventListener('click', installModel);
        document.getElementById('clear-temp').addEventListener('click', clearTemp);
        document.getElementById('remove-models').addEventListener('click', removeModels);
    }

    function updateSystemStatus() {
        fetch('/api/system/status')
            .then(response => response.json())
            .then(data => {
                updateStatusDisplay('ollama-status', data.ollama_status);
                updateStatusDisplay('model-status', data.model_status);
                updateStorageDisplay(data.storage);
            });
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

    async function installModel() {
        const button = document.getElementById('install-model');
        button.disabled = true;
        updateStatusDisplay('model-status', 'downloading');
        
        try {
            const response = await fetch('/api/system/install-model', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                alert('Model installed successfully!');
            } else {
                alert('Failed to install model: ' + data.message);
            }
        } catch (error) {
            alert('Failed to install model: ' + error.message);
        } finally {
            button.disabled = false;
            updateSystemStatus();
        }
    }

    async function clearTemp() {
        if (!confirm('Are you sure you want to clear temporary files?')) return;
        
        try {
            const response = await fetch('/api/system/clear-temp', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                alert('Temporary files cleared successfully!');
                updateSystemStatus();
            }
        } catch (error) {
            alert('Failed to clear temporary files: ' + error.message);
        }
    }

    async function removeModels() {
        if (!confirm('Are you sure you want to remove unused models? This will free up disk space but models will need to be re-downloaded when needed.')) return;
        
        try {
            const response = await fetch('/api/system/remove-models', {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.status === 'success') {
                alert('Models removed successfully!');
                updateSystemStatus();
            }
        } catch (error) {
            alert('Failed to remove models: ' + error.message);
        }
    }

    // Add periodic status updates
    setInterval(updateSystemStatus, 30000); // Update every 30 seconds
});
