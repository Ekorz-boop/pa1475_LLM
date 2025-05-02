/**
 * A class to handle docstring parsing and formatting with support for multiple docstring styles
 * including Google-style, Sphinx-style, and patterns commonly found in Langchain.
 */
class DocstringHandler {
    constructor() {
        this.patterns = {
            // Section headers (Enhanced based on LangChain analysis)
            sectionHeaders: /^(Args|Returns|Raises|Example|Examples|Attributes|Note|Warning|Setup|Instantiate|Load|Async load|Lazy load|Output Example|References|See Also|Parameters|Deprecated|Usage|Configuration|Migration|Beta):\s*$/gm,
            
            // Add pattern for pre-formatted parameter tables
            parameterTable: /Parameters:\s*\nName\s*\nType\s*\nDescription\s*\n([\s\S]*?)(?=\n\n|\n[A-Z]|$)/,
            
            // Pattern for individual parameter entries in the table
            tableParameter: /^(\S+)\s*\n(\S+(?:,\s*\S+)*)\s*\n([\s\S]*?)(?=\n\S|$)/gm,
            
            // Setup patterns
            setup: {
                header: /Setup:\s*\n/,
                pipInstall: /pip\s+install\s+(?:-[uU]\s+)?[^\n]+/g
            },
            
            // Enhanced code block patterns based on LangChain analysis
            codeBlocks: {
                rst: /\.\.\s*code-block::\s*(\w+)\s*\n\s*([\s\S]*?)(?=\n\n\S|\n\s*\.\.|$)/g,
                triple: /```(\w+)?\n([\s\S]*?)```/g,
                indented: /(?:^|\n)( {4}|\t)([^\n]+(?:\n(?:[ \t]+[^\n]+)*)*)/g,
                output: /Output:\s*\n\s*([\s\S]*?)(?=\n\s*\n|\n[A-Z]|$)/g
            },
            
            // Installation patterns
            installation: {
                pipCommand: /pip\s+install\s+(?:-[uU]\s+)?[^;\n]+/g,
                requirements: /\brequirements?\.txt\b/,
                multiPackage: /(?:langchain[\w-]*|pypdf\d*|chromadb|openai|tiktoken)(?:\s*,\s*[\w-]+)*/g
            },
            
            // Enhanced parameter patterns
            parameters: {
                sphinx: /(?:^|\n)\s*:param\s+([^:]+):\s*([^\n]*(?:\n\s+[^\n:]*)*)/g,
                google: /(?:^|\n)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\):\s*([^\n]*(?:\n\s+[^\n]*)*)/g,
                types: /(?:^|\n)\s*:type\s+([^:]+):\s*([^\n]*)/g,
                // New patterns for better type detection
                unionTypes: /Union\[([^\]]+)\]/g,
                listTypes: /List\[([^\]]+)\]/g,
                dictTypes: /Dict\[([^\]]+)\]/g,
                optionalMarker: /Optional\[([^\]]+)\]/g,
                // New patterns for parameter metadata
                requiredMarker: /required\s*[,.]/i,
                optionalMarker: /optional\s*[,.]/i,
                defaultMarker: /defaults?\s+to\s+([^,\n]+)/i
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
            },
            
            // New patterns for references and links
            references: {
                classRef: /:class:`([^`]+)`/g,
                funcRef: /:func:`([^`]+)`/g,
                methRef: /:meth:`([^`]+)`/g,
                modRef: /:mod:`([^`]+)`/g,
                extLink: /`([^`]+)\s+<([^>]+)>`_/g,
                apiRef: /https?:\/\/api\.python\.langchain\.com\/en\/latest\/([^\s]+)/g,
                migrationGuide: /https?:\/\/python\.langchain\.com\/docs\/versions\/migrating[^\s]+/g
            },

            // New patterns for special markers
            markers: {
                beta: /\.\.\s*beta::/g,
                deprecated: /\.\.\s*deprecated::\s*([^\n]+)/g,
                versionChanged: /\.\.\s*versionchanged::\s*([^\n]+)/g,
                versionAdded: /\.\.\s*versionadded::\s*([^\n]+)/g
            }
        };

        // Enhanced section icons
        this.sectionIcons = {
            'Args': '📝',
            'Parameters': '📝',
            'Returns': '↩️',
            'Raises': '⚠️',
            'Example': '💡',
            'Examples': '💡',
            'Attributes': '🔍',
            'Note': '📌',
            'Warning': '⚠️',
            'Setup': '⚙️',
            'References': '📚',
            'See Also': '👉',
            'Deprecated': '🚫',
            'Usage': '🎯',
            'Configuration': '⚙️',
            'Migration': '🔄',
            'Beta': '🧪',
            'Output Example': '📤'
        };

        // Language detection patterns
        this.languagePatterns = {
            python: {
                keywords: /\b(def|class|import|from|return|if|else|for|while|try|except|with|as|lambda|async|await)\b/,
                builtins: /\b(print|len|str|int|dict|list|tuple|set|bool|None|True|False)\b/,
                imports: /\b(os|sys|json|requests|numpy|pandas|torch|tensorflow)\b/
            },
            bash: {
                keywords: /\b(echo|cd|ls|mkdir|rm|cp|mv|chmod|chown|sudo|apt|pip|python|git)\b/,
                flags: /\s-[a-zA-Z]+|\s--[a-zA-Z-]+/
            },
            yaml: {
                patterns: /^\s*[a-zA-Z_][a-zA-Z0-9_]*:\s*$/m,
                lists: /^\s*-\s+/m
            },
            json: {
                patterns: /^\s*[{"]/m,
                arrays: /^\s*\[/m
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

        // Extract code blocks with their context
        let codeBlockId = 0;
        const codeBlockContexts = new Map(); // Map to store code block context
        const seenCodeBlocks = new Set(); // Track unique code blocks
        
        // Helper function to check if code block is unique
        const isUniqueCodeBlock = (code) => {
            const normalizedCode = code.trim().replace(/\s+/g, ' ');
            if (seenCodeBlocks.has(normalizedCode)) {
                return false;
            }
            seenCodeBlocks.add(normalizedCode);
            return true;
        };

        // Helper function to determine context
        const determineContext = (beforeText, code) => {
            // First check for explicit section headers
            const headerMatch = beforeText.match(/(?:^|\n)(Setup|Instantiate|Load|Async load|Lazy load|Output Example|Usage Example):\s*$/);
            if (headerMatch) {
                return headerMatch[1];
            }

            // Analyze code content to determine context
            const normalizedCode = code.toLowerCase().trim();
            
            // Check for setup/installation related code
            if (normalizedCode.includes('pip install') || 
                normalizedCode.includes('requirements.txt') ||
                normalizedCode.includes('setup.py')) {
                return 'Setup';
            }

            // Check for instantiation code
            if (normalizedCode.includes(' = ') && 
                (normalizedCode.includes('loader') || 
                 normalizedCode.includes('model') || 
                 normalizedCode.includes('client'))) {
                return 'Instantiate';
            }

            // Check for load/async load code
            if (normalizedCode.includes('.load()') || 
                normalizedCode.includes('.aload()')) {
                return normalizedCode.includes('async') ? 'Async load' : 'Load';
            }

            // Check for lazy load code
            if (normalizedCode.includes('lazy_load') || 
                normalizedCode.includes('alazy_load')) {
                return 'Lazy load';
            }

            // Check for output/result code
            if (normalizedCode.includes('print(') || 
                normalizedCode.includes('result') || 
                normalizedCode.includes('output')) {
                return 'Output Example';
            }

            // If no specific context is found, try to group with previous block
            const lastBlock = sections.codeBlocks.length > 0 ? sections.codeBlocks[sections.codeBlocks.length - 1] : null;
            if (lastBlock) {
                // If the previous block was an Example, keep the same context
                if (lastBlock.context === 'Example' || lastBlock.context === 'Usage Example') {
                    return lastBlock.context;
                }
                // If the code looks like a continuation of the previous block
                if (normalizedCode.includes('doc') || 
                    normalizedCode.includes('result') || 
                    normalizedCode.includes('output')) {
                    return lastBlock.context;
                }
            }

            return 'Usage Example';
        };

        // Helper function to group related code blocks
        const groupRelatedBlocks = (blocks) => {
            const groups = [];
            let currentGroup = [];
            let currentContext = null;

            blocks.forEach(block => {
                // Start a new group if context changes, or if context is 'Usage Example' and previous was not
                if (block.context !== currentContext || (block.context === 'Usage Example' && currentContext !== 'Usage Example')) {
                    if (currentGroup.length > 0) {
                        groups.push({
                            context: currentContext,
                            blocks: [...currentGroup]
                        });
                    }
                    currentGroup = [block];
                    currentContext = block.context;
                } else {
                    // Add to current group if context is the same
                    currentGroup.push(block);
                }
            });

            // Add the last group
            if (currentGroup.length > 0) {
                groups.push({
                    context: currentContext,
                    blocks: currentGroup
                });
            }

            return groups;
        };

        // Handle RST-style code blocks
        docstring = docstring.replace(this.patterns.codeBlocks.rst, (_, lang, code, offset) => {
            if (!isUniqueCodeBlock(code)) {
                return ''; // Skip duplicate code blocks
            }
            const id = `__CODE_${codeBlockId++}__`;
            const beforeText = docstring.slice(0, offset);
            const context = determineContext(beforeText, code);
            
            sections.codeBlocks.push({
                id,
                language: lang || 'python',
                code: code.trim(),
                context: context
            });
            codeBlockContexts.set(id, context);
            return id;
        });

        // Handle triple backtick code blocks
        docstring = docstring.replace(this.patterns.codeBlocks.triple, (_, lang, code, offset) => {
            if (!isUniqueCodeBlock(code)) {
                return ''; // Skip duplicate code blocks
            }
            const id = `__CODE_${codeBlockId++}__`;
            const beforeText = docstring.slice(0, offset);
            const context = determineContext(beforeText, code);
            
            sections.codeBlocks.push({
                id,
                language: lang || 'python',
                code: code.trim(),
                context: context
            });
            codeBlockContexts.set(id, context);
            return id;
        });

        // Group related code blocks
        sections.codeBlocks = groupRelatedBlocks(sections.codeBlocks);

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

        // Group code blocks by context
        const codeBlocksByContext = new Map();
        sections.codeBlocks.forEach(group => {
            if (!codeBlocksByContext.has(group.context)) {
                codeBlocksByContext.set(group.context, []);
            }
            group.blocks.forEach(block => {
                codeBlocksByContext.get(group.context).push(block);
            });
        });

        // Setup section
        if (sections.setup) {
            html += `<div class="docstring-section setup-section">
                        <h4>${this.sectionIcons['Setup']} Setup</h4>
                        <div class="setup-content">`;
            
            for (const command of sections.setup.commands) {
                html += `<pre class="bash"><code>${this._formatBashCode(command)}</code></pre>`;
            }
            
            html += `</div></div>`;
        }

        // Description section - replace placeholders with code blocks
        const contextOrder = ['Output Example', 'Instantiate', 'Load', 'Async load', 'Lazy load', 'Setup', 'Usage Example', 'Example'];
        const usedBlockIds = new Set();
        if (sections.description) {
            let description = sections.description;
            // For each context, replace placeholder with code block if available
            contextOrder.forEach(context => {
                const regex = new RegExp(`^\s*${context}:\s*$`, 'im');
                const blocks = codeBlocksByContext.get(context);
                if (blocks && blocks.length > 0) {
                    // Only use the first block for this context in the description
                    const block = blocks[0];
                    const formatted = `<div class="docstring-section code-blocks-section">
                        <h4 data-context="${context}">${this.sectionIcons[context] || '💻'} ${context}</h4>
                        <div class="code-blocks-content">
                            <pre class="${block.language}"><code>${this._formatCodeBlock(block.code, block.language)}</code></pre>
                        </div>
                    </div>`;
                    description = description.replace(regex, formatted);
                    usedBlockIds.add(block.id);
                } else {
                    // If no code block, remove the placeholder line
                    description = description.replace(regex, '');
                }
            });

            // Remove any code block placeholders that remain
            sections.codeBlocks.forEach(group => {
                group.blocks.forEach(block => {
                    description = description.replace(block.id, '');
                });
            });
            // Clean up any resulting empty lines
            description = description.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
            if (description) {
                html += `<div class="docstring-section">
                            <div class="section-content description">
                                ${this._formatText(description)}
                            </div>
                        </div>`;
            }
        }

        // Add code blocks grouped by context
        for (const context of contextOrder) {
            const blocks = codeBlocksByContext.get(context);
            if (blocks && blocks.length > 0) {
                // Show all blocks for this context that weren't used in the description
                // If context is 'Usage Example', group all blocks together in one code block
                if (context === 'Usage Example' && blocks.length > 1) {
                    const combinedCode = blocks.map(block => block.code).join('\n\n');
                    html += `<div class="docstring-section code-blocks-section">
                        <h4 data-context="${context}">💻 ${context}</h4>
                        <div class="code-blocks-content">
                            <pre class="${blocks[0].language}"><code>${this._formatCodeBlock(combinedCode, blocks[0].language)}</code></pre>
                        </div>
                    </div>`;
                    blocks.forEach(block => usedBlockIds.add(block.id));
                } else {
                    blocks.forEach(block => {
                        if (!usedBlockIds.has(block.id)) {
                            html += `<div class="docstring-section code-blocks-section">
                                <h4 data-context="${context}">${this.sectionIcons[context] || '💻'} ${context}</h4>
                                <div class="code-blocks-content">
                                    <pre class="${block.language}"><code>${this._formatCodeBlock(block.code, block.language)}</code></pre>
                                </div>
                            </div>`;
                        }
                    });
                }
            }
        }

        // Parameters section
        if (sections.parameters && sections.parameters.length > 0) {
            html += `<div class="docstring-section parameters-section">
                        <h4>${this.sectionIcons['Parameters']} Parameters</h4>
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
                        <h4>${this.sectionIcons['Returns']} Returns</h4>
                        <div class="returns-content">
                            ${sections.returns.description}
                        </div>
                    </div>`;
        }

        // Raises section
        if (sections.raises && sections.raises.length > 0) {
            html += `<div class="docstring-section raises-section">
                        <h4>${this.sectionIcons['Raises']} Raises</h4>
                        <div class="raises-content">`;
            
            sections.raises.forEach(raise => {
                html += `<div class="raise-item">
                            <span class="raise-type">${raise.type}</span>
                            <span class="raise-desc">${raise.description}</span>
                        </div>`;
            });
            
            html += `</div></div>`;
        }

        // Examples section
        if (sections.examples && sections.examples.length > 0) {
            html += `<div class="docstring-section examples-section">
                        <h4>${this.sectionIcons['Examples']} Examples</h4>
                        <div class="example-content">`;
            
            sections.examples.forEach(example => {
                html += `<div class="example-item">
                            ${this._formatText(example)}
                        </div>`;
            });
            
            html += `</div></div>`;
        }

        // Add copy buttons to all code blocks
        setTimeout(() => {
            document.querySelectorAll('pre code').forEach(block => {
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block-wrapper';
                block.parentNode.insertBefore(wrapper, block);
                wrapper.appendChild(block);
                wrapper.appendChild(this._addCopyButton(block));
            });
        }, 0);

        return html;
    }

    /**
     * Format text content with proper HTML formatting
     * @private
     */
    _formatText(text) {
        if (!text) return '';

        // Handle RST dropdowns as real collapsible sections
        text = this._extractAndFormatDropdowns(text);

        // Handle special markers
        text = text.replace(this.patterns.markers.beta, '<div class="rst-beta"><span class="rst-icon">🧪</span> <strong>Beta Feature</strong></div>');
        text = text.replace(this.patterns.markers.deprecated, (_, version) => 
            `<div class="rst-deprecated"><span class="rst-icon">🛑</span> <strong>Deprecated:</strong> ${version}</div>`
        );
        text = text.replace(this.patterns.markers.versionChanged, (_, note) => 
            `<div class="rst-versionchanged"><span class="rst-icon">ℹ️</span> <strong>Version changed:</strong> ${note}</div>`
        );
        text = text.replace(this.patterns.markers.versionAdded, (_, note) => 
            `<div class="rst-versionadded"><span class="rst-icon">✨</span> <strong>New in version:</strong> ${note}</div>`
        );

        // Handle API references and migration guides
        text = text.replace(this.patterns.references.apiRef, (_, path) => 
            `<a href="https://api.python.langchain.com/en/latest/${path}" target="_blank" class="api-ref">API Reference</a>`
        );
        text = text.replace(this.patterns.references.migrationGuide, (_, path) => 
            `<a href="https://python.langchain.com/docs/versions/migrating${path}" target="_blank" class="migration-guide">Migration Guide</a>`
        );

        // RST directives and important notes (except dropdown)
        text = text.replace(/^\s*\.\.\s*versionchanged::(.*)$/gim, '<div class="rst-versionchanged"><span class="rst-icon">ℹ️</span> <strong>Version changed:</strong>$1</div>');
        text = text.replace(/^\s*\.\.\s*note::(.*)$/gim, '<div class="rst-note"><span class="rst-icon">💡</span> <strong>Note:</strong>$1</div>');
        text = text.replace(/^\s*\.\.\s*warning::(.*)$/gim, '<div class="rst-warning"><span class=\"rst-icon\">⚠️</span> <strong>Warning:</strong>$1</div>');
        text = text.replace(/^\s*\.\.\s*deprecated::(.*)$/gim, '<div class="rst-deprecated"><span class="rst-icon">🛑</span> <strong>Deprecated:</strong>$1</div>');
        text = text.replace(/^\s*Deprecated(.*)$/gim, '<div class="rst-deprecated"><span class="rst-icon">🛑</span> <strong>Deprecated:</strong>$1</div>');

        // Replace inline code with potential class references
        text = text.replace(/`([^`]+)`/g, (_, code) => {
            if (this._looksLikeClass(code)) {
                return `<code class="code-class">${code}</code>`;
            }
            return `<code>${code}</code>`;
        });

        // Replace URLs with clickable links
        text = text.replace(
            /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g,
            '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        );

        // Replace line breaks with paragraphs
        text = text.split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join('');
        // Replace single line breaks with <br>
        text = text.replace(/\n/g, '<br>');
        return text;
    }

    // Helper to extract and format .. dropdown:: blocks as collapsible sections
    _extractAndFormatDropdowns(text) {
        let dropdownId = 0;
        // Regex to match .. dropdown:: and its indented content
        const dropdownRegex = /(^|\n)\s*\.\.\s*dropdown::(.*?)(\n(?:(?: {2,}|\t).+\n?)*)/g;
        return text.replace(dropdownRegex, (match, pre, summary, content) => {
            dropdownId++;
            // Clean up summary and content
            let summaryText = summary.trim();
            // Remove leading code>, text>, or similar prefixes
            summaryText = summaryText.replace(/^(code|text|output|example|note|tip|info|warning|danger|important)\s*>\s*/i, '');
            const contentText = (content || '').replace(/^( {2,}|\t)/gm, '').trim();
            const id = `rst-dropdown-${Date.now()}-${dropdownId}`;
            return `
                <div class="rst-dropdown-collapsible">
                    <button class="rst-dropdown-toggle" type="button" data-target="${id}">▼ <strong>${summaryText}</strong></button>
                    <div class="rst-dropdown-content" id="${id}" style="display:none;">
                        ${this._formatText(contentText)}
                    </div>
                </div>
            `;
        });
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
     * Enhanced code block formatting with better language detection and syntax highlighting
     * @private
     */
    _formatCodeBlock(code, language) {
        // First detect/verify language if not specified
        if (!language || language === 'text') {
            language = this._detectLanguage(code);
        }

        // Escape HTML
        code = this._escapeHtml(code);

        switch (language.toLowerCase()) {
            case 'python':
            case 'py':
            case 'python3':
                return this._formatPythonCode(code);
            case 'bash':
            case 'shell':
            case 'sh':
                return this._formatBashCode(code);
            case 'yaml':
            case 'yml':
                return this._formatYamlCode(code);
            default:
                return code;
        }
    }

    /**
     * Enhanced language detection based on code content
     * @private
     */
    _detectLanguage(code) {
        // Python detection
        if (this.languagePatterns.python.keywords.test(code) ||
            this.languagePatterns.python.builtins.test(code) ||
            this.languagePatterns.python.imports.test(code)) {
            return 'python';
        }

        // Bash detection
        if (this.languagePatterns.bash.keywords.test(code) ||
            this.languagePatterns.bash.flags.test(code)) {
            return 'bash';
        }

        // YAML detection
        if (this.languagePatterns.yaml.patterns.test(code) &&
            this.languagePatterns.yaml.lists.test(code)) {
            return 'yaml';
        }

        return 'text';
    }

    /**
     * Enhanced Python code formatting
     * @private
     */
    _formatPythonCode(code) {
        // Store string literals
        const strings = [];
        code = code.replace(/(["'])((?:\\.|[^\\])*?)\1/g, (match) => {
            strings.push(match);
            return `__STRING_${strings.length - 1}__`;
        });

        // Highlight keywords
        code = code.replace(
            /\b(def|class|import|from|return|if|else|elif|for|in|while|try|except|with|as|lambda|async|await)\b/g,
            '<span class="keyword">$1</span>'
        );

        // Highlight built-in functions and types
        code = code.replace(
            /\b(print|len|str|int|dict|list|tuple|set|bool|None|True|False)\b/g,
            '<span class="builtin">$1</span>'
        );

        // Highlight decorators
        code = code.replace(
            /(@[\w.]+)/g,
            '<span class="decorator">$1</span>'
        );

        // Highlight function calls
        code = code.replace(
            /(\w+)\(/g,
            '<span class="function">$1</span>('
        );

        // Restore strings with highlighting
        code = code.replace(/__STRING_(\d+)__/g, (_, i) => 
            `<span class="string">${strings[i]}</span>`
        );

        // Add line numbers
        const lines = code.split('\n');
        return lines.map((line, i) => 
            `<span class="line-number">${i + 1}</span>${line}`
        ).join('\n');
    }

    /**
     * Enhanced YAML code formatting
     * @private
     */
    _formatYamlCode(code) {
        return code
            // Highlight keys
            .replace(/^(\s*)([\w-]+):/gm, '$1<span class="yaml-key">$2</span>:')
            // Highlight values
            .replace(/:\s*(.+)$/gm, ': <span class="yaml-value">$1</span>')
            // Highlight lists
            .replace(/^(\s*)-\s+/gm, '$1<span class="yaml-list">-</span> ');
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

    /**
     * Add copy button to code blocks
     * @private
     */
    _addCopyButton(codeElement) {
        const button = document.createElement('button');
        button.className = 'copy-button';
        button.innerHTML = '📋';
        button.title = 'Copy to clipboard';
        
        button.addEventListener('click', () => {
            const code = codeElement.textContent;
            navigator.clipboard.writeText(code).then(() => {
                button.innerHTML = '✓';
                setTimeout(() => {
                    button.innerHTML = '📋';
                }, 2000);
            });
        });

        return button;
    }
}

// Add CSS styles for the enhanced features
const style = document.createElement('style');
style.textContent = `
    .code-block-wrapper {
        position: relative;
        margin: 1em 0;
    }

    .copy-button {
        position: absolute;
        top: 5px;
        right: 5px;
        padding: 5px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 3px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
    }

    .copy-button:hover {
        opacity: 1;
    }

    .line-number {
        color: #999;
        margin-right: 1em;
        user-select: none;
    }

    .keyword { color: #007acc; }
    .builtin { color: #0000ff; }
    .string { color: #a31515; }
    .decorator { color: #af00db; }
    .function { color: #795e26; }
    
    .yaml-key { color: #007acc; }
    .yaml-value { color: #a31515; }
    .yaml-list { color: #0000ff; }

    .parameter-row:hover {
        background-color: #f5f5f5;
    }

    .rst-dropdown-collapsible {
        margin: 1em 0;
        border: 1px solid #ddd;
        border-radius: 4px;
    }

    .rst-dropdown-toggle {
        width: 100%;
        text-align: left;
        padding: 10px;
        background: #f5f5f5;
        border: none;
        cursor: pointer;
    }

    .rst-dropdown-content {
        padding: 10px;
        border-top: 1px solid #ddd;
    }

    .rst-note, .rst-warning, .rst-deprecated {
        margin: 1em 0;
        padding: 10px;
        border-radius: 4px;
    }

    .rst-note { background: #e8f4f8; }
    .rst-warning { background: #fff3cd; }
    .rst-deprecated { background: #ffe6e6; }

    .parameter-table {
        border-collapse: collapse;
        width: 100%;
    }

    .parameter-row {
        border-bottom: 1px solid #eee;
    }

    .param-name {
        font-weight: bold;
        color: #007acc;
    }

    .param-type {
        color: #795e26;
        font-family: monospace;
    }

    .default-value {
        color: #098658;
        font-style: italic;
    }

    .rst-beta {
        margin: 1em 0;
        padding: 10px;
        background: #e8f4f8;
        border-radius: 4px;
        border-left: 4px solid #007acc;
    }

    .rst-versionadded {
        margin: 1em 0;
        padding: 10px;
        background: #e8f4f8;
        border-radius: 4px;
        border-left: 4px solid #098658;
    }

    .api-ref, .migration-guide {
        display: inline-block;
        padding: 2px 6px;
        background: #f5f5f5;
        border-radius: 3px;
        text-decoration: none;
        color: #007acc;
        font-size: 0.9em;
    }

    .api-ref:hover, .migration-guide:hover {
        background: #e8f4f8;
    }

    .output-block {
        background: #f8f8f8;
        border-left: 4px solid #666;
        padding: 10px;
        margin: 1em 0;
        font-family: monospace;
    }

    .configuration-block {
        background: #f8f8f8;
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 10px;
        margin: 1em 0;
    }

    .configuration-key {
        color: #007acc;
        font-weight: bold;
    }

    .configuration-value {
        color: #098658;
    }

    .configuration-comment {
        color: #666;
        font-style: italic;
    }
`;

document.head.appendChild(style); 