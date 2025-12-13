import { useRef, useCallback, useState } from 'react';
import { Edit, Eye, Link2, Unlink } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function SyncScrollEditor({
    content,
    onChange,
    placeholder = "Write your markdown content here...",
    editorHeight = "500px",
    showHeader = true,
    editorTitle = "Markdown Editor",
    previewTitle = "Live Preview",
    customEditorHeader = null // For custom header like filename input
}) {
    const editorRef = useRef(null);
    const previewRef = useRef(null);
    const isSyncingRef = useRef(false);
    const [syncScrollEnabled, setSyncScrollEnabled] = useState(true);

    // Editor → Preview scroll sync
    const handleEditorScroll = useCallback(() => {
        if (!syncScrollEnabled || isSyncingRef.current) return;

        const editor = editorRef.current;
        const preview = previewRef.current;
        if (!editor || !preview) return;

        const maxEditorScroll = editor.scrollHeight - editor.clientHeight;
        if (maxEditorScroll <= 0) return;

        // Calculate scroll percentage
        const scrollPercent = editor.scrollTop / maxEditorScroll;

        // Apply same percentage to preview
        const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;
        const targetScroll = scrollPercent * maxPreviewScroll;

        // Prevent feedback loop
        isSyncingRef.current = true;
        preview.scrollTop = targetScroll;

        // Reset sync flag after scroll completes
        requestAnimationFrame(() => {
            isSyncingRef.current = false;
        });
    }, [syncScrollEnabled]);

    // Preview → Editor scroll sync
    const handlePreviewScroll = useCallback(() => {
        if (!syncScrollEnabled || isSyncingRef.current) return;

        const editor = editorRef.current;
        const preview = previewRef.current;
        if (!editor || !preview) return;

        const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;
        if (maxPreviewScroll <= 0) return;

        // Calculate scroll percentage
        const scrollPercent = preview.scrollTop / maxPreviewScroll;

        // Apply same percentage to editor
        const maxEditorScroll = editor.scrollHeight - editor.clientHeight;
        const targetScroll = scrollPercent * maxEditorScroll;

        // Prevent feedback loop
        isSyncingRef.current = true;
        editor.scrollTop = targetScroll;

        // Reset sync flag after scroll completes
        requestAnimationFrame(() => {
            isSyncingRef.current = false;
        });
    }, [syncScrollEnabled]);

    // Render editor header content
    const renderEditorHeader = () => {
        if (customEditorHeader) {
            return customEditorHeader;
        }
        return (
            <>
                <Edit className="w-5 h-5 text-purple-600" />
                <span>{editorTitle}</span>
            </>
        );
    };

    return (
        <div className="space-y-3">
            {/* Sync Scroll Toggle */}
            <div className="flex items-center justify-end">
                <label className="flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition">
                    <input
                        type="checkbox"
                        checked={syncScrollEnabled}
                        onChange={(e) => setSyncScrollEnabled(e.target.checked)}
                        className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                    />
                    {syncScrollEnabled ? (
                        <Link2 className="w-4 h-4 text-purple-600" />
                    ) : (
                        <Unlink className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`text-sm font-medium ${syncScrollEnabled ? 'text-purple-600' : 'text-gray-500'}`}>
                        Sync Scroll
                    </span>
                </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Editor */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {showHeader && (
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2 flex-1">
                                {renderEditorHeader()}
                            </h2>
                            {syncScrollEnabled && (
                                <div className="flex items-center gap-1 text-xs text-purple-600">
                                    <Link2 className="w-3 h-3" />
                                    <span>Synced</span>
                                </div>
                            )}
                        </div>
                    )}
                    <textarea
                        ref={editorRef}
                        value={content}
                        onChange={(e) => onChange(e.target.value)}
                        onScroll={handleEditorScroll}
                        placeholder={placeholder}
                        className="w-full flex-1 p-4 font-mono text-sm resize-none focus:outline-none"
                        style={{ height: editorHeight, minHeight: editorHeight }}
                    />
                </div>

                {/* Preview */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {showHeader && (
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-purple-600" />
                                {previewTitle}
                            </h2>
                            <div className="flex items-center gap-1 text-xs text-green-600">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                <span>Live</span>
                            </div>
                        </div>
                    )}
                    <div
                        ref={previewRef}
                        onScroll={handlePreviewScroll}
                        className="p-6 overflow-y-auto"
                        style={{ height: editorHeight, maxHeight: editorHeight, overflowY: 'auto' }}
                    >
                        <MarkdownRenderer content={content || '*Start typing to see preview...*'} />
                    </div>
                </div>
            </div>
        </div>
    );
}
