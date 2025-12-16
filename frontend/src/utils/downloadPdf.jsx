import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import html2pdf from 'html2pdf.js';

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
                <title>${title}.pdf</title>
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

/**
 * Generate a PDF blob from a file (for batch processing)
 * Uses iframe-based rendering for proper style inheritance, then html2pdf for capture
 */
async function generatePdfBlob(file, MarkdownRenderer = null) {
    return new Promise(async (resolve, reject) => {
        let iframe = null;
        let root = null;

        try {
            console.log(`[PDF] Generating PDF for: ${file.name}`);

            const title = file.name.replace('.md', '');
            const date = new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            // Create iframe for isolated rendering with proper styles
            iframe = document.createElement('iframe');
            iframe.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 800px;
                height: 1200px;
                border: 0;
                z-index: 99999;
                background: white;
            `;
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // Copy all stylesheets from main document
            const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
                .map(el => el.outerHTML)
                .join('\n');

            // Write the HTML structure to iframe
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${title}</title>
                    ${styles}
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            line-height: 1.6;
                            color: #1f2937;
                            background: white;
                            padding: 40px;
                            margin: 0;
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
                        p code, li code {
                            background: #f3f4f6;
                            color: #e11d48;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 0.9em;
                        }
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
                        blockquote {
                            border-left: 4px solid #8b5cf6;
                            background: #f8f5ff;
                            padding: 12px 16px;
                            margin: 16px 0;
                            border-radius: 0 8px 8px 0;
                        }
                        h1, h2, h3, h4, h5, h6 {
                            margin-top: 24px;
                            margin-bottom: 12px;
                            font-weight: bold;
                        }
                        h1 { font-size: 28px; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; }
                        h2 { font-size: 24px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
                        h3 { font-size: 20px; }
                        ul, ol { padding-left: 24px; margin: 12px 0; }
                        li { margin: 6px 0; }
                        a { color: #8b5cf6; text-decoration: none; }
                        img { max-width: 100%; height: auto; border-radius: 8px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>${title}</h1>
                        <p>Generated on ${date}</p>
                    </div>
                    <div id="content" class="markdown-preview prose"></div>
                </body>
                </html>
            `);
            iframeDoc.close();

            // Wait for iframe to be ready
            await new Promise(r => setTimeout(r, 100));

            const contentContainer = iframeDoc.getElementById('content');

            // Render markdown content
            if (MarkdownRenderer) {
                // Use React MarkdownRenderer if provided
                root = createRoot(contentContainer);
                await new Promise((resolveRender) => {
                    root.render(<MarkdownRenderer content={file.content || ''} />);
                    setTimeout(resolveRender, 800);
                });
            } else {
                // Fall back to simple HTML conversion
                contentContainer.innerHTML = convertMarkdownToHtml(file.content || '# No Content', file.name);
            }

            // Wait for content to fully render
            await new Promise(r => setTimeout(r, 500));

            console.log(`[PDF] Content rendered, size: ${contentContainer.innerHTML.length} chars`);

            // Generate PDF using html2pdf on iframe body
            const pdfOptions = {
                margin: 10,
                filename: file.name.replace('.md', '.pdf'),
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 794,
                    windowWidth: 794
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf()
                .set(pdfOptions)
                .from(iframeDoc.body)
                .outputPdf('blob');

            // Cleanup
            if (root) root.unmount();
            if (iframe && iframe.parentNode) {
                document.body.removeChild(iframe);
            }

            console.log(`[PDF] Success: ${file.name}, size: ${pdfBlob.size} bytes`);
            resolve(pdfBlob);
        } catch (error) {
            console.error(`[PDF] Error generating PDF for ${file.name}:`, error);
            // Cleanup on error
            if (root) try { root.unmount(); } catch (e) { }
            if (iframe && iframe.parentNode) {
                try { document.body.removeChild(iframe); } catch (e) { }
            }
            reject(error);
        }
    });
}

/**
 * Download all files in a folder as PDFs in a ZIP archive
 * @param {Array} files - Array of file objects with name and content properties
 * @param {string} folderName - Name of the folder (used for ZIP filename)
 * @param {Function} onProgress - Optional callback for progress updates (0-100)
 * @param {Function} MarkdownRenderer - Optional MarkdownRenderer component for proper rendering
 */
