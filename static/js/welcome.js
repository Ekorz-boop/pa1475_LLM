// Wait for page to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Welcome.js loaded");
    
    // Get welcome element
    const welcomeElement = document.getElementById('simple-welcome');
    const startDrawingBtn = document.getElementById('start-drawing-btn');
    
    if (!welcomeElement) {
        console.error("Welcome element not found!");
        return;
    }
    
    console.log("Welcome element found:", welcomeElement);
    
    // Function to hide welcome message
    function hideWelcome() {
        console.log("Hiding welcome message");
        welcomeElement.classList.add('hidden');
        
        // Also remove it from DOM after animation completes
        setTimeout(function() {
            welcomeElement.style.display = 'none';
        }, 500);
    }
    
    // Only hide welcome message when a custom block is created
    
    // Find the create custom block button
    const createCustomBlockBtn = document.getElementById('create-custom-block-btn');
    
    if (createCustomBlockBtn) {
        console.log("Found create custom block button");
        createCustomBlockBtn.addEventListener('click', function() {
            console.log("Create custom block button clicked");
            hideWelcome();
        });
    }
    
    // Remove other event listeners
    
    // Option 1: Check for custom blocks specifically
    const checkInterval = setInterval(function() {
        // Look for custom blocks specifically
        const customBlocks = document.querySelectorAll('.block[data-block-type="custom"]');
        if (customBlocks.length > 0) {
            console.log("Custom block found by interval check");
            hideWelcome();
            clearInterval(checkInterval);
        }
    }, 500);
    
    // Option 2: Setup MutationObserver to detect only custom blocks
    const blockContainer = document.querySelector('.block-container') || 
                          document.querySelector('.canvas-container');
                          
    if (blockContainer) {
        console.log("Setting up observer on", blockContainer);
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.addedNodes && mutation.addedNodes.length > 0) {
                    for (let i = 0; i < mutation.addedNodes.length; i++) {
                        const node = mutation.addedNodes[i];
                        // Only hide when a custom block is created
                        if (node.classList && 
                            node.classList.contains('block') && 
                            node.getAttribute('data-block-type') === 'custom') {
                            console.log("Custom block added to DOM:", node);
                            hideWelcome();
                            observer.disconnect();
                            return;
                        }
                    }
                }
            });
        });
        
        observer.observe(blockContainer, {
            childList: true,
            subtree: true
        });
    }
});
