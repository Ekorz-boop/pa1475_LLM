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
            createBlock(blockType, e.clientX, e.clientY);
        }
    });

    // Add throttle function for smooth updates
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }
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

    // Throttled update functions
    const throttledUpdateConnections = throttle(updateConnections, 30);
    const throttledUpdateTransform = throttle(updateCanvasTransform, 30);

    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            currentTranslate = {
                x: e.clientX - startPoint.x,
                y: e.clientY - startPoint.y
            };
            throttledUpdateTransform();
            e.preventDefault();
            e.stopPropagation();
        }

        if (isDraggingBlock && draggedBlock) {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left - dragOffset.x) / zoom - currentTranslate.x / zoom;
            const y = (e.clientY - rect.top - dragOffset.y) / zoom - currentTranslate.y / zoom;
            
            draggedBlock.style.left = `${x}px`;
            draggedBlock.style.top = `${y}px`;
            
            throttledUpdateConnections();
            e.preventDefault();
            e.stopPropagation();
        }
        
        if (draggingConnection && tempConnection) {
            const canvasRect = canvas.getBoundingClientRect();
            const x = (e.clientX - canvasRect.left) / zoom - currentTranslate.x / zoom;
            const y = (e.clientY - canvasRect.top) / zoom - currentTranslate.y / zoom;
            tempConnection.setAttribute('x2', x);
            tempConnection.setAttribute('y2', y);
        }
    });

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
            if (hoveredInputNode && sourceNode) {
                const sourceBlock = sourceNode.closest('.block');
                const targetBlock = hoveredInputNode.closest('.block');
                if (sourceBlock !== targetBlock) {
                    const inputId = hoveredInputNode.getAttribute('data-input');
                    removeConnectionsToInput(targetBlock.id, inputId);
                    createConnection(sourceBlock, targetBlock, inputId);
                }
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

    function updateConnections() {
        connectionsContainer.innerHTML = '';
        connections.forEach((conn, index) => {
            const sourceBlock = document.getElementById(conn.source);
            const targetBlock = document.getElementById(conn.target);
            
            if (sourceBlock && targetBlock) {
                const sourceNode = sourceBlock.querySelector('.output-node');
                const targetNode = targetBlock.querySelector(`[data-input="${conn.inputId}"]`);
                
                const sourceRect = sourceNode.getBoundingClientRect();
                const targetRect = targetNode.getBoundingClientRect();
                const canvasRect = canvas.getBoundingClientRect();
                
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                const x1 = (sourceRect.left + sourceRect.width/2 - canvasRect.left) / zoom;
                const y1 = (sourceRect.top + sourceRect.height/2 - canvasRect.top) / zoom;
                const x2 = (targetRect.left + targetRect.width/2 - canvasRect.left) / zoom;
                const y2 = (targetRect.top + targetRect.height/2 - canvasRect.top) / zoom;

                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('class', 'connection-line');
                line.setAttribute('data-connection-index', index);

                line.addEventListener('click', (e) => {
                    if (selectedConnection === line) {
                        const removedConn = connections.splice(index, 1)[0];
                        updateConnections();
                        const targetBlock = document.getElementById(removedConn.target);
                        if (targetBlock) {
                            processBlock(targetBlock);
                        }
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
            }
        });
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

    function updateCanvasTransform() {
        requestAnimationFrame(() => {
            canvasContainer.style.transform = `translate(${currentTranslate.x}px, ${currentTranslate.y}px) scale(${zoom})`;
            zoomLevelDisplay.textContent = `${Math.round(zoom * 100)}%`;
            updateConnections();
        });
    }

    // Update the createBlock function
    function createBlock(type, x, y) {
        const template = document.querySelector(`.block-template[data-block-type="${type}"]`);
        const block = template.cloneNode(true);
        block.className = 'block';
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

        const rect = canvas.getBoundingClientRect();
        const canvasX = (x - rect.left - currentTranslate.x) / zoom;
        const canvasY = (y - rect.top - currentTranslate.y) / zoom;
        block.style.left = `${canvasX - 75}px`;
        block.style.top = `${canvasY - 40}px`;

        // Make block draggable
        block.addEventListener('mousedown', (e) => {
            if (!e.target.classList.contains('input-node') && 
                !e.target.classList.contains('output-node') && 
                !e.target.classList.contains('delete-button') &&
                e.target.tagName.toLowerCase() !== 'input') {
                isDraggingBlock = true;
                draggedBlock = block;
                const rect = block.getBoundingClientRect();
                dragOffset.x = e.clientX - rect.left;
                dragOffset.y = e.clientY - rect.top;
                block.style.zIndex = '1000';
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Handle file input changes
        const fileInput = block.querySelector('.file-input');
        if (fileInput) {
            fileInput.addEventListener('change', () => {
                processBlock(block);
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
                tempConnection.setAttribute('x1', rect.left + rect.width/2 - canvasRect.left);
                tempConnection.setAttribute('y1', rect.top + rect.height/2 - canvasRect.top);
                tempConnection.setAttribute('x2', rect.left + rect.width/2 - canvasRect.left);
                tempConnection.setAttribute('y2', rect.top + rect.height/2 - canvasRect.top);
                tempConnection.setAttribute('class', 'connection-line dragging');
                connectionsContainer.appendChild(tempConnection);
            });
        }

        inputNodes.forEach(inputNode => {
            inputNode.addEventListener('mouseover', () => {
                if (draggingConnection) {
                    hoveredInputNode = inputNode;
                    inputNode.classList.add('input-node-hover');
                }
            });

            inputNode.addEventListener('mouseout', () => {
                hoveredInputNode = null;
                inputNode.classList.remove('input-node-hover');
            });
        });

        canvasContainer.appendChild(block);
        return block;
    }
});