export const downloadFolderAsPdfs = async (files, folderName, onProgress = null, MarkdownRenderer = null) => {
    try {
        console.log(`[ZIP PDF] Starting folder PDF download for: ${folderName}`);
        console.log(`[ZIP PDF] Total files received: ${files?.length || 0}`);

        if (!files || files.length === 0) {
            throw new Error('No files to download');
        }

        // Log each file
        files.forEach((f, i) => {
            console.log(`[ZIP PDF] File ${i + 1}: ${f.name}, content length: ${f.content?.length || 0}`);
        });

        const zip = new JSZip();
        const totalFiles = files.length;
        let completedFiles = 0;
        let failedFiles = 0;

        // Process each file sequentially
        for (const file of files) {
            try {
                console.log(`[ZIP PDF] Processing: ${file.name}`);

                // Ensure file has content (use placeholder if empty)
                const fileToProcess = {
                    ...file,
                    content: file.content || `# ${file.name}\n\nThis file has no content.`
                };

                // Generate PDF blob for this file (pass MarkdownRenderer for proper rendering)
                const pdfBlob = await generatePdfBlob(fileToProcess, MarkdownRenderer);

                if (pdfBlob && pdfBlob.size > 100) { // PDF should be at least 100 bytes
                    const pdfFileName = file.name.replace('.md', '.pdf');
                    zip.file(pdfFileName, pdfBlob);
                    console.log(`[ZIP PDF] Success: ${pdfFileName} (${pdfBlob.size} bytes)`);
                    completedFiles++;
                } else {
                    console.warn(`[ZIP PDF] PDF too small for ${file.name}: ${pdfBlob?.size || 0} bytes`);
                    failedFiles++;
                }

                if (onProgress) {
                    onProgress(Math.round(((completedFiles + failedFiles) / totalFiles) * 100));
                }

                // Small delay between files to prevent browser overload
                await new Promise(r => setTimeout(r, 200));
            } catch (fileError) {
                console.error(`[ZIP PDF] Error processing ${file.name}:`, fileError);
                failedFiles++;
            }
        }

        console.log(`[ZIP PDF] Done: ${completedFiles} success, ${failedFiles} failed`);

        if (completedFiles === 0) {
            console.error('[ZIP PDF] No PDFs were generated successfully');
            throw new Error('Failed to generate any PDFs. Check browser console for details.');
        }

        // Generate and download ZIP
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        console.log(`[ZIP PDF] ZIP size: ${zipBlob.size} bytes`);
        saveAs(zipBlob, `${folderName}_PDFs.zip`);

        return { success: true, filesProcessed: completedFiles, totalFiles, failedFiles };

    } catch (error) {
        console.error('[ZIP PDF] Fatal error:', error);
        throw error;
    }
};

/**
 * Download all files in a folder as a ZIP of markdown files
 * @param {Array} files - Array of file objects with name and content properties
 * @param {string} folderName - Name of the folder (used for ZIP filename)
 * @param {Function} onProgress - Optional callback for progress updates (0-100)
 */
export const downloadFolderAsMd = async (files, folderName, onProgress = null) => {
    try {
        console.log(`[ZIP MD] Starting folder MD download for: ${folderName}`);
        console.log(`[ZIP MD] Total files received: ${files?.length || 0}`);

        if (!files || files.length === 0) {
            throw new Error('No files to download');
        }

        const zip = new JSZip();
        const totalFiles = files.length;
        let completedFiles = 0;

        // Process each file
        for (const file of files) {
            try {
                console.log(`[ZIP MD] Adding: ${file.name}`);

                // Add markdown file to ZIP
                const content = file.content || `# ${file.name}\n\nThis file has no content.`;
                zip.file(file.name, content);

                completedFiles++;
                if (onProgress) {
                    onProgress(Math.round((completedFiles / totalFiles) * 100));
                }
            } catch (fileError) {
                console.error(`[ZIP MD] Error adding ${file.name}:`, fileError);
            }
        }

        console.log(`[ZIP MD] Done: ${completedFiles} files added`);

        // Generate and download ZIP
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        console.log(`[ZIP MD] ZIP size: ${zipBlob.size} bytes`);
        saveAs(zipBlob, `${folderName}_Markdown.zip`);

        return { success: true, filesProcessed: completedFiles, totalFiles };

    } catch (error) {
        console.error('[ZIP MD] Fatal error:', error);
        throw error;
    }
};

/**
 * Download a single file as markdown
 * @param {Object} file - File object with name and content properties
 */
export const downloadAsMd = (file) => {
    try {
        const blob = new Blob([file.content || ''], { type: 'text/markdown;charset=utf-8' });
        saveAs(blob, file.name.endsWith('.md') ? file.name : `${file.name}.md`);
    } catch (error) {
        console.error('Error downloading markdown:', error);
        throw error;
    }
};

export default downloadAsPdf;
