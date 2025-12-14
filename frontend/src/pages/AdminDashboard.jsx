import { useState, useEffect } from 'react';
import {
    FileText,
    CheckCircle,
    XCircle,
    Clock,
    Eye,
    Users,
    TrendingUp,
    AlertCircle,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    GitCompare,
    Edit,
    Columns,
    Trash2,
    UserCog,
    Save,
    Globe,
    EyeOff,
    ToggleLeft,
    ToggleRight,
    Folder,
    ChevronRight,
    ArrowLeft,
    Home,
    Github,
    RefreshCw,
    Loader2,
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import axios from '../config/axiosConfig';
import DiffViewer from '../components/DiffViewer';
import MarkdownRenderer from '../components/MarkdownRenderer';

// Demo data for fallback
const demoUsers = [
    { _id: 'u1', name: 'Admin User', email: 'admin@example.com', role: 'admin' },
    { _id: 'u2', name: 'John Editor', email: 'john@example.com', role: 'editor' },
    { _id: 'u3', name: 'Jane Editor', email: 'jane@example.com', role: 'editor' },
    { _id: 'u4', name: 'Bob Viewer', email: 'bob@example.com', role: 'viewer' }
];

const demoEdits = [
    {
        _id: 'e1',
        file: {
            _id: '1',
            name: 'README.md',
            content: '# Welcome to MD Collab\n\nThis is a **collaborative markdown editing platform**.\n\n## Features\n\n- Role-based access control\n- Real-time markdown preview\n- GitHub-style diff viewer\n- Approval workflow'
        },
        editor: { name: 'John Editor', email: 'john@example.com' },
        originalContent: '# Welcome to MD Collab\n\nThis is a **collaborative markdown editing platform**.\n\n## Features\n\n- Role-based access control\n- Real-time markdown preview\n- GitHub-style diff viewer\n- Approval workflow',
        newContent: '# Welcome to MD Collab Platform\n\nThis is a **powerful collaborative markdown editing platform** for teams.\n\n## Features\n\n- Role-based access control (Admin, Editor, Viewer)\n- Real-time markdown preview\n- GitHub-style diff viewer\n- Approval workflow\n- File versioning\n\n## New Section\n\nThis is a newly added section!',
        status: 'pending',
        createdAt: new Date().toISOString()
    },
    {
        _id: 'e2',
        file: { _id: '2', name: 'CONTRIBUTING.md', content: '# Contributing\n\nWelcome!' },
        editor: { name: 'Jane Editor', email: 'jane@example.com' },
        originalContent: '# Contributing\n\nWelcome!',
        newContent: '# Contributing Guide\n\nWelcome to our project!\n\n## How to Contribute\n\n1. Fork the repo\n2. Create a branch\n3. Submit a PR',
        status: 'pending',
        createdAt: new Date(Date.now() - 86400000).toISOString()
    },
    {
        _id: 'e3',
        file: { _id: '1', name: 'README.md', content: '' },
        editor: { name: 'John Editor', email: 'john@example.com' },
        originalContent: '# Old Title',
        newContent: '# New Title',
        status: 'approved',
        reviewedAt: new Date(Date.now() - 172800000).toISOString(),
        createdAt: new Date(Date.now() - 259200000).toISOString()
    }
];

const demoFiles = [
    { _id: '1', name: 'README.md', status: 'approved', published: true, author: { name: 'Admin' }, updatedAt: new Date().toISOString() },
    { _id: '2', name: 'CONTRIBUTING.md', status: 'approved', published: true, author: { name: 'Editor' }, updatedAt: new Date().toISOString() },
    { _id: '3', name: 'API.md', status: 'approved', published: false, author: { name: 'Admin' }, updatedAt: new Date().toISOString() }
];

export default function AdminDashboard() {
    const [pendingEdits, setPendingEdits] = useState(demoEdits.filter(e => e.status === 'pending'));
    const [allEdits, setAllEdits] = useState(demoEdits);
    const [users, setUsers] = useState(demoUsers);
    const [files, setFiles] = useState(demoFiles);
    const [allFiles, setAllFiles] = useState(demoFiles);
    const [selectedEdit, setSelectedEdit] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('pending');
    const [expandedEdit, setExpandedEdit] = useState(null);
    const [processing, setProcessing] = useState(null);
    const [notification, setNotification] = useState(null);
    const [rejectNotes, setRejectNotes] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(null);
    const [viewMode, setViewMode] = useState({}); // { editId: 'diff' | 'editor' }
    const [backendConnected, setBackendConnected] = useState(true);
    const [fileProcessing, setFileProcessing] = useState(null);
    const [filesTab, setFilesTab] = useState('published'); // 'published' or 'unpublished'

    // Folder navigation states for Files tab
    const [allFolders, setAllFolders] = useState([]);
    const [currentAdminFolder, setCurrentAdminFolder] = useState(null);
    const [adminFolderPath, setAdminFolderPath] = useState([]);

    // File/Folder delete states
    const [showDeleteFileModal, setShowDeleteFileModal] = useState(null);
    const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(null);
    const [deletingItem, setDeletingItem] = useState(null);
    const [bulkPublishing, setBulkPublishing] = useState(false);

    // GitHub sync state
    const [syncingFile, setSyncingFile] = useState(null);
    const [syncingFolder, setSyncingFolder] = useState(null);

    // User management states
    const [editingUser, setEditingUser] = useState(null);
    const [editUserData, setEditUserData] = useState({ name: '', email: '', role: '' });
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [userProcessing, setUserProcessing] = useState(null);

    // Sort state
    const [sortBy, setSortBy] = useState('name'); // 'name', 'date', 'author'
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc', 'desc'

    // Sort files helper function
    const sortFiles = (filesToSort) => {
        return [...filesToSort].sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'date':
                    comparison = new Date(a.updatedAt || a.createdAt) - new Date(b.updatedAt || b.createdAt);
                    break;
                case 'author':
                    const authorA = a.author?.name || a.author?.email || '';
                    const authorB = b.author?.name || b.author?.email || '';
                    comparison = authorA.localeCompare(authorB);
                    break;
                default:
                    comparison = 0;
            }

            return sortDirection === 'asc' ? comparison : -comparison;
        });
    };

    // Toggle sort direction or change sort field
    const handleSort = (field) => {
        if (sortBy === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortDirection('asc');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [editsRes, usersRes, filesRes, allFilesRes, foldersRes] = await Promise.all([
                axios.get('/api/edits/all'),
                axios.get('/api/users'),
                axios.get('/api/files'),
                axios.get('/api/files/admin/all'),
                axios.get('/api/folders/admin/all')
            ]);
            const allEditsData = editsRes.data || [];
            setPendingEdits(allEditsData.filter(e => e.status === 'pending'));
            setAllEdits(allEditsData);
            setUsers(usersRes.data || demoUsers);
            setFiles(filesRes.data || demoFiles);
            setAllFiles(allFilesRes.data || demoFiles);
            setAllFolders(foldersRes.data || []);
            setBackendConnected(true);
        } catch (error) {
            console.log('API Error, using demo data:', error.message);
            setBackendConnected(false);
            // Use demo data on error
            setPendingEdits(demoEdits.filter(e => e.status === 'pending'));
            setAllEdits(demoEdits);
            setUsers(demoUsers);
            setFiles(demoFiles);
            setAllFiles(demoFiles);
            setAllFolders([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (editId) => {
        setProcessing(editId);
        try {
            await axios.post(`/api/edits/${editId}/approve`);
            setNotification({ type: 'success', message: 'Edit approved and applied to file!' });
            fetchData();
        } catch (error) {
            // Demo mode
            setPendingEdits(prev => prev.filter(e => e._id !== editId));
            setAllEdits(prev => prev.map(e => e._id === editId ? { ...e, status: 'approved', reviewedAt: new Date().toISOString() } : e));
            setNotification({ type: 'success', message: 'Edit approved! (Demo mode)' });
        }
        setSelectedEdit(null);
        setProcessing(null);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleReject = async (editId, notes = '') => {
        setProcessing(editId);
        try {
            await axios.post(`/api/edits/${editId}/reject`, { notes });
            setNotification({ type: 'info', message: 'Edit rejected.' });
            fetchData();
        } catch (error) {
            // Demo mode
            setPendingEdits(prev => prev.filter(e => e._id !== editId));
            setAllEdits(prev => prev.map(e => e._id === editId ? { ...e, status: 'rejected', reviewedAt: new Date().toISOString(), reviewNotes: notes } : e));
            setNotification({ type: 'info', message: 'Edit rejected. (Demo mode)' });
        }
        setSelectedEdit(null);
        setShowRejectModal(null);
        setRejectNotes('');
        setProcessing(null);
        setTimeout(() => setNotification(null), 3000);
    };

    const openRejectModal = (editId) => {
        setShowRejectModal(editId);
        setRejectNotes('');
    };

    const getViewMode = (editId) => viewMode[editId] || 'diff';

    const toggleViewMode = (editId) => {
        setViewMode(prev => ({
            ...prev,
            [editId]: prev[editId] === 'editor' ? 'diff' : 'editor'
        }));
    };

    // User Management Functions
    const startEditUser = (user) => {
        setEditingUser(user._id);
        setEditUserData({ name: user.name, email: user.email, role: user.role });
    };

    const cancelEditUser = () => {
        setEditingUser(null);
        setEditUserData({ name: '', email: '', role: '' });
    };

    const saveUserChanges = async (userId) => {
        setUserProcessing(userId);
        try {
            await axios.put(`/api/users/${userId}`, editUserData);
            setNotification({ type: 'success', message: 'User updated successfully!' });
            fetchData();
        } catch (error) {
            // Demo mode
            setUsers(prev => prev.map(u => u._id === userId ? { ...u, ...editUserData } : u));
            setNotification({ type: 'success', message: 'User updated! (Demo mode)' });
        }
        setEditingUser(null);
        setEditUserData({ name: '', email: '', role: '' });
        setUserProcessing(null);
        setTimeout(() => setNotification(null), 3000);
    };

    const deleteUser = async (userId) => {
        setUserProcessing(userId);
        try {
            await axios.delete(`/api/users/${userId}`);
            setNotification({ type: 'success', message: 'User deleted successfully!' });
            fetchData();
        } catch (error) {
            // Demo mode
            setUsers(prev => prev.filter(u => u._id !== userId));
            setNotification({ type: 'success', message: 'User deleted! (Demo mode)' });
        }
        setShowDeleteConfirm(null);
        setUserProcessing(null);
        setTimeout(() => setNotification(null), 3000);
    };

    // File Publish/Unpublish Functions
    const togglePublishStatus = async (fileId) => {
        setFileProcessing(fileId);
        try {
            const response = await axios.patch(`/api/files/${fileId}/publish`);
            setNotification({ type: 'success', message: response.data.message });
            fetchData();
        } catch (error) {
            // Demo mode
            setAllFiles(prev => prev.map(f => f._id === fileId ? { ...f, published: !f.published } : f));
            const file = allFiles.find(f => f._id === fileId);
            setNotification({ type: 'success', message: `File ${file?.published ? 'unpublished' : 'published'}! (Demo mode)` });
        }
        setFileProcessing(null);
        setTimeout(() => setNotification(null), 3000);
    };

    // Bulk publish/unpublish all files in current folder
    const bulkPublishFolder = async (published) => {
        setBulkPublishing(true);
        try {
            const response = await axios.post('/api/files/admin/bulk-publish', {
                folderId: currentAdminFolder,
                published
            });
            setNotification({ type: 'success', message: response.data.message });
            fetchData();
        } catch (error) {
            setNotification({ type: 'error', message: error?.response?.data?.message || 'Failed to bulk update' });
        }
        setBulkPublishing(false);
        setTimeout(() => setNotification(null), 3000);
    };

    // Delete file (admin)
    const deleteFile = async (fileId) => {
        setDeletingItem(fileId);
        try {
            await axios.delete(`/api/files/${fileId}`);

            // Immediately remove file from local state for instant UI update
            setFiles(prev => prev.filter(f => f._id !== fileId));
            setAllFiles(prev => prev.filter(f => f._id !== fileId));

            setNotification({ type: 'success', message: 'File deleted successfully!' });

            // Refresh data from server to ensure consistency
            fetchData();
        } catch (error) {
            setNotification({ type: 'error', message: error?.response?.data?.message || 'Failed to delete file' });
        }
        setShowDeleteFileModal(null);
        setDeletingItem(null);
        setTimeout(() => setNotification(null), 3000);
    };

    // Delete folder (admin)
    const deleteFolder = async (folderId) => {
        setDeletingItem(folderId);
        try {
            await axios.delete(`/api/folders/${folderId}`);
            setNotification({ type: 'success', message: 'Folder and contents deleted successfully!' });
            fetchData();
        } catch (error) {
            setNotification({ type: 'error', message: error?.response?.data?.message || 'Failed to delete folder' });
        }
        setShowDeleteFolderModal(null);
        setDeletingItem(null);
        setTimeout(() => setNotification(null), 3000);
    };

    // Sync file from GitHub
    const handleSyncFromGithub = async (fileId) => {
        setSyncingFile(fileId);
        try {
            const response = await axios.post(`/api/github/sync/${fileId}`);
            if (response.data.synced) {
                setNotification({ type: 'success', message: 'File synced successfully from GitHub!' });
                // Update the file in state
                const updatedFile = response.data.file;
                setAllFiles(prev => prev.map(f => f._id === fileId ? updatedFile : f));
            } else {
                setNotification({ type: 'success', message: 'File is already up to date with GitHub.' });
            }
        } catch (error) {
            setNotification({ type: 'error', message: error?.response?.data?.message || 'Failed to sync from GitHub' });
        }
        setSyncingFile(null);
        setTimeout(() => setNotification(null), 3000);
    };

    // Sync files from database (refresh/reload files)
    const handleSyncFiles = async () => {
        setLoading(true);
        try {
            await fetchData();
            setNotification({ type: 'success', message: 'Files refreshed from database successfully!' });
        } catch (error) {
            setNotification({ type: 'error', message: 'Failed to refresh files from database' });
        } finally {
            setLoading(false);
            setTimeout(() => setNotification(null), 5000);
        }
    };

    // Sync folder from GitHub
    const handleSyncFolderFromGithub = async (folderId) => {
        setSyncingFolder(folderId);
        try {
            const response = await axios.post(`/api/github/sync-folder/${folderId}`);
            setNotification({ type: 'success', message: response.data.message });
            fetchData();
        } catch (error) {
            setNotification({ type: 'error', message: error?.response?.data?.message || 'Failed to sync folder from GitHub' });
        }
        setSyncingFolder(null);
        setTimeout(() => setNotification(null), 5000);
    };

    // Filter files by current folder and published status
    const getPublishedFiles = () => sortFiles(allFiles.filter(f => {
        const folderId = f.folder?._id || f.folder || null;
        const inCurrentFolder = folderId === currentAdminFolder;
        return f.published === true && inCurrentFolder;
    }));

    const getUnpublishedFiles = () => sortFiles(allFiles.filter(f => {
        const folderId = f.folder?._id || f.folder || null;
        const inCurrentFolder = folderId === currentAdminFolder;
        return f.published === false && inCurrentFolder;
    }));

    // Get folders in current location filtered by file publish status
    const getPublishedFolders = () => {
        const folderIds = new Set();
        // Find folders that contain published files (at any depth)
        const findFoldersWithPublishedFiles = (folderId) => {
            const hasPublishedFiles = allFiles.some(f => {
                const fileFolderId = f.folder?._id || f.folder || null;
                return fileFolderId === folderId && f.published === true;
            });
            if (hasPublishedFiles) {
                folderIds.add(folderId);
            }
            // Check subfolders
            allFolders.filter(sub => {
                const parentId = sub.parent?._id || sub.parent || null;
                return parentId === folderId;
            }).forEach(sub => {
                if (findFoldersWithPublishedFiles(sub._id)) {
                    folderIds.add(folderId);
                }
            });
            return folderIds.has(folderId);
        };

        // Get folders at current level
        return allFolders.filter(folder => {
            const parentId = folder.parent?._id || folder.parent || null;
            if (parentId !== currentAdminFolder) return false;
            // Check if this folder or its subfolders have published files
            return findFoldersWithPublishedFiles(folder._id) || allFiles.some(f => {
                const fileFolderId = f.folder?._id || f.folder || null;
                return fileFolderId === folder._id && f.published === true;
            });
        });
    };

    const getUnpublishedFolders = () => {
        const folderIds = new Set();
        // Find folders that contain unpublished files (at any depth)
        const findFoldersWithUnpublishedFiles = (folderId) => {
            const hasUnpublishedFiles = allFiles.some(f => {
                const fileFolderId = f.folder?._id || f.folder || null;
                return fileFolderId === folderId && f.published === false;
            });
            if (hasUnpublishedFiles) {
                folderIds.add(folderId);
            }
            // Check subfolders
            allFolders.filter(sub => {
                const parentId = sub.parent?._id || sub.parent || null;
                return parentId === folderId;
            }).forEach(sub => {
                if (findFoldersWithUnpublishedFiles(sub._id)) {
                    folderIds.add(folderId);
                }
            });
            return folderIds.has(folderId);
        };

        // Get folders at current level
        return allFolders.filter(folder => {
            const parentId = folder.parent?._id || folder.parent || null;
            if (parentId !== currentAdminFolder) return false;
            // Check if this folder or its subfolders have unpublished files
            return findFoldersWithUnpublishedFiles(folder._id) || allFiles.some(f => {
                const fileFolderId = f.folder?._id || f.folder || null;
                return fileFolderId === folder._id && f.published === false;
            });
        });
    };

    // Get all files in current folder (regardless of published status)
    const getAllFilesInFolder = () => sortFiles(allFiles.filter(f => {
        const folderId = f.folder?._id || f.folder || null;
        return folderId === currentAdminFolder;
    }));

    // Get all folders at current level (for showing all folders)
    const getCurrentFolders = () => {
        return allFolders.filter(folder => {
            const parentId = folder.parent?._id || folder.parent || null;
            return parentId === currentAdminFolder;
        });
    };

    // Navigate into a folder
    const navigateToFolder = (folder) => {
        setAdminFolderPath(prev => [...prev, folder]);
        setCurrentAdminFolder(folder._id);
    };

    // Navigate to a specific path index
    const navigateToPathIndex = (index) => {
        if (index < 0) {
            // Go to root
            setCurrentAdminFolder(null);
            setAdminFolderPath([]);
        } else {
            const newPath = adminFolderPath.slice(0, index + 1);
            setAdminFolderPath(newPath);
            setCurrentAdminFolder(newPath[index]._id);
        }
    };

    // Go back one level
    const goBack = () => {
        if (adminFolderPath.length === 0) return;
        const newPath = adminFolderPath.slice(0, -1);
        setAdminFolderPath(newPath);
        setCurrentAdminFolder(newPath.length > 0 ? newPath[newPath.length - 1]._id : null);
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-700',
            approved: 'bg-green-100 text-green-700',
            rejected: 'bg-red-100 text-red-700'
        };
        const icons = {
            pending: <Clock className="w-3 h-3" />,
            approved: <CheckCircle className="w-3 h-3" />,
            rejected: <XCircle className="w-3 h-3" />
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${styles[status]}`}>
                {icons[status]}
                {status}
            </span>
        );
    };

    const stats = [
        {
            label: 'Pending Reviews',
            value: pendingEdits.length,
            icon: Clock,
            color: 'text-yellow-600',
            bg: 'bg-yellow-100'
        },
        {
            label: 'Total Users',
            value: users.length,
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-100'
        },
        {
            label: 'Total Files',
            value: files.length,
            icon: FileText,
            color: 'text-purple-600',
            bg: 'bg-purple-100'
        },
        {
            label: 'Approved Edits',
            value: allEdits.filter(e => e.status === 'approved').length,
            icon: TrendingUp,
            color: 'text-green-600',
            bg: 'bg-green-100'
        }
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Backend Not Connected Banner */}
            {!backendConnected && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="p-2 bg-red-100 rounded-full">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="flex-1">
                        <h4 className="font-semibold text-red-800">Backend Not Connected</h4>
                        <p className="text-sm text-red-600">Unable to connect to the server. Showing demo data. Please ensure the backend server is running on port 5000.</p>
                    </div>
                    <button
                        onClick={fetchData}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm font-medium"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Notification Banner */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-pulse ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
                    }`}>
                    {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {notification.message}
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Edit</h3>
                        <p className="text-sm text-gray-600 mb-4">Provide feedback to the editor (optional):</p>
                        <textarea
                            value={rejectNotes}
                            onChange={(e) => setRejectNotes(e.target.value)}
                            placeholder="Reason for rejection..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                            rows={3}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => { setShowRejectModal(null); setRejectNotes(''); }}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleReject(showRejectModal, rejectNotes)}
                                disabled={processing === showRejectModal}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {processing === showRejectModal ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <X className="w-4 h-4" />
                                )}
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                    <p className="text-gray-500 mt-1">Review and approve edit requests</p>
                </div>
                <button
                    onClick={handleSyncFiles}
                    disabled={loading}
                    className="inline-flex items-center px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-sm disabled:opacity-50"
                    title="Refresh files from database"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            Syncing...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="w-4 h-4 mr-1.5" />
                            Sync Files
                        </>
                    )}
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}>
                                    <Icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                                    <p className="text-xs text-gray-500">{stat.label}</p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'pending'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Pending Reviews ({pendingEdits.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'history'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        All Edits ({allEdits.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'users'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Users ({users.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'files'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        Files ({allFiles.length})
                    </button>
                </nav>
            </div>

            {/* Content */}
            {activeTab === 'pending' && (
                <div className="space-y-4">
                    {pendingEdits.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                            <h3 className="text-lg font-semibold text-gray-900">All caught up!</h3>
                            <p className="text-gray-500 mt-1">No pending edit requests to review.</p>
                        </div>
                    ) : (
                        pendingEdits.map((edit) => (
                            <div key={edit._id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                {/* Edit Header */}
                                <div
                                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition"
                                    onClick={() => setExpandedEdit(expandedEdit === edit._id ? null : edit._id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                            <FileText className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{edit.file.name}</h3>
                                            <p className="text-sm text-gray-500">
                                                by {edit.editor.name} • {new Date(edit.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Quick Action Buttons in Header */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openRejectModal(edit._id); }}
                                            disabled={processing === edit._id}
                                            className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
                                        >
                                            <X className="w-4 h-4" />
                                            Reject
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleApprove(edit._id); }}
                                            disabled={processing === edit._id}
                                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-1.5 text-sm font-medium disabled:opacity-50"
                                        >
                                            {processing === edit._id ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                            Approve
                                        </button>
                                        {getStatusBadge(edit.status)}
                                        {expandedEdit === edit._id ? (
                                            <ChevronUp className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Content */}
                                {expandedEdit === edit._id && (
                                    <div className="border-t border-gray-200">
                                        {/* Sticky Action Bar with View Mode Toggle */}
                                        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-purple-50 flex items-center justify-between sticky top-0 z-10">
                                            <div className="flex items-center gap-4">
                                                <h3 className="font-medium text-gray-700">Review Changes</h3>
                                                <div className="flex items-center bg-gray-200 rounded-lg p-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleViewMode(edit._id); }}
                                                        className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${getViewMode(edit._id) === 'diff'
                                                            ? 'bg-white text-purple-700 shadow-sm'
                                                            : 'text-gray-600 hover:text-gray-800'
                                                            }`}
                                                    >
                                                        <GitCompare className="w-4 h-4" />
                                                        Diff View
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleViewMode(edit._id); }}
                                                        className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${getViewMode(edit._id) === 'editor'
                                                            ? 'bg-white text-purple-700 shadow-sm'
                                                            : 'text-gray-600 hover:text-gray-800'
                                                            }`}
                                                    >
                                                        <Columns className="w-4 h-4" />
                                                        Editor & Preview
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Prominent Action Buttons */}
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openRejectModal(edit._id); }}
                                                    disabled={processing === edit._id}
                                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 font-medium shadow-sm disabled:opacity-50"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Reject
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleApprove(edit._id); }}
                                                    disabled={processing === edit._id}
                                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-medium shadow-sm disabled:opacity-50"
                                                >
                                                    {processing === edit._id ? (
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <Check className="w-4 h-4" />
                                                    )}
                                                    Approve & Apply
                                                </button>
                                            </div>
                                        </div>

                                        {/* Diff View */}
                                        {getViewMode(edit._id) === 'diff' && (
                                            <div className="p-4">
                                                <DiffViewer
                                                    oldContent={edit.originalContent}
                                                    newContent={edit.newContent}
                                                    oldTitle="Original Version"
                                                    newTitle="Proposed Changes"
                                                />
                                            </div>
                                        )}

                                        {/* Editor & Preview View */}
                                        {getViewMode(edit._id) === 'editor' && (
                                            <div className="p-4">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                    {/* Editor (Read-only) */}
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                                                            <Edit className="w-4 h-4 text-purple-600" />
                                                            <span className="font-medium text-gray-700 text-sm">Proposed Content</span>
                                                            <span className="ml-auto text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Read-only</span>
                                                        </div>
                                                        <textarea
                                                            readOnly
                                                            value={edit.newContent}
                                                            className="w-full h-96 p-4 font-mono text-sm resize-none focus:outline-none bg-gray-50"
                                                        />
                                                    </div>
                                                    {/* Preview */}
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                                                            <Eye className="w-4 h-4 text-green-600" />
                                                            <span className="font-medium text-gray-700 text-sm">Rendered Preview</span>
                                                            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                                Live
                                                            </span>
                                                        </div>
                                                        <div className="h-96 overflow-y-auto p-4">
                                                            <MarkdownRenderer content={edit.newContent} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
                                            <button
                                                onClick={() => openRejectModal(edit._id)}
                                                disabled={processing === edit._id}
                                                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <X className="w-4 h-4" />
                                                Reject
                                            </button>
                                            <button
                                                onClick={() => handleApprove(edit._id)}
                                                disabled={processing === edit._id}
                                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                                            >
                                                {processing === edit._id ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Check className="w-4 h-4" />
                                                )}
                                                Approve & Apply
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Editor</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {allEdits.map((edit) => (
                                <tr key={edit._id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            <span className="font-medium text-gray-900">{edit.file.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-600">{edit.editor.name}</td>
                                    <td className="px-4 py-3 text-gray-500 text-sm">
                                        {new Date(edit.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3">{getStatusBadge(edit.status)}</td>
                                    <td className="px-4 py-3">
                                        <button
                                            onClick={() => setSelectedEdit(edit)}
                                            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-4">
                    {/* User Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{users?.length || 0}</p>
                                    <p className="text-sm text-gray-500">Total Users</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <UserCog className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{users?.filter(u => u?.role === 'admin').length || 0}</p>
                                    <p className="text-sm text-gray-500">Admins</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Edit className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{users?.filter(u => u?.role === 'editor').length || 0}</p>
                                    <p className="text-sm text-gray-500">Editors</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Eye className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{users?.filter(u => u?.role === 'viewer').length || 0}</p>
                                    <p className="text-sm text-gray-500">Viewers</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-600" />
                                User Management
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">Manage user roles and permissions</p>
                        </div>
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {!users || users.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-12 text-center">
                                            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                            <p className="text-gray-500 font-medium">No users found</p>
                                            <p className="text-sm text-gray-400">Users will appear here once registered</p>
                                        </td>
                                    </tr>
                                ) : users.map((user) => user && (
                                    <tr key={user._id || Math.random()} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            {editingUser === user._id ? (
                                                <input
                                                    type="text"
                                                    value={editUserData.name}
                                                    onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                                                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full max-w-xs"
                                                />
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold text-sm ${user.role === 'admin' ? 'bg-red-500' :
                                                        user.role === 'editor' ? 'bg-blue-500' : 'bg-green-500'
                                                        }`}>
                                                        {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                                                    </div>
                                                    <span className="font-medium text-gray-900">{user.name || 'Unknown'}</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingUser === user._id ? (
                                                <input
                                                    type="email"
                                                    value={editUserData.email}
                                                    onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                                                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 w-full max-w-xs"
                                                />
                                            ) : (
                                                <span className="text-gray-600">{user.email || 'No email'}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            {editingUser === user._id ? (
                                                <select
                                                    value={editUserData.role}
                                                    onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                                                    className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                >
                                                    <option value="viewer">Viewer</option>
                                                    <option value="editor">Editor</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            ) : (
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${user?.role === 'admin' ? 'bg-red-100 text-red-700' :
                                                    user?.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                                                    }`}>
                                                    {user?.role || 'viewer'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-2">
                                                {editingUser === user._id ? (
                                                    <>
                                                        <button
                                                            onClick={() => saveUserChanges(user._id)}
                                                            disabled={userProcessing === user._id}
                                                            className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition disabled:opacity-50"
                                                            title="Save changes"
                                                        >
                                                            {userProcessing === user._id ? (
                                                                <div className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <Save className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={cancelEditUser}
                                                            className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                                                            title="Cancel"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => startEditUser(user)}
                                                            className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                                                            title="Edit user"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => setShowDeleteConfirm(user._id)}
                                                            className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                                                            title="Delete user"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Files Tab Content */}
            {activeTab === 'files' && (
                <div className="space-y-4">
                    {/* Sub-tabs for All/Published/Unpublished */}
                    <div className="flex items-center gap-4 bg-white rounded-xl shadow-sm border border-gray-200 p-2">
                        <button
                            onClick={() => {
                                setFilesTab('all');
                                setCurrentAdminFolder(null);
                                setAdminFolderPath([]);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${filesTab === 'all'
                                ? 'bg-purple-100 text-purple-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <FileText className="w-4 h-4" />
                            All Files ({allFiles.length})
                        </button>
                        <button
                            onClick={() => {
                                setFilesTab('published');
                                setCurrentAdminFolder(null);
                                setAdminFolderPath([]);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${filesTab === 'published'
                                ? 'bg-green-100 text-green-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <Globe className="w-4 h-4" />
                            Published ({allFiles.filter(f => f.published === true).length})
                        </button>
                        <button
                            onClick={() => {
                                setFilesTab('unpublished');
                                setCurrentAdminFolder(null);
                                setAdminFolderPath([]);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition ${filesTab === 'unpublished'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <EyeOff className="w-4 h-4" />
                            Unpublished ({allFiles.filter(f => f.published === false).length})
                        </button>
                    </div>

                    {/* Breadcrumb Navigation */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                        <div className="flex items-center gap-2 text-sm">
                            <button
                                onClick={() => navigateToPathIndex(-1)}
                                className="flex items-center gap-1 text-gray-600 hover:text-blue-600 transition"
                            >
                                <Home className="w-4 h-4" />
                                <span>Root</span>
                            </button>
                            {adminFolderPath.map((folder, index) => (
                                <div key={folder._id} className="flex items-center gap-2">
                                    <ChevronRight className="w-4 h-4 text-gray-400" />
                                    <button
                                        onClick={() => navigateToPathIndex(index)}
                                        className={`hover:text-blue-600 transition ${index === adminFolderPath.length - 1 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                                    >
                                        {folder.name}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Back button if in a folder */}
                    {currentAdminFolder && (
                        <button
                            onClick={goBack}
                            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back</span>
                        </button>
                    )}

                    {/* Bulk Actions */}
                    <div className="flex items-center gap-3 bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                        <span className="text-sm font-medium text-gray-700">Bulk Actions:</span>
                        <button
                            onClick={() => bulkPublishFolder(true)}
                            disabled={bulkPublishing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition disabled:opacity-50 text-sm font-medium"
                        >
                            {bulkPublishing ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Globe className="w-4 h-4" />
                            )}
                            Publish All in Folder
                        </button>
                        <button
                            onClick={() => bulkPublishFolder(false)}
                            disabled={bulkPublishing}
                            className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition disabled:opacity-50 text-sm font-medium"
                        >
                            {bulkPublishing ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <EyeOff className="w-4 h-4" />
                            )}
                            Unpublish All in Folder
                        </button>
                    </div>

                    {/* Folders Grid */}
                    {(filesTab === 'all' ? getCurrentFolders() : filesTab === 'published' ? getPublishedFolders() : getUnpublishedFolders()).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                            {(filesTab === 'all' ? getCurrentFolders() : filesTab === 'published' ? getPublishedFolders() : getUnpublishedFolders()).map((folder) => (
                                <div
                                    key={folder._id}
                                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition group relative"
                                >
                                    {/* GitHub indicator */}
                                    {folder.githubSource?.repo && (
                                        <div className="absolute top-2 left-2 p-1 bg-gray-100 rounded-md" title={`From GitHub: ${folder.githubSource.owner}/${folder.githubSource.repo}`}>
                                            <Github className="w-3 h-3 text-gray-600" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => navigateToFolder(folder)}
                                        className="w-full flex flex-col items-center gap-2"
                                    >
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${filesTab === 'all' ? 'bg-purple-100 group-hover:bg-purple-200' : filesTab === 'published' ? 'bg-green-100 group-hover:bg-green-200' : 'bg-yellow-100 group-hover:bg-yellow-200'} transition`}>
                                            <Folder className={`w-6 h-6 ${filesTab === 'all' ? 'text-purple-600' : filesTab === 'published' ? 'text-green-600' : 'text-yellow-600'}`} />
                                        </div>
                                        <span className="text-sm font-medium text-gray-700 text-center truncate w-full">{folder.name}</span>
                                        <span className="text-xs text-gray-400">{folder.author?.name || 'Unknown'}</span>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowDeleteFolderModal(folder);
                                        }}
                                        className="absolute top-2 right-2 p-1.5 bg-red-100 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-200 transition"
                                        title="Delete folder"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    {/* Only show sync button on root repo folder (no parent, empty path) */}
                                    {folder.githubSource?.repo &&
                                        (!folder.githubSource.path || folder.githubSource.path === '') &&
                                        !folder.parent && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSyncFolderFromGithub(folder._id);
                                                }}
                                                disabled={syncingFolder === folder._id}
                                                className="absolute bottom-2 left-2 right-2 flex items-center justify-center gap-1 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg hover:bg-gray-900 transition disabled:opacity-50"
                                                title="Sync repository from GitHub"
                                            >
                                                {syncingFolder === folder._id ? (
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-3 h-3" />
                                                )}
                                                Sync
                                            </button>
                                        )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Sort Controls */}
                    <div className="flex items-center gap-2 bg-white rounded-lg shadow-sm border border-gray-200 p-2">
                        <span className="text-sm text-gray-500 font-medium px-2">Sort by:</span>
                        <button
                            onClick={() => handleSort('name')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${sortBy === 'name'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Name
                            {sortBy === 'name' && (
                                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                        </button>
                        <button
                            onClick={() => handleSort('date')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${sortBy === 'date'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Date
                            {sortBy === 'date' && (
                                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                        </button>
                        <button
                            onClick={() => handleSort('author')}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition ${sortBy === 'author'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            Author
                            {sortBy === 'author' && (
                                sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                        </button>
                    </div>

                    {/* Files List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">File</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Author</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Updated</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(filesTab === 'all' ? getAllFilesInFolder() : filesTab === 'published' ? getPublishedFiles() : getUnpublishedFiles()).length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-4 py-12 text-center">
                                                <div className="flex flex-col items-center">
                                                    {filesTab === 'all' ? (
                                                        <>
                                                            <FileText className="w-12 h-12 text-gray-300 mb-3" />
                                                            <p className="text-gray-500">No files in this folder</p>
                                                        </>
                                                    ) : filesTab === 'published' ? (
                                                        <>
                                                            <Globe className="w-12 h-12 text-gray-300 mb-3" />
                                                            <p className="text-gray-500">No published files in this folder</p>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <EyeOff className="w-12 h-12 text-gray-300 mb-3" />
                                                            <p className="text-gray-500">No unpublished files in this folder</p>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        (filesTab === 'all' ? getAllFilesInFolder() : filesTab === 'published' ? getPublishedFiles() : getUnpublishedFiles()).map((file) => (
                                            <tr key={file._id} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${file.published ? 'bg-green-100' : 'bg-yellow-100'
                                                            }`}>
                                                            <FileText className={`w-4 h-4 ${file.published ? 'text-green-600' : 'text-yellow-600'
                                                                }`} />
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium text-gray-900">{file.name}</span>
                                                            {file.githubSource?.downloadUrl && (
                                                                <Github className="w-3.5 h-3.5 text-gray-400" title="Imported from GitHub" />
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {file.author?.name || 'Unknown'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${file.published
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {file.published ? (
                                                            <>
                                                                <Globe className="w-3 h-3" />
                                                                Published
                                                            </>
                                                        ) : (
                                                            <>
                                                                <EyeOff className="w-3 h-3" />
                                                                Unpublished
                                                            </>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {new Date(file.updatedAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => togglePublishStatus(file._id)}
                                                            disabled={fileProcessing === file._id}
                                                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${file.published
                                                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                                }`}
                                                            title={file.published ? 'Unpublish' : 'Publish'}
                                                        >
                                                            {fileProcessing === file._id ? (
                                                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                            ) : file.published ? (
                                                                <>
                                                                    <ToggleRight className="w-4 h-4" />
                                                                    Unpublish
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <ToggleLeft className="w-4 h-4" />
                                                                    Publish
                                                                </>
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => setShowDeleteFileModal(file)}
                                                            className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                                                            title="Delete file"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                                <h4 className="font-medium text-blue-800">About Publishing</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                    <strong>Published</strong> files are visible to all users (viewers, editors).
                                    <br />
                                    <strong>Unpublished</strong> files are hidden from users but can still be edited by their authors.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete User Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete User</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete <span className="font-semibold">{users.find(u => u._id === showDeleteConfirm)?.name}</span>?
                            All their data will be permanently removed.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteUser(showDeleteConfirm)}
                                disabled={userProcessing === showDeleteConfirm}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {userProcessing === showDeleteConfirm ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Delete User
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete File Confirmation Modal */}
            {showDeleteFileModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <Trash2 className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete File</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete <span className="font-semibold">{showDeleteFileModal.name}</span>?
                            This file will be permanently removed.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteFileModal(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteFile(showDeleteFileModal._id)}
                                disabled={deletingItem === showDeleteFileModal._id}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {deletingItem === showDeleteFileModal._id ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Delete File
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Folder Confirmation Modal */}
            {showDeleteFolderModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 rounded-full">
                                <Folder className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Folder</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-2">
                            Are you sure you want to delete <span className="font-semibold">{showDeleteFolderModal.name}</span>?
                        </p>
                        <p className="text-red-600 text-sm mb-6 bg-red-50 p-3 rounded-lg">
                            ⚠️ This will permanently delete the folder and ALL files and subfolders inside it.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteFolderModal(null)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteFolder(showDeleteFolderModal._id)}
                                disabled={deletingItem === showDeleteFolderModal._id}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {deletingItem === showDeleteFolderModal._id ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                Delete Folder
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Detail Modal */}
            {selectedEdit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-white to-purple-50">
                            <div>
                                <h2 className="font-semibold text-gray-900">{selectedEdit.file.name}</h2>
                                <p className="text-sm text-gray-500">Edit by {selectedEdit.editor.name}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Prominent Action Buttons in Modal Header for Pending Edits */}
                                {selectedEdit.status === 'pending' && (
                                    <>
                                        <button
                                            onClick={() => openRejectModal(selectedEdit._id)}
                                            disabled={processing === selectedEdit._id}
                                            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition flex items-center gap-2 font-medium shadow-sm disabled:opacity-50"
                                        >
                                            <X className="w-4 h-4" />
                                            Reject
                                        </button>
                                        <button
                                            onClick={() => handleApprove(selectedEdit._id)}
                                            disabled={processing === selectedEdit._id}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-medium shadow-sm disabled:opacity-50"
                                        >
                                            {processing === selectedEdit._id ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Check className="w-4 h-4" />
                                            )}
                                            Approve
                                        </button>
                                    </>
                                )}
                                {getStatusBadge(selectedEdit.status)}
                                <button
                                    onClick={() => setSelectedEdit(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                                >
                                    <X className="w-5 h-5 text-gray-500" />
                                </button>
                            </div>
                        </div>

                        {/* View Mode Toggle for Modal */}
                        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-center">
                            <div className="flex items-center bg-gray-200 rounded-lg p-1">
                                <button
                                    onClick={() => toggleViewMode(selectedEdit._id)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${getViewMode(selectedEdit._id) === 'diff'
                                        ? 'bg-white text-purple-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <GitCompare className="w-4 h-4" />
                                    Diff View
                                </button>
                                <button
                                    onClick={() => toggleViewMode(selectedEdit._id)}
                                    className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-2 transition ${getViewMode(selectedEdit._id) === 'editor'
                                        ? 'bg-white text-purple-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    <Columns className="w-4 h-4" />
                                    Editor & Preview
                                </button>
                            </div>
                        </div>

                        <div className="p-4 overflow-y-auto max-h-[60vh]">
                            {/* Diff View in Modal */}
                            {getViewMode(selectedEdit._id) === 'diff' && (
                                <DiffViewer
                                    oldContent={selectedEdit.originalContent}
                                    newContent={selectedEdit.newContent}
                                />
                            )}

                            {/* Editor & Preview View in Modal */}
                            {getViewMode(selectedEdit._id) === 'editor' && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Editor (Read-only) */}
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                                            <Edit className="w-4 h-4 text-purple-600" />
                                            <span className="font-medium text-gray-700 text-sm">Proposed Content</span>
                                            <span className="ml-auto text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">Read-only</span>
                                        </div>
                                        <textarea
                                            readOnly
                                            value={selectedEdit.newContent}
                                            className="w-full h-80 p-4 font-mono text-sm resize-none focus:outline-none bg-gray-50"
                                        />
                                    </div>
                                    {/* Preview */}
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-green-600" />
                                            <span className="font-medium text-gray-700 text-sm">Rendered Preview</span>
                                            <span className="ml-auto flex items-center gap-1 text-xs text-green-600">
                                                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                                Live
                                            </span>
                                        </div>
                                        <div className="h-80 overflow-y-auto p-4">
                                            <MarkdownRenderer content={selectedEdit.newContent} />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {selectedEdit.status === 'pending' && (
                            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                                <button
                                    onClick={() => openRejectModal(selectedEdit._id)}
                                    disabled={processing === selectedEdit._id}
                                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    <X className="w-4 h-4" />
                                    Reject
                                </button>
                                <button
                                    onClick={() => handleApprove(selectedEdit._id)}
                                    disabled={processing === selectedEdit._id}
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {processing === selectedEdit._id ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    Approve & Apply
                                </button>
                            </div>
                        )}
                        {selectedEdit.status !== 'pending' && selectedEdit.reviewNotes && (
                            <div className="p-4 border-t border-gray-200 bg-gray-50">
                                <p className="text-sm text-gray-600">
                                    <span className="font-medium">Review Notes:</span> {selectedEdit.reviewNotes}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
