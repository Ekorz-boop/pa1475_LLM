document.addEventListener('DOMContentLoaded', function() {
    // Canvas buttons
    document.getElementById('save-template')?.addEventListener('click', () => {
        if (window.templateHandler) {
            window.templateHandler.saveTemplateModal();
        }
    });
    
    document.getElementById('load-template')?.addEventListener('click', () => {
        if (window.templateHandler) {
            window.templateHandler.showLoadTemplateModal();
        }
    });

    // Populate recent templates list in sidebar
    const populateRecentTemplates = () => {
        if (window.templateHandler) {
            const templates = window.templateHandler.loadSavedTemplates();
            const templatesList = document.getElementById('recent-templates-list');
            
            if (!templatesList) return;
            
            if (templates.length === 0) {
                templatesList.innerHTML = '<p class="no-templates">No saved templates found</p>';
                return;
            }
            
            // Sort templates by creation date (newest first)
            templates.sort((a, b) => {
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
            });
            
            // Display only the 3 most recent templates
            const recentTemplates = templates.slice(0, 3);
            
            // Generate HTML for each template
            let templatesHtml = '';
            recentTemplates.forEach(template => {
                const date = template.created_at 
                    ? new Date(template.created_at).toLocaleDateString() 
                    : 'Unknown date';
                    
                templatesHtml += `
                    <div class="template-item" data-id="${template.id}">
                        <div class="template-info">
                            <h4>${escapeHtml(template.name)}</h4>
                            <p class="template-date">${date}</p>
                        </div>
                        <div class="template-actions">
                            <button class="load-template-btn" data-id="${template.id}">Load</button>
                        </div>
                    </div>
                `;
            });
            
            templatesList.innerHTML = templatesHtml;
        }
    };
    
    // Helper function for HTML escaping
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
    
    // Initially populate recent templates
    setTimeout(populateRecentTemplates, 500);
    
    // Update recent templates whenever the templates tab is shown
    document.querySelector('.menu-item[data-menu="templates"]')?.addEventListener('click', () => {
        setTimeout(populateRecentTemplates, 100);
    });
});