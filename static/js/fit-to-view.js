// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initializing fit-to-view functionality");
    
    // The single, definitive fit-to-view function
    function fitBlocksToView() {
        console.log("Fitting blocks to view");
        try {
            // Get all blocks and canvas container
            var blocks = document.querySelectorAll('.block');
            var container = document.querySelector('.canvas-container');
            
            if (!blocks.length || !container) {
                console.log("No blocks or container found");
                return;
            }
            
            console.log("Found " + blocks.length + " blocks");
            
            // Reset transform to measure
            const originalTransform = container.style.transform;
            container.style.transform = 'none';
            
            // Force a reflow to ensure the transform is applied
            void container.offsetHeight;
            
            // Measure blocks in reset state
            setTimeout(function() {
                try {
                    // Find bounds of all blocks
                    var minX = Infinity, minY = Infinity;
                    var maxX = -Infinity, maxY = -Infinity;
                    
                    blocks.forEach(function(block) {
                        var rect = block.getBoundingClientRect();
                        minX = Math.min(minX, rect.left);
                        minY = Math.min(minY, rect.top);
                        maxX = Math.max(maxX, rect.right);
                        maxY = Math.max(maxY, rect.bottom);
                    });
                    
                    // Restore original transform if no valid blocks
                    if (minX === Infinity) {
                        console.log("Could not determine block bounds");
                        container.style.transform = originalTransform;
                        return;
                    }
                    
                    // Calculate content dimensions with 20% padding
                    var contentWidth = maxX - minX;
                    var contentHeight = maxY - minY;
                    var centerX = (minX + maxX) / 2;
                    var centerY = (minY + maxY) / 2;
                    
                    var paddedWidth = contentWidth * 1.2;
                    var paddedHeight = contentHeight * 1.2;
                    
                    // Calculate scale for fitting
                    var scaleX = window.innerWidth / paddedWidth;
                    var scaleY = window.innerHeight / paddedHeight;
                    var scale = Math.min(scaleX, scaleY, 2.0);
                    
                    // Ensure minimum scale
                    scale = Math.max(scale, 0.2);
                    
                    // Calculate translation to center content
                    var tx = (window.innerWidth / 2) - (centerX * scale);
                    var ty = (window.innerHeight / 2) - (centerY * scale);
                    
                    console.log("New transform: translate(" + tx + "px, " + ty + "px) scale(" + scale + ")");
                    
                    // Store values for protection
                    window.fitToViewActive = true;
                    window.fittedZoom = scale;
                    window.fittedTranslateX = tx;
                    window.fittedTranslateY = ty;
                    
                    // Update the global variables
                    if (typeof window.zoom !== 'undefined') window.zoom = scale;
                    if (typeof window.currentTranslate !== 'undefined') {
                        window.currentTranslate.x = tx;
                        window.currentTranslate.y = ty;
                    }
                    
                    // Fix for accurate block placement after zoom
                    // This ensures that blocks drop where expected regardless of zoom level
                    if (typeof window.handleDragStart === 'function') {
                        const originalHandleDragStart = window.handleDragStart;
                        window.handleDragStart = function(e) {
                            // Store the current zoom when drag starts
                            window.dragStartZoom = window.zoom;
                            // Call the original function
                            return originalHandleDragStart.apply(this, arguments);
                        };
                    }
                    
                    if (typeof window.handleBlockDrop === 'function') {
                        const originalHandleBlockDrop = window.handleBlockDrop;
                        window.handleBlockDrop = function(e) {
                            // Adjust coordinates based on zoom if needed
                            if (window.fitToViewActive && window.dragStartZoom) {
                                // Calculate zoom compensation factor
                                const zoomCompensation = window.zoom / window.dragStartZoom;
                                
                                // Clone and modify the event to adjust coordinates
                                const adjustedEvent = {...e};
                                if (adjustedEvent.clientX !== undefined && adjustedEvent.clientY !== undefined) {
                                    // Apply zoom compensation to drop position
                                    const canvasRect = document.querySelector('.canvas-container').getBoundingClientRect();
                                    const centerX = canvasRect.left + canvasRect.width / 2;
                                    const centerY = canvasRect.top + canvasRect.height / 2;
                                    
                                    // Calculate adjusted position based on center point
                                    adjustedEvent.clientX = centerX + (adjustedEvent.clientX - centerX) * zoomCompensation;
                                    adjustedEvent.clientY = centerY + (adjustedEvent.clientY - centerY) * zoomCompensation;
                                }
                                
                                // Call original with adjusted coordinates
                                return originalHandleBlockDrop.apply(this, [adjustedEvent]);
                            }
                            
                            // Call original function normally if no zoom adjustment needed
                            return originalHandleBlockDrop.apply(this, arguments);
                        };
                    }
                    
                    // Update zoom display
                    var zoomDisplay = document.querySelector('.zoom-level');
                    if (zoomDisplay) {
                        zoomDisplay.textContent = Math.round(scale * 100) + '%';
                    }
                    
                    // Add transition for smooth animation
                    container.style.transition = 'transform 0.5s cubic-bezier(0.215, 0.61, 0.355, 1)';
                    
                    // Apply transform with animation
                    container.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
                    
                    // Remove transition after animation completes
                    setTimeout(function() {
                        container.style.transition = '';
                        
                        // Update connections and mini-map after transition
                        if (typeof window.updateConnections === 'function') {
                            window.updateConnections();
                        }
                        
                        if (typeof window.updateMiniMap === 'function') {
                            window.updateMiniMap();
                        }
                    }, 600);
                    
                    // Create a MutationObserver to protect the zoom level during dragging
                    const transformObserver = new MutationObserver(function(mutations) {
                        if (window.fitToViewActive) {
                            mutations.forEach(function(mutation) {
                                if (mutation.attributeName === 'style' && 
                                    mutation.target === container &&
                                    !container.style.transition) {  // Only apply when not animating
                                    
                                    // Get the current transform
                                    const currentTransform = container.style.transform;
                                    
                                    // Check if it contains our expected zoom
                                    if (currentTransform && 
                                        !currentTransform.includes('scale(' + window.fittedZoom + ')')) {
                                        
                                        console.log('Transform changed, restoring fitted zoom');
                                        
                                        // Extract the translation values from the current transform
                                        const translateMatch = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
                                        
                                        if (translateMatch) {
                                            // Allow translation to change (panning) but keep zoom fixed
                                            const currentTranslateX = parseFloat(translateMatch[1]);
                                            const currentTranslateY = parseFloat(translateMatch[2]);
                                            
                                            // Apply transform with current translation but our fixed zoom
                                            // Do not use transition during drag operations - this makes it feel snappy
                                            container.style.transform = 
                                                `translate(${currentTranslateX}px, ${currentTranslateY}px) scale(${window.fittedZoom})`;
                                            
                                            // Update the global variables
                                            if (typeof window.zoom !== 'undefined') {
                                                window.zoom = window.fittedZoom;
                                            }
                                            
                                            // Update zoom display
                                            var zoomDisplay = document.querySelector('.zoom-level');
                                            if (zoomDisplay) {
                                                zoomDisplay.textContent = Math.round(window.fittedZoom * 100) + '%';
                                            }
                                        }
                                    }
                                }
                            });
                        }
                    });
                    
                    // Start observing the canvas container for style changes
                    transformObserver.observe(container, {
                        attributes: true,
                        attributeFilter: ['style']
                    });
                    
                    // Add our custom event listeners to disable protection when user explicitly zooms
                    function disableProtection() {
                        if (window.fitToViewActive) {
                            console.log('User manually zoomed, disabling fit-to-view protection');
                            window.fitToViewActive = false;
                            
                            // Stop the observer to prevent further interference
                            transformObserver.disconnect();
                        }
                    }
                    
                    // Zoom buttons
                    document.getElementById('zoom-in')?.addEventListener('click', disableProtection);
                    document.getElementById('zoom-out')?.addEventListener('click', disableProtection);
                    document.getElementById('zoom-fit')?.addEventListener('click', disableProtection);
                    
                    // Wheel zoom
                    document.addEventListener('wheel', function(e) {
                        // Check if Ctrl key is pressed (typical for zoom)
                        if (e.ctrlKey || e.metaKey) {
                            disableProtection();
                        }
                    }, true);
                } catch (e) {
                    console.error("Error in fitBlocksToView:", e);
                    container.style.transform = originalTransform;
                }
            }, 50);
        } catch (e) {
            console.error("Error in fitBlocksToView:", e);
        }
    }
    
    // Add event listener to the button
    var fitButton = document.getElementById('fit-to-view');
    if (fitButton) {
        console.log("Found fit-to-view button");
        fitButton.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            fitBlocksToView();
        });
    }
    
    // Make the function available globally
    window.fitBlocksToView = fitBlocksToView;
    
    // Also patch the updateCanvasTransform function to respect our settings
    if (typeof window.updateCanvasTransform === 'function') {
        const originalUpdateCanvasTransform = window.updateCanvasTransform;
        window.updateCanvasTransform = function() {
            // Call the original function
            originalUpdateCanvasTransform.apply(this, arguments);
            
            // Always update the zoom display after transform updates
            var zoomDisplay = document.querySelector('.zoom-level');
            if (zoomDisplay && typeof window.zoom !== 'undefined') {
                zoomDisplay.textContent = Math.round(window.zoom * 100) + '%';
            }
        };
    }
});
    