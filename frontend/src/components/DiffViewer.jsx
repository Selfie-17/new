import { useMemo } from 'react';
import { Plus, Minus, Equal } from 'lucide-react';

export default function DiffViewer({ oldContent, newContent, oldTitle = 'Original', newTitle = 'Modified' }) {
    const diff = useMemo(() => {
        const oldLines = oldContent.split('\n');
        const newLines = newContent.split('\n');

        // Simple line-by-line diff
        const result = [];
        const maxLength = Math.max(oldLines.length, newLines.length);

        // LCS-based diff algorithm
        const lcs = computeLCS(oldLines, newLines);

        let oldIdx = 0;
        let newIdx = 0;
        let lcsIdx = 0;

        while (oldIdx < oldLines.length || newIdx < newLines.length) {
            if (lcsIdx < lcs.length && oldIdx < oldLines.length && oldLines[oldIdx] === lcs[lcsIdx]) {
                if (newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
                    result.push({ type: 'unchanged', oldLine: oldLines[oldIdx], newLine: newLines[newIdx], oldNum: oldIdx + 1, newNum: newIdx + 1 });
                    oldIdx++;
                    newIdx++;
                    lcsIdx++;
                } else {
                    result.push({ type: 'added', newLine: newLines[newIdx], newNum: newIdx + 1 });
                    newIdx++;
                }
            } else if (lcsIdx < lcs.length && newIdx < newLines.length && newLines[newIdx] === lcs[lcsIdx]) {
                result.push({ type: 'removed', oldLine: oldLines[oldIdx], oldNum: oldIdx + 1 });
                oldIdx++;
            } else if (oldIdx < oldLines.length && newIdx < newLines.length) {
                result.push({ type: 'removed', oldLine: oldLines[oldIdx], oldNum: oldIdx + 1 });
                result.push({ type: 'added', newLine: newLines[newIdx], newNum: newIdx + 1 });
                oldIdx++;
                newIdx++;
            } else if (oldIdx < oldLines.length) {
                result.push({ type: 'removed', oldLine: oldLines[oldIdx], oldNum: oldIdx + 1 });
                oldIdx++;
            } else if (newIdx < newLines.length) {
                result.push({ type: 'added', newLine: newLines[newIdx], newNum: newIdx + 1 });
                newIdx++;
            }
        }

        return result;
    }, [oldContent, newContent]);

    const stats = useMemo(() => {
        const added = diff.filter(d => d.type === 'added').length;
        const removed = diff.filter(d => d.type === 'removed').length;
        const unchanged = diff.filter(d => d.type === 'unchanged').length;
        return { added, removed, unchanged };
    }, [diff]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-4">
                <h2 className="font-semibold text-gray-900">Changes</h2>
                <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-600">
                        <Plus className="w-4 h-4" />
                        {stats.added} additions
                    </span>
                    <span className="flex items-center gap-1 text-red-600">
                        <Minus className="w-4 h-4" />
                        {stats.removed} deletions
                    </span>
                    <span className="flex items-center gap-1 text-gray-500">
                        <Equal className="w-4 h-4" />
                        {stats.unchanged} unchanged
                    </span>
                </div>
            </div>

            {/* Diff Content */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm font-mono">
                    <thead className="bg-gray-100 text-gray-600 text-xs">
                        <tr>
                            <th className="px-3 py-2 text-left w-12">#</th>
                            <th className="px-3 py-2 text-left">{oldTitle}</th>
                            <th className="px-3 py-2 text-left w-12">#</th>
                            <th className="px-3 py-2 text-left">{newTitle}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {diff.map((line, index) => (
                            <tr key={index} className={getRowClass(line.type)}>
                                <td className="px-3 py-1 text-gray-400 border-r border-gray-200 select-none">
                                    {line.type !== 'added' ? line.oldNum : ''}
                                </td>
                                <td className={`px-3 py-1 border-r border-gray-200 ${line.type === 'removed' ? 'bg-red-100' : ''}`}>
                                    {line.type !== 'added' && (
                                        <div className="flex items-center gap-2">
                                            {line.type === 'removed' && <Minus className="w-3 h-3 text-red-500 flex-shrink-0" />}
                                            <span className={line.type === 'removed' ? 'text-red-700' : ''}>{line.oldLine}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-3 py-1 text-gray-400 border-r border-gray-200 select-none">
                                    {line.type !== 'removed' ? line.newNum : ''}
                                </td>
                                <td className={`px-3 py-1 ${line.type === 'added' ? 'bg-green-100' : ''}`}>
                                    {line.type !== 'removed' && (
                                        <div className="flex items-center gap-2">
                                            {line.type === 'added' && <Plus className="w-3 h-3 text-green-500 flex-shrink-0" />}
                                            <span className={line.type === 'added' ? 'text-green-700' : ''}>{line.newLine}</span>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function getRowClass(type) {
    switch (type) {
        case 'added':
            return 'bg-green-50';
        case 'removed':
            return 'bg-red-50';
        default:
            return 'hover:bg-gray-50';
    }
}

// Compute Longest Common Subsequence
function computeLCS(arr1, arr2) {
    const m = arr1.length;
    const n = arr2.length;
    const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (arr1[i - 1] === arr2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }

    // Backtrack to find LCS
    const lcs = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
        if (arr1[i - 1] === arr2[j - 1]) {
            lcs.unshift(arr1[i - 1]);
            i--;
            j--;
        } else if (dp[i - 1][j] > dp[i][j - 1]) {
            i--;
        } else {
            j--;
        }
    }

    return lcs;
}
