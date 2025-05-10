// Wait for page to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("Welcome.js loaded");
    
    // Get welcome element
    const welcomeElement = document.getElementById('simple-welcome');
    
    if (!welcomeElement) {
        console.error("Welcome element not found!");
        return;
    }
    
    console.log("Welcome element found:", welcomeElement);
    
    // Function to hide welcome message
    function hideWelcome() {
        console.log("Hiding welcome message");
        welcomeElement.classList.add('hidden');
        
        // Remove from DOM after animation completes
        welcomeElement.addEventListener('transitionend', function handler() {
            welcomeElement.style.display = 'none';
            welcomeElement.removeEventListener('transitionend', handler);
        });
    }
    
    // Find the create custom block button and the load template button
    const createCustomBlockBtn = document.getElementById('create-custom-block-btn');
    const loadTemplateBtn = document.getElementById('loadTemplateBtn');
    
    if (createCustomBlockBtn || loadTemplateBtn) {
        console.log("Custom blocks are created");
        createCustomBlockBtn.addEventListener('click', function() {
            console.log("Create custom block button clicked");
            hideWelcome();
        });
        loadTemplateBtn.addEventListener('click', function() {
            console.log("Load template button clicked");
            hideWelcome();
        });
    }
});
