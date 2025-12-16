import { createRoot } from 'react-dom/client';

/**
 * Downloads a markdown file as PDF using browser's print dialog
 * This is the most reliable method for generating PDFs that match the preview
 * @param {Object} file - File object with name and content properties
 * @param {Function} MarkdownRenderer - The MarkdownRenderer component
 */
export const downloadAsPdf = async (file, MarkdownRenderer = null) => {
    try {
        const title = file.name.replace('.md', '');
        const date = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Create a hidden iframe for printing
        const iframe = document.createElement('iframe');
        iframe.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

        // Copy all stylesheets from the main document
        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(el => el.outerHTML)
            .join('\n');

        // Build the HTML content
        let contentHtml = '';

        if (MarkdownRenderer) {
            // Create a temporary container to render MarkdownRenderer
            const tempContainer = document.createElement('div');
            tempContainer.style.cssText = 'position: absolute; left: -9999px; top: 0;';
            document.body.appendChild(tempContainer);

            const root = createRoot(tempContainer);

            await new Promise((resolve) => {
                const ContentWrapper = () => (
                    <div className="pdf-content markdown-preview prose" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
                        <MarkdownRenderer content={file.content} />
                    </div>
                );
                root.render(<ContentWrapper />);
                // Wait for render
                setTimeout(resolve, 1000);
            });

            contentHtml = tempContainer.innerHTML;
            root.unmount();
            document.body.removeChild(tempContainer);
        } else {
            // Try to get existing preview or convert markdown
            const existingPreview = document.querySelector('.markdown-preview');
            if (existingPreview) {
                contentHtml = existingPreview.innerHTML;
            } else {
                contentHtml = convertMarkdownToHtml(file.content, file.name);
            }
        }

        // Write the full document to the iframe
        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                ${styles}
                <style>
                    @media print {
                        body { margin: 0; padding: 20mm; }
                        @page { margin: 15mm; }
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;
                        color: #1f2937;
                        background: white;
                        padding: 40px;
                    }
                    .header {
                        margin-bottom: 24px;
                        padding-bottom: 16px;
                        border-bottom: 3px solid #8b5cf6;
                    }
                    .header h1 {
                        font-size: 24px;
                        font-weight: bold;
                        color: #8b5cf6;
                        margin: 0 0 8px 0;
                    }
                    .header p {
                        font-size: 12px;
                        color: #6b7280;
                        margin: 0;
                    }
                    /* Ensure code blocks are styled */
                    pre {
                        background: #1e1e1e;
                        color: #d4d4d4;
                        padding: 16px;
                        border-radius: 8px;
                        overflow-x: auto;
                        font-family: 'Consolas', 'Monaco', monospace;
                        font-size: 13px;
                    }
                    code {
                        font-family: 'Consolas', 'Monaco', monospace;
                    }
                    /* Inline code */
                    p code, li code {
                        background: #f3f4f6;
                        color: #e11d48;
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-size: 0.9em;
                    }
                    /* Tables */
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 16px 0;
                    }
                    th, td {
                        border: 1px solid #e5e7eb;
                        padding: 10px;
                        text-align: left;
                    }
                    th {
                        background: #f9fafb;
                        font-weight: 600;
                    }
                    /* Blockquotes */
                    blockquote {
                        border-left: 4px solid #8b5cf6;
                        background: #f8f5ff;
                        padding: 12px 16px;
                        margin: 16px 0;
                        border-radius: 0 8px 8px 0;
                    }
                    /* Headers */
                    h1, h2, h3, h4, h5, h6 {
                        margin-top: 24px;
                        margin-bottom: 12px;
                        font-weight: bold;
                    }
                    h1 { font-size: 28px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
                    h2 { font-size: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
                    h3 { font-size: 20px; }
                    h4 { font-size: 18px; }
                    /* Lists */
                    ul, ol {
                        padding-left: 24px;
                        margin: 12px 0;
                    }
                    li {
                        margin: 6px 0;
                    }
                    /* Links */
                    a {
                        color: #8b5cf6;
                        text-decoration: none;
                    }
                    /* Images */
                    img {
                        max-width: 100%;
                        height: auto;
                        border-radius: 8px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${title}</h1>
                    <p>Generated on ${date}</p>
                </div>
                <div class="content markdown-preview prose">
                    ${contentHtml}
                </div>
            </body>
            </html>
        `);
        iframeDoc.close();

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 500));

        // Trigger print dialog
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Cleanup after a delay
        setTimeout(() => {
            document.body.removeChild(iframe);
        }, 1000);

    } catch (error) {
        console.error('PDF generation error:', error);
        alert('Failed to generate PDF. Please use Ctrl+P (Cmd+P on Mac) and select "Save as PDF".');
    }
};

/**
 * Fallback: Convert markdown to styled HTML
 */
function convertMarkdownToHtml(content, fileName) {
    if (!content) return '<p>No content</p>';

    let html = content;

    // Process code blocks first (before escaping)
    const codeBlocks = [];
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ lang, code: code.trim() });
        return placeholder;
    });

    // Escape HTML
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Restore code blocks
    codeBlocks.forEach((block, i) => {
        const escapedCode = block.code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(
            `__CODE_BLOCK_${i}__`,
            `<pre><code>${escapedCode}</code></pre>`
        );
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^######\s+(.*)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Blockquotes
    html = html.replace(/^&gt;\s+(.*)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Lists
    html = html.replace(/^- \[x\]\s+(.*)$/gm, '<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;"><span style="color: #22c55e;">✓</span>$1</div>');
    html = html.replace(/^- \[ \]\s+(.*)$/gm, '<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0;"><span>☐</span>$1</div>');
    html = html.replace(/^[-*]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');

    // Tables
    html = processMarkdownTables(html);

    // Line breaks to paragraphs
    const lines = html.split('\n');
    html = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('<') && trimmed.length > 0) {
            return `<p>${trimmed}</p>`;
        }
        return line;
    }).join('\n');

    // Clean empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
}

function processMarkdownTables(html) {
    const tableRegex = /\|(.+)\|\n\|[-:| ]+\|\n((?:\|.+\|\n?)+)/g;

    return html.replace(tableRegex, (match, headerRow, bodyRows) => {
        const headers = headerRow.split('|').filter(cell => cell.trim());
        const headerHtml = headers.map(h => `<th>${h.trim()}</th>`).join('');

        const rows = bodyRows.trim().split('\n');
        const bodyHtml = rows.map(row => {
            const cells = row.split('|').filter(cell => cell.trim());
            return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
        }).join('');

        return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
    });
}

export default downloadAsPdf;
