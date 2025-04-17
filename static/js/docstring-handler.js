/**
 * A class to handle docstring parsing and formatting with support for multiple docstring styles
 * including Google-style, Sphinx-style, and patterns commonly found in Langchain.
 */
class DocstringHandler {
    constructor() {
        this.patterns = {
            // Section headers (Google-style and custom)
            sectionHeaders: /^(Args|Returns|Raises|Example|Examples|Attributes|Note|Warning|Setup):\s*$/gm,
            
            // Add pattern for pre-formatted parameter tables
            parameterTable: /Parameters:\s*\nName\s*\nType\s*\nDescription\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/,
            
            // Pattern for individual parameter entries in the table
            tableParameter: /^(\S+)\s*\n(\S+(?:,\s*\S+)*)\s*\n([\s\S]*?)(?=\n\S|$)/gm,
            
            // Setup patterns
            setup: {
                header: /Setup:\s*\n/,
                pipInstall: /pip\s+install\s+(?:-[uU]\s+)?[^\n]+/g
            },
            
            // Code block patterns
            codeBlocks: {
                rst: /\.\.\s*code-block::\s*(\w+)\s*\n\s*([\s\S]*?)(?=\n\n\S|\n\s*\.\.|$)/g,
                triple: /```(\w+)?\n([\s\S]*?)```/g,
                indented: /(?:^|\n)( {4}|\t)([^\n]+(?:\n(?:[ \t]+[^\n]+)*)*)/g
            },
            
            // Installation patterns
            installation: {
                pipCommand: /pip\s+install\s+(?:-[uU]\s+)?[^;\n]+/g,
                requirements: /\brequirements?\.txt\b/,
                multiPackage: /(?:langchain[\w-]*|pypdf\d*|chromadb|openai|tiktoken)(?:\s*,\s*[\w-]+)*/g
            },
            
            // Parameter patterns
            parameters: {
                sphinx: /(?:^|\n)\s*:param\s+([^:]+):\s*([^\n]*(?:\n\s+[^\n:]*)*)/g,
                google: /(?:^|\n)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\):\s*([^\n]*(?:\n\s+[^\n]*)*)/g,
                types: /(?:^|\n)\s*:type\s+([^:]+):\s*([^\n]*)/g
            },
            
            // Return value patterns
            returns: {
                sphinx: /(?:^|\n)\s*:returns?:\s*([^\n]*(?:\n\s+[^\n:]*)*)/g,
                returnType: /(?:^|\n)\s*:rtype:\s*([^\n]*)/g,
                google: /Returns:\s*\n\s*([^\n]*(?:\n\s+[^\n]*)*)/g
            },
            
            // Exception patterns
            raises: {
                sphinx: /(?:^|\n)\s*:raises?\s+([^:]+):\s*([^\n]*(?:\n\s+[^\n:]*)*)/g,
                google: /Raises:\s*\n\s*([A-Za-z0-9_]+):\s*([^\n]*(?:\n\s+[^\n]*)*)/g
            }
        };
    }

    /**
     * Parse a docstring into structured sections
     * @param {string} docstring - The raw docstring text
     * @returns {Object} - Structured docstring data
     */
    parseDocstring(docstring) {
        if (!docstring || typeof docstring !== 'string') {
            return {
                description: 'No description available.',
                setup: null,
                codeBlocks: [],
                parameters: [],
                returns: { type: '', description: '' },
                raises: [],
                examples: []
            };
        }

        const sections = {
            description: '',
            setup: null,
            codeBlocks: [],
            parameters: [],
            returns: { type: '', description: '' },
            raises: [],
            examples: []
        };

        // Parameter parsing logic
        const tableMatch = docstring.match(this.patterns.parameterTable);
        if (tableMatch) {
            const tableContent = tableMatch[1];
            let paramMatch;
            while ((paramMatch = this.patterns.tableParameter.exec(tableContent)) !== null) {
                const [_, name, type, description] = paramMatch;
                sections.parameters.push({
                    name: name.trim(),
                    type: type.trim(),
                    description: description.trim()
                });
            }
            // Remove the parameter table from the docstring
            docstring = docstring.replace(tableMatch[0], '');
        } else {
            // If no table found, parse traditional :param and :type format
            const params = new Map();
            let match;
            
            // Match :param lines
            const paramRegex = /:param\s+([^:]+):\s*([^\n]*(?:\n\s+[^\n:]*)*)/g;
            while ((match = paramRegex.exec(docstring)) !== null) {
                const name = match[1].trim();
                const description = match[2].trim();
                params.set(name, { name, description, type: '' });
            }

            // Match :type lines
            const typeRegex = /:type\s+([^:]+):\s*([^\n]*)/g;
            while ((match = typeRegex.exec(docstring)) !== null) {
                const name = match[1].trim();
                const type = match[2].trim();
                if (params.has(name)) {
                    params.get(name).type = type;
                }
            }
            sections.parameters = Array.from(params.values());
        }

        // --- Cleanup: Remove ALL raw parameter/type definitions --- 
        docstring = docstring.replace(/:param\s+([^:]+):\s*([^\n]*(?:\n\s+[^\n:]*)*)/g, '');
        docstring = docstring.replace(/:type\s+([^:]+):\s*([^\n]*)/g, '');
        docstring = docstring.replace(/Parameters:\s*\n/g, ''); // Clean up header if left

        // Extract raises section
        const raisesMatches = Array.from(docstring.matchAll(/:raises?\s+([^:]+):\s*([^\n]*(?:\n\s+[^\n:]*)*)/g));
        sections.raises = raisesMatches.map(match => ({
            type: match[1].trim(),
            description: match[2].trim()
        }));

        // Remove raises section from docstring
        raisesMatches.forEach(match => {
            docstring = docstring.replace(match[0], '');
        });

        // Extract setup section
        const setupMatch = docstring.match(/Setup:\s*\n([\s\S]*?)(?=\n\s*\n|\n[A-Z]|$)/);
        if (setupMatch) {
            const setupContent = setupMatch[1];
            const pipMatch = setupContent.match(this.patterns.setup.pipInstall);
            if (pipMatch) {
                sections.setup = {
                    commands: pipMatch.map(cmd => cmd.trim())
                };
                docstring = docstring.replace(setupMatch[0], '');
            }
        }

        // Extract code blocks
        let codeBlockId = 0;
        
        // Handle RST-style code blocks
        docstring = docstring.replace(this.patterns.codeBlocks.rst, (_, lang, code) => {
            const id = `__CODE_${codeBlockId++}__`;
            sections.codeBlocks.push({
                id,
                language: lang || 'python',
                code: code.trim()
            });
            return id;
        });

        // Handle triple backtick code blocks
        docstring = docstring.replace(this.patterns.codeBlocks.triple, (_, lang, code) => {
            const id = `__CODE_${codeBlockId++}__`;
            sections.codeBlocks.push({
                id,
                language: lang || 'python',
                code: code.trim()
            });
            return id;
        });
        
        // Extract description (everything before the first section header or remaining text)
        const firstSectionMatch = docstring.match(this.patterns.sectionHeaders);
        if (firstSectionMatch) {
            sections.description = docstring.slice(0, firstSectionMatch.index).trim();
        } else {
            sections.description = docstring.trim();
        }

        // Final cleanup of description to remove potential leftover blank lines
        sections.description = sections.description.replace(/^\s*\n/gm, '').trim();

        return sections;
    }

    /**
     * Format parsed docstring sections into HTML
     * @param {Object} sections - Parsed docstring sections
     * @returns {string} - Formatted HTML
     */
    formatDocstring(sections) {
        let html = '';

        // Setup section
        if (sections.setup) {
            html += `<div class="docstring-section setup-section">
                        <h4>Setup:</h4>
                        <div class="setup-content">`;
            
            for (const command of sections.setup.commands) {
                html += `<pre class="bash"><code>${this._formatBashCode(command)}</code></pre>`;
            }
            
            html += `</div></div>`;
        }

        // Description section with code blocks
        if (sections.description) {
            let description = sections.description;
            
            // Replace code block placeholders with formatted code
            sections.codeBlocks.forEach(block => {
                const formatted = this._formatCodeBlock(block.code, block.language);
                description = description.replace(
                    block.id,
                    `<pre class="${block.language}"><code>${formatted}</code></pre>`
                );
            });

            html += `<div class="docstring-section">
                        <div class="section-content description">
                            ${this._formatText(description)}
                        </div>
                    </div>`;
        }

        // Parameters section
        if (sections.parameters && sections.parameters.length > 0) {
            html += `<div class="docstring-section parameters-section">
                        <h4>Parameters:</h4>
                        <div class="parameter-table">
                            <div class="parameter-table-header">
                                <div class="param-name-header">Name</div>
                                <div class="param-type-header">Type</div>
                                <div class="param-desc-header">Description</div>
                            </div>`;

            for (const param of sections.parameters) {
                let description = param.description;
                // Format default values in the description
                description = description.replace(
                    /_description_,\s*defaults\s+to\s+([^,\n]+)/,
                    '_description_, <span class="default-value">default: $1</span>'
                );

                html += `<div class="parameter-row">
                            <div class="param-name">${param.name}</div>
                            <div class="param-type">${param.type}</div>
                            <div class="param-desc">${description}</div>
                        </div>`;
            }

            html += `</div></div>`;
        }

        // Returns section
        if (sections.returns && sections.returns.description) {
            html += `<div class="docstring-section returns-section">
                        <h4>Returns:</h4>
                        <div class="returns-content">
                            ${sections.returns.description}
                        </div>
                    </div>`;
        }

        // Raises section
        if (sections.raises && sections.raises.length > 0) {
            html += `<div class="docstring-section raises-section">
                        <h4>Raises:</h4>
                        <div class="raises-content">`;
            
            sections.raises.forEach(raise => {
                html += `<div class="raise-item">
                            <span class="raise-type">${raise.type}</span>
                            <span class="raise-desc">${raise.description}</span>
                        </div>`;
            });
            
            html += `</div></div>`;
        }

        return html;
    }

    /**
     * Format text content with proper HTML formatting
     * @private
     */
    _formatText(text) {
        if (!text) return '';

        // Replace inline code with potential class references
        text = text.replace(/`([^`]+)`/g, (_, code) => {
            if (this._looksLikeClass(code)) {
                return `<code class="code-class">${code}</code>`;
            }
            return `<code>${code}</code>`;
        });

        // Replace line breaks with paragraphs
        text = text.split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join('');
        
        // Replace single line breaks with <br>
        text = text.replace(/\n/g, '<br>');
        
        return text;
    }

    /**
     * Format Python code with syntax highlighting
     * @private
     */
    _formatPythonCode(code) {
        // First escape HTML
        code = this._escapeHtml(code);

        // Store string literals to prevent processing their contents
        const strings = [];
        code = code.replace(/(["'])((?:\\.|[^\\])*?)\1/g, (match) => {
            strings.push(match);
            return `__STRING_${strings.length - 1}__`;
        });

        // Process different parts
        code = code
            // Keywords
            .replace(/\b(import|from|class|def|return|None|True|False|self)\b/g, 
                '<span class="code-keyword">$1</span>')
            
            // Class names
            .replace(/\b([A-Z][a-zA-Z0-9_]*)\b/g, 
                '<span class="code-class">$1</span>')
            
            // Variable assignments
            .replace(/\b([a-z_][a-z0-9_]*)\s*=/g, 
                '<span class="code-variable">$1</span> =')
            
            // Function calls
            .replace(/\b([a-z_][a-z0-9_]*)\s*\(/g, 
                '<span class="code-function">$1</span>(')
            
            // Comments
            .replace(/(#[^\n]*)/g, 
                '<span class="code-comment">$1</span>');

        // Restore string literals
        strings.forEach((str, i) => {
            code = code.replace(
                `__STRING_${i}__`,
                `<span class="code-string">${this._escapeHtml(str)}</span>`
            );
        });

        return code;
    }

    /**
     * Format Bash code with syntax highlighting
     * @private
     */
    _formatBashCode(code) {
        // First escape HTML
        code = this._escapeHtml(code);

        return code
            // Highlight pip command
            .replace(/\b(pip)\b/g, '<span class="code-keyword">$1</span>')
            
            // Command flags
            .replace(/\s(-[uU])\b/g, ' <span class="code-flag">$1</span>')
            
            // Package names
            .replace(/\b(langchain[\w-]*|pypdf\d*|chromadb|openai|tiktoken)\b/g,
                '<span class="code-package">$1</span>')
            
            // Install command
            .replace(/\b(install)\b/g, '<span class="code-keyword">$1</span>');
    }

    /**
     * Format a code block with syntax highlighting
     * @private
     */
    _formatCodeBlock(code, language) {
        switch (language.toLowerCase()) {
            case 'python':
                return this._formatPythonCode(code);
            case 'bash':
                return this._formatBashCode(code);
            default:
                return this._escapeHtml(code);
        }
    }

    /**
     * Check if a code snippet looks like a class reference
     * @private
     */
    _looksLikeClass(code) {
        return /^[A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*$/.test(code);
    }

    /**
     * Escape HTML special characters
     * @private
     */
    _escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
} 