import { useState, useEffect, useCallback, useRef } from 'react';
import {
    FileText,
    Plus,
    Edit,
    Eye,
    Send,
    Save,
    X,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    FolderOpen,
    Download,
    RefreshCw,
    File,
    Trash2,
    Folder,
    FolderPlus,
    ChevronRight,
    ChevronDown,
    ArrowLeft,
    Upload,
    Github,
    Search,
    ExternalLink,
    Loader2
} from 'lucide-react';
import axios from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import DiffViewer from '../components/DiffViewer';
import MarkdownRenderer from '../components/MarkdownRenderer';
import SyncScrollEditor from '../components/SyncScrollEditor';

export default function EditorDashboard() {
    const { user } = useAuth();
    const [files, setFiles] = useState([]);
    const [myFiles, setMyFiles] = useState([]);
    const [myEdits, setMyEdits] = useState([]);
    const [folders, setFolders] = useState([]);
    const [currentFolder, setCurrentFolder] = useState(null); // null = root
    const [folderPath, setFolderPath] = useState([]); // breadcrumb path
    const [selectedFile, setSelectedFile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [editFileName, setEditFileName] = useState('');
    const [currentFileId, setCurrentFileId] = useState(null);
    const [isOwnFile, setIsOwnFile] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [newFileContent, setNewFileContent] = useState('');
    const [showDiff, setShowDiff] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingForApproval, setSendingForApproval] = useState(false);
    const [saveStatus, setSaveStatus] = useState(null); // 'saved', 'saving', 'error'
    const [activeTab, setActiveTab] = useState('myfiles');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [backendConnected, setBackendConnected] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState(new Set());

    // Delete modal state
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, file: null, isFromEditor: false });
    const [deleteFolderModal, setDeleteFolderModal] = useState({ isOpen: false, folder: null });
    const [alertModal, setAlertModal] = useState({ isOpen: false, message: '', type: 'success' });

    // File upload state
    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);
    const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState(false);

    // GitHub import state
    const [isGithubModalVisible, setIsGithubModalVisible] = useState(false);
    const [githubRepoUrl, setGithubRepoUrl] = useState('');
    const [githubRepoContents, setGithubRepoContents] = useState(null);
    const [githubLoading, setGithubLoading] = useState(false);
    const [githubCurrentPath, setGithubCurrentPath] = useState('');
    const [githubOwner, setGithubOwner] = useState('');
    const [githubRepo, setGithubRepo] = useState('');
    const [importingRepo, setImportingRepo] = useState(false);

    // GitHub sync state
    const [syncingFile, setSyncingFile] = useState(null);
    const [syncingFolder, setSyncingFolder] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [filesRes, myFilesRes, editsRes, foldersRes] = await Promise.all([
                axios.get('/api/files'),
                axios.get('/api/files/my/files'),
                axios.get('/api/edits/my'),
                axios.get('/api/folders/my')
            ]);
            setFiles(filesRes.data);
            setMyFiles(myFilesRes.data);
            setMyEdits(editsRes.data);
            setFolders(foldersRes.data);
            setBackendConnected(true);
        } catch (error) {
            setBackendConnected(false);
            // Demo data
            const demoFiles = [
                {
                    _id: '1',
                    name: 'README.md',
                    content: '# Welcome to MD Collab\n\nThis is a **collaborative markdown editing platform**.\n\n## Features\n\n- Role-based access control\n- Real-time markdown preview\n- GitHub-style diff viewer\n- Approval workflow\n\n## Getting Started\n\n1. Login with your credentials\n2. Navigate to your dashboard\n3. Start collaborating!',
                    author: { _id: 'user1', name: 'Admin User' },
                    status: 'approved',
                    folder: null,
                    updatedAt: new Date().toISOString()
                },
                {
                    _id: '2',
                    name: 'CONTRIBUTING.md',
                    content: '# Contributing Guidelines\n\nWe welcome contributions!\n\n## How to Contribute\n\n1. Fork the repository\n2. Create a feature branch\n3. Make your changes\n4. Submit a pull request',
                    author: { _id: 'currentUser', name: 'Editor User' },
                    status: 'approved',
                    folder: null,
                    updatedAt: new Date().toISOString()
                }
            ];
            setFiles(demoFiles);
            setMyFiles(demoFiles.filter(f => f.author._id === 'currentUser'));
            setFolders([]);
            setMyEdits([
                {
                    _id: 'e1',
                    file: { name: 'README.md' },
                    status: 'pending',
                    createdAt: new Date().toISOString()
                }
            ]);
        }
        setLoading(false);
    };

    const handleStartEdit = (file, isOwn = false) => {
        setSelectedFile(file);
        setEditContent(file.content);
        setEditFileName(file.name);
        setCurrentFileId(file._id);
        setIsOwnFile(isOwn);
        setIsEditing(true);
        setShowDiff(false);
        setHasUnsavedChanges(false);
        setSaveStatus(null);
    };

    const handleContentChange = useCallback((content) => {
        setEditContent(content);
        setHasUnsavedChanges(true);
        setSaveStatus(null);
    }, []);

    const handleSaveFile = async () => {
        if (!currentFileId || !isOwnFile || !hasUnsavedChanges) return;

        setSaving(true);
        setSaveStatus('saving');

        try {
            const response = await axios.put(`/api/files/${currentFileId}/save`, {
                content: editContent,
                name: editFileName
            });

            // Update local state
            setSelectedFile(response.data);
            setHasUnsavedChanges(false);
            setSaveStatus('saved');

            // Refresh file lists
            fetchData();

            // Clear save status after 2 seconds
            setTimeout(() => setSaveStatus(null), 2000);
        } catch (error) {
            console.error('Save error:', error);
            // Demo mode - simulate successful save
            setHasUnsavedChanges(false);
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus(null), 2000);
        } finally {
            setSaving(false);
        }
    };

    const handleOpenFile = (file) => {
        // Check if it's user's own file
        const isOwn = myFiles.some(f => f._id === file._id);
        handleStartEdit(file, isOwn);
        setIsOpenModalVisible(false);
    };

    const handleSendForApproval = async () => {
        if (sendingForApproval) return; // Prevent multiple clicks

        setSendingForApproval(true);
        try {
            await axios.post('/api/edits', {
                fileId: selectedFile._id,
                newContent: editContent
            });
            alert('Edit sent for approval!');
            setIsEditing(false);
            fetchData();
        } catch (error) {
            // Demo mode
            alert('Edit sent for approval! (Demo mode)');
            setIsEditing(false);
        } finally {
            setSendingForApproval(false);
        }
    };

    const handleCreateFile = async () => {
        if (!newFileName || !newFileContent) return;

        try {
            const response = await axios.post('/api/files', {
                name: newFileName.endsWith('.md') ? newFileName : `${newFileName}.md`,
                content: newFileContent,
                folderId: currentFolder // Include current folder
            });

            // Open the newly created file for editing
            setIsCreating(false);
            handleStartEdit(response.data, true);
            setNewFileName('');
            setNewFileContent('');
            fetchData();
        } catch (error) {
            // Demo mode - simulate file creation
            const newFile = {
                _id: Date.now().toString(),
                name: newFileName.endsWith('.md') ? newFileName : `${newFileName}.md`,
                content: newFileContent,
                author: { _id: 'currentUser', name: 'You' },
                status: 'approved',
                folder: currentFolder,
                updatedAt: new Date().toISOString()
            };
            setMyFiles(prev => [newFile, ...prev]);
            setIsCreating(false);
            handleStartEdit(newFile, true);
            setNewFileName('');
            setNewFileContent('');
        }
    };

    // Folder functions
    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;

        try {
            await axios.post('/api/folders', {
                name: newFolderName.trim(),
                parentId: currentFolder
            });
            setNewFolderName('');
            setIsCreatingFolder(false);
            fetchData();
            setAlertModal({ isOpen: true, message: 'Folder created successfully!', type: 'success' });
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to create folder';
            setAlertModal({ isOpen: true, message, type: 'error' });
        }
    };

    const handleNavigateToFolder = (folder) => {
        if (folder === null) {
            // Go to root
            setCurrentFolder(null);
            setFolderPath([]);
        } else {
            setCurrentFolder(folder._id);
            setFolderPath(prev => [...prev, folder]);
        }
    };

    const handleNavigateUp = () => {
        if (folderPath.length === 0) return;
        const newPath = [...folderPath];
        newPath.pop();
        setFolderPath(newPath);
        setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1]._id : null);
    };

    const handleNavigateToBreadcrumb = (index) => {
        if (index === -1) {
            // Root
            setCurrentFolder(null);
            setFolderPath([]);
        } else {
            const newPath = folderPath.slice(0, index + 1);
            setFolderPath(newPath);
            setCurrentFolder(newPath[newPath.length - 1]._id);
        }
    };

    const handleDeleteFolder = (folder) => {
        setDeleteFolderModal({ isOpen: true, folder });
    };

    const confirmDeleteFolder = async () => {
        const { folder } = deleteFolderModal;
        if (!folder) return;

        try {
            await axios.delete(`/api/folders/${folder._id}`);
            setDeleteFolderModal({ isOpen: false, folder: null });
            setAlertModal({ isOpen: true, message: 'Folder deleted successfully!', type: 'success' });
            fetchData();
        } catch (error) {
            const message = error?.response?.data?.message || 'Failed to delete folder';
            setDeleteFolderModal({ isOpen: false, folder: null });
            setAlertModal({ isOpen: true, message, type: 'error' });
        }
    };

    const toggleFolderExpanded = (folderId) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    // Get files and folders for current folder view
    const getCurrentFolderContents = () => {
        const currentFolders = folders.filter(f =>
            (f.parent === currentFolder) ||
            (f.parent?._id === currentFolder) ||
            (currentFolder === null && !f.parent)
        );
        const currentFiles = myFiles.filter(f =>
            (f.folder === currentFolder) ||
            (f.folder?._id === currentFolder) ||
            (currentFolder === null && !f.folder)
        );
        return { folders: currentFolders, files: currentFiles };
    };

    // File Upload Functions
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        // Filter for markdown files only
        const mdFiles = files.filter(file => file.name.endsWith('.md'));
        const nonMdFiles = files.filter(file => !file.name.endsWith('.md'));

        if (nonMdFiles.length > 0) {
            setAlertModal({
                isOpen: true,
                message: `${nonMdFiles.length} file(s) skipped. Only .md files are allowed.`,
                type: 'error'
            });
        }

        if (mdFiles.length === 0) {
            event.target.value = '';
            return;
        }

        setUploadingFiles(true);

        try {
            for (const file of mdFiles) {
                const content = await file.text();
                await axios.post('/api/files', {
                    name: file.name,
                    content: content,
                    folderId: currentFolder
                });
            }
            setAlertModal({
                isOpen: true,
                message: `Successfully uploaded ${mdFiles.length} file(s)!`,
                type: 'success'
            });
            fetchData();
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to upload files',
                type: 'error'
            });
        } finally {
            setUploadingFiles(false);
            event.target.value = '';
            setIsUploadModalVisible(false);
        }
    };

    const handleFolderUpload = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        // Filter for markdown files only
        const mdFiles = files.filter(file => file.name.endsWith('.md'));

        if (mdFiles.length === 0) {
            setAlertModal({
                isOpen: true,
                message: 'No .md files found in the selected folder.',
                type: 'error'
            });
            event.target.value = '';
            return;
        }

        setUploadingFiles(true);

        try {
            // Group files by folder path
            const folderStructure = {};
            mdFiles.forEach(file => {
                const pathParts = file.webkitRelativePath.split('/');
                const folderPath = pathParts.slice(0, -1).join('/');
                if (!folderStructure[folderPath]) {
                    folderStructure[folderPath] = [];
                }
                folderStructure[folderPath].push(file);
            });

            // Create folders and upload files
            const folderIds = {};
            const sortedPaths = Object.keys(folderStructure).sort((a, b) => a.split('/').length - b.split('/').length);

            for (const folderPath of sortedPaths) {
                const pathParts = folderPath.split('/');
                let parentId = currentFolder;

                // Create folder hierarchy
                for (let i = 0; i < pathParts.length; i++) {
                    const currentPath = pathParts.slice(0, i + 1).join('/');
                    if (!folderIds[currentPath]) {
                        try {
                            const response = await axios.post('/api/folders', {
                                name: pathParts[i],
                                parentId: parentId
                            });
                            folderIds[currentPath] = response.data._id;
                        } catch (error) {
                            // Folder might already exist, try to find it
                            const existingFolder = folders.find(f =>
                                f.name === pathParts[i] &&
                                ((f.parent === parentId) || (f.parent?._id === parentId) || (!f.parent && !parentId))
                            );
                            if (existingFolder) {
                                folderIds[currentPath] = existingFolder._id;
                            }
                        }
                    }
                    parentId = folderIds[currentPath];
                }

                // Upload files to this folder
                const targetFolderId = folderIds[folderPath];
                for (const file of folderStructure[folderPath]) {
                    const content = await file.text();
                    await axios.post('/api/files', {
                        name: file.name,
                        content: content,
                        folderId: targetFolderId
                    });
                }
            }

            setAlertModal({
                isOpen: true,
                message: `Successfully uploaded ${mdFiles.length} file(s)!`,
                type: 'success'
            });
            fetchData();
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to upload folder',
                type: 'error'
            });
        } finally {
            setUploadingFiles(false);
            event.target.value = '';
            setIsUploadModalVisible(false);
        }
    };

    // GitHub Import Functions
    const parseGithubUrl = (url) => {
        const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
        if (match) {
            return { owner: match[1], repo: match[2].replace('.git', '') };
        }
        return null;
    };

    const handleGithubSearch = async () => {
        const parsed = parseGithubUrl(githubRepoUrl);
        if (!parsed) {
            // Try treating as owner/repo format
            const parts = githubRepoUrl.split('/');
            if (parts.length >= 2) {
                setGithubOwner(parts[0]);
                setGithubRepo(parts[1]);
            } else {
                setAlertModal({
                    isOpen: true,
                    message: 'Invalid GitHub URL. Use format: https://github.com/owner/repo or owner/repo',
                    type: 'error'
                });
                return;
            }
        } else {
            setGithubOwner(parsed.owner);
            setGithubRepo(parsed.repo);
        }

        setGithubLoading(true);
        setGithubCurrentPath('');

        try {
            const owner = parsed?.owner || githubRepoUrl.split('/')[0];
            const repo = parsed?.repo || githubRepoUrl.split('/')[1];

            const response = await axios.get('/api/github/repo', {
                params: { owner, repo, path: '' }
            });
            setGithubRepoContents(response.data);
            setGithubOwner(owner);
            setGithubRepo(repo);
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to fetch repository. Make sure it\'s a public repo.',
                type: 'error'
            });
            setGithubRepoContents(null);
        } finally {
            setGithubLoading(false);
        }
    };

    const handleGithubNavigate = async (path) => {
        setGithubLoading(true);
        try {
            const response = await axios.get('/api/github/repo', {
                params: { owner: githubOwner, repo: githubRepo, path }
            });
            setGithubRepoContents(response.data);
            setGithubCurrentPath(path);
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: 'Failed to navigate to folder',
                type: 'error'
            });
        } finally {
            setGithubLoading(false);
        }
    };

    const handleGithubImport = async () => {
        if (!githubOwner || !githubRepo) return;

        setImportingRepo(true);
        try {
            const response = await axios.post('/api/github/import', {
                owner: githubOwner,
                repo: githubRepo,
                parentFolderId: currentFolder
            });
            setAlertModal({
                isOpen: true,
                message: response.data.message,
                type: 'success'
            });
            setIsGithubModalVisible(false);
            setGithubRepoContents(null);
            setGithubRepoUrl('');
            setGithubOwner('');
            setGithubRepo('');
            fetchData();
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to import repository',
                type: 'error'
            });
        } finally {
            setImportingRepo(false);
        }
    };

    const handleSyncFromGithub = async (fileId) => {
        setSyncingFile(fileId);
        try {
            const response = await axios.post(`/api/github/sync/${fileId}`);
            if (response.data.synced) {
                setAlertModal({
                    isOpen: true,
                    message: 'File synced successfully from GitHub!',
                    type: 'success'
                });
                // Update the file in state
                const updatedFile = response.data.file;
                setMyFiles(prev => prev.map(f => f._id === fileId ? updatedFile : f));
                setFiles(prev => prev.map(f => f._id === fileId ? updatedFile : f));
                // Update selected file if it's the one being synced
                if (selectedFile && selectedFile._id === fileId) {
                    setSelectedFile(updatedFile);
                }
                // Update edit content if editing this file
                if (currentFileId === fileId) {
                    setEditContent(updatedFile.content);
                }
            } else {
                setAlertModal({
                    isOpen: true,
                    message: 'File is already up to date with GitHub.',
                    type: 'success'
                });
            }
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to sync from GitHub',
                type: 'error'
            });
        } finally {
            setSyncingFile(null);
        }
    };

    const handleSyncFolderFromGithub = async (folderId) => {
        setSyncingFolder(folderId);
        try {
            const response = await axios.post(`/api/github/sync-folder/${folderId}`);
            setAlertModal({
                isOpen: true,
                message: response.data.message,
                type: 'success'
            });
            // Refresh data to get updated files
            fetchData();
        } catch (error) {
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to sync folder from GitHub',
                type: 'error'
            });
        } finally {
            setSyncingFolder(null);
        }
    };

    const handleDownloadFile = () => {
        const blob = new Blob([editContent], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = editFileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleDeleteFile = () => {
        if (!currentFileId || !isOwnFile) return;
        setDeleteModal({
            isOpen: true,
            file: { _id: currentFileId, name: editFileName },
            isFromEditor: true
        });
    };

    const confirmDeleteFile = async () => {
        const { file, isFromEditor } = deleteModal;
        if (!file) return;

        try {
            await axios.delete(`/api/files/${file._id}`);
            setDeleteModal({ isOpen: false, file: null, isFromEditor: false });
            setAlertModal({ isOpen: true, message: 'File deleted successfully!', type: 'success' });

            if (isFromEditor) {
                setIsEditing(false);
                setSelectedFile(null);
                setCurrentFileId(null);
            }
            fetchData();
        } catch (error) {
            console.error('Delete error:', error?.response?.data || error);
            setDeleteModal({ isOpen: false, file: null, isFromEditor: false });
            setAlertModal({
                isOpen: true,
                message: error?.response?.data?.message || 'Failed to delete file. Please check your login and permissions.',
                type: 'error'
            });
        }
    };

    const handleDeleteFileFromList = (file) => {
        setDeleteModal({
            isOpen: true,
            file: file,
            isFromEditor: false
        });
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

    const getSaveStatusIndicator = () => {
        if (saveStatus === 'saving') {
            return (
                <span className="flex items-center gap-1 text-xs text-blue-600">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Saving...
                </span>
            );
        }
        if (saveStatus === 'saved') {
            return (
                <span className="flex items-center gap-1 text-xs text-green-600">
                    <CheckCircle className="w-3 h-3" />
                    Saved
                </span>
            );
        }
        if (saveStatus === 'error') {
            return (
                <span className="flex items-center gap-1 text-xs text-red-600">
                    <XCircle className="w-3 h-3" />
                    Error saving
                </span>
            );
        }
        if (hasUnsavedChanges) {
            return (
                <span className="flex items-center gap-1 text-xs text-yellow-600">
                    <AlertCircle className="w-3 h-3" />
                    Unsaved changes
                </span>
            );
        }
        return null;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    // Open File Modal
    const renderOpenModal = () => (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-purple-600" />
                        Open File
                    </h2>
                    <button
                        onClick={() => setIsOpenModalVisible(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <div className="p-4">
                    {/* My Files Section */}
                    <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-2">My Files</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {myFiles.length === 0 ? (
                                <p className="text-sm text-gray-500 py-2">No files created yet</p>
                            ) : (
                                myFiles.map((file) => (
                                    <div
                                        key={file._id}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 border border-gray-200 hover:border-purple-300 transition"
                                    >
                                        <button
                                            onClick={() => handleOpenFile(file)}
                                            className="flex items-center gap-3 flex-1 text-left"
                                        >
                                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                                <File className="w-4 h-4 text-purple-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-900 truncate">{file.name}</p>
                                                    {file.githubSource?.downloadUrl && (
                                                        <Github className="w-3 h-3 text-gray-400" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    Updated {new Date(file.updatedAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </button>
                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                            Editable
                                        </span>
                                        {file.githubSource?.downloadUrl && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSyncFromGithub(file._id);
                                                }}
                                                disabled={syncingFile === file._id}
                                                className="p-1.5 hover:bg-gray-100 rounded-lg transition"
                                                title="Sync from GitHub"
                                            >
                                                {syncingFile === file._id ? (
                                                    <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                                                ) : (
                                                    <RefreshCw className="w-4 h-4 text-gray-500" />
                                                )}
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteFileFromList(file);
                                            }}
                                            className="p-1.5 hover:bg-red-100 rounded-lg transition"
                                            title="Delete file"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* All Files Section */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-2">All Files (Requires Approval to Edit)</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {files.filter(f => !myFiles.some(mf => mf._id === f._id)).map((file) => (
                                <button
                                    key={file._id}
                                    onClick={() => handleOpenFile(file)}
                                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-200 transition text-left"
                                >
                                    <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                        <FileText className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{file.name}</p>
                                        <p className="text-xs text-gray-500">
                                            By {file.author?.name} • Updated {new Date(file.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                        Read-only
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end">
                    <button
                        onClick={() => setIsOpenModalVisible(false)}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );

    // Delete Confirmation Modal
    const renderDeleteModal = () => (
        deleteModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                            Delete File
                        </h3>
                        <p className="text-gray-600 text-center mb-2">
                            Are you sure you want to delete
                        </p>
                        <p className="text-purple-600 font-medium text-center mb-2">
                            "{deleteModal.file?.name}"
                        </p>
                        <p className="text-sm text-red-500 text-center">
                            This action cannot be undone.
                        </p>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                        <button
                            onClick={() => setDeleteModal({ isOpen: false, file: null, isFromEditor: false })}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteFile}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )
    );

    // Success/Alert Modal
    const renderAlertModal = () => (
        alertModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${alertModal.type === 'success' ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                            {alertModal.type === 'success' ? (
                                <CheckCircle className="w-6 h-6 text-green-600" />
                            ) : (
                                <XCircle className="w-6 h-6 text-red-600" />
                            )}
                        </div>
                        <h3 className={`text-lg font-semibold text-center mb-2 ${alertModal.type === 'success' ? 'text-green-700' : 'text-red-700'
                            }`}>
                            {alertModal.type === 'success' ? 'Success!' : 'Error'}
                        </h3>
                        <p className="text-gray-600 text-center">
                            {alertModal.message}
                        </p>
                    </div>
                    <div className="px-6 pb-6">
                        <button
                            onClick={() => setAlertModal({ isOpen: false, message: '', type: 'success' })}
                            className={`w-full px-4 py-2.5 rounded-lg transition font-medium ${alertModal.type === 'success'
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-red-600 text-white hover:bg-red-700'
                                }`}
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        )
    );

    // Delete Folder Confirmation Modal
    const renderDeleteFolderModal = () => (
        deleteFolderModal.isOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                    <div className="p-6">
                        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Folder className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
                            Delete Folder
                        </h3>
                        <p className="text-gray-600 text-center mb-2">
                            Are you sure you want to delete
                        </p>
                        <p className="text-purple-600 font-medium text-center mb-2">
                            "{deleteFolderModal.folder?.name}"
                        </p>
                        <p className="text-sm text-red-500 text-center">
                            All files and subfolders inside will also be deleted.
                        </p>
                    </div>
                    <div className="px-6 pb-6 flex gap-3">
                        <button
                            onClick={() => setDeleteFolderModal({ isOpen: false, folder: null })}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDeleteFolder}
                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        )
    );

    // Create Folder Modal
    const renderCreateFolderModal = () => (
        isCreatingFolder && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FolderPlus className="w-5 h-5 text-purple-600" />
                            Create New Folder
                        </h2>
                        <button
                            onClick={() => {
                                setIsCreatingFolder(false);
                                setNewFolderName('');
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-4">
                        {folderPath.length > 0 && (
                            <p className="text-sm text-gray-500 mb-3">
                                Creating in: <span className="text-purple-600 font-medium">{folderPath[folderPath.length - 1].name}</span>
                            </p>
                        )}
                        <input
                            type="text"
                            placeholder="Folder name"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            autoFocus
                        />
                    </div>
                    <div className="px-4 pb-4 flex gap-3">
                        <button
                            onClick={() => {
                                setIsCreatingFolder(false);
                                setNewFolderName('');
                            }}
                            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateFolder}
                            disabled={!newFolderName.trim()}
                            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <FolderPlus className="w-4 h-4" />
                            Create
                        </button>
                    </div>
                </div>
            </div>
        )
    );

    // Upload Modal
    const renderUploadModal = () => (
        isUploadModalVisible && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-purple-600" />
                            Upload Files
                        </h2>
                        <button
                            onClick={() => setIsUploadModalVisible(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        {folderPath.length > 0 && (
                            <p className="text-sm text-gray-500">
                                Uploading to: <span className="text-purple-600 font-medium">{folderPath[folderPath.length - 1].name}</span>
                            </p>
                        )}

                        <p className="text-sm text-gray-600">
                            Only <span className="font-medium text-purple-600">.md</span> (Markdown) files will be uploaded. Other file types will be skipped.
                        </p>

                        {/* Hidden file inputs */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".md"
                            multiple
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <input
                            ref={folderInputRef}
                            type="file"
                            webkitdirectory=""
                            directory=""
                            multiple
                            onChange={handleFolderUpload}
                            className="hidden"
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingFiles}
                                className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition disabled:opacity-50"
                            >
                                <File className="w-8 h-8 text-purple-600" />
                                <span className="text-sm font-medium text-gray-700">Upload Files</span>
                                <span className="text-xs text-gray-500">Select .md files</span>
                            </button>

                            <button
                                onClick={() => folderInputRef.current?.click()}
                                disabled={uploadingFiles}
                                className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition disabled:opacity-50"
                            >
                                <Folder className="w-8 h-8 text-blue-600" />
                                <span className="text-sm font-medium text-gray-700">Upload Folder</span>
                                <span className="text-xs text-gray-500">With subfolders</span>
                            </button>
                        </div>

                        {uploadingFiles && (
                            <div className="flex items-center justify-center gap-2 text-purple-600">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Uploading...</span>
                            </div>
                        )}
                    </div>
                    <div className="px-4 pb-4">
                        <button
                            onClick={() => setIsUploadModalVisible(false)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )
    );

    // GitHub Import Modal
    const renderGithubModal = () => (
        isGithubModalVisible && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Github className="w-5 h-5" />
                            Import from GitHub
                        </h2>
                        <button
                            onClick={() => {
                                setIsGithubModalVisible(false);
                                setGithubRepoContents(null);
                                setGithubRepoUrl('');
                            }}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-4 border-b border-gray-100">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Public Repository URL
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="https://github.com/owner/repo or owner/repo"
                                value={githubRepoUrl}
                                onChange={(e) => setGithubRepoUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGithubSearch()}
                                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleGithubSearch}
                                disabled={!githubRepoUrl.trim() || githubLoading}
                                className="px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {githubLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Search className="w-4 h-4" />
                                )}
                                View
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Only public repositories are supported. Only .md files will be imported.
                        </p>
                    </div>

                    {/* Repository Contents */}
                    {githubRepoContents && (
                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Github className="w-5 h-5" />
                                    <span className="font-medium">{githubOwner}/{githubRepo}</span>
                                    {githubCurrentPath && (
                                        <span className="text-gray-500">/ {githubCurrentPath}</span>
                                    )}
                                </div>
                                <a
                                    href={`https://github.com/${githubOwner}/${githubRepo}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-purple-600 hover:underline flex items-center gap-1"
                                >
                                    View on GitHub <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {githubCurrentPath && (
                                <button
                                    onClick={() => {
                                        const parentPath = githubCurrentPath.split('/').slice(0, -1).join('/');
                                        handleGithubNavigate(parentPath);
                                    }}
                                    className="flex items-center gap-2 text-gray-600 hover:text-purple-600 mb-3"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back
                                </button>
                            )}

                            <div className="space-y-2">
                                {githubRepoContents.items?.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4">No markdown files or folders found.</p>
                                ) : (
                                    githubRepoContents.items?.map((item) => (
                                        <div
                                            key={item.path}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${item.type === 'folder'
                                                ? 'border-blue-200 hover:bg-blue-50 cursor-pointer'
                                                : 'border-gray-200 hover:bg-gray-50'
                                                } transition`}
                                            onClick={() => item.type === 'folder' && handleGithubNavigate(item.path)}
                                        >
                                            {item.type === 'folder' ? (
                                                <Folder className="w-5 h-5 text-blue-600" />
                                            ) : (
                                                <FileText className="w-5 h-5 text-purple-600" />
                                            )}
                                            <span className="flex-1 font-medium text-gray-900">{item.name}</span>
                                            {item.type === 'folder' && (
                                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                            )}
                                            {item.type === 'file' && item.size && (
                                                <span className="text-xs text-gray-500">
                                                    {(item.size / 1024).toFixed(1)} KB
                                                </span>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Import Button */}
                    {githubRepoContents && (
                        <div className="p-4 border-t border-gray-200 bg-gray-50">
                            {folderPath.length > 0 && (
                                <p className="text-sm text-gray-500 mb-3">
                                    Will import to: <span className="text-purple-600 font-medium">{folderPath[folderPath.length - 1].name}</span>
                                </p>
                            )}
                            <button
                                onClick={handleGithubImport}
                                disabled={importingRepo}
                                className="w-full px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {importingRepo ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Importing...
                                    </>
                                ) : (
                                    <>
                                        <FolderPlus className="w-4 h-4" />
                                        Create Folder from Repo
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                This will create a folder named "{githubRepo}" with all markdown files from the repository.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        )
    );

    // Create New File Modal
    if (isCreating) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Create New File</h1>
                        {folderPath.length > 0 && (
                            <p className="text-sm text-gray-500 mt-1">
                                In folder: <span className="text-purple-600 font-medium">{folderPath.map(f => f.name).join(' / ')}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => setIsCreating(false)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-6 h-6 text-gray-500" />
                    </button>
                </div>

                {/* Filename Input - Separate and prominent */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        File Name
                    </label>
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" />
                        <input
                            type="text"
                            placeholder="Enter filename (e.g., README.md)"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                        {!newFileName.endsWith('.md') && newFileName && (
                            <span className="text-xs text-gray-500">.md will be added</span>
                        )}
                    </div>
                </div>

                <SyncScrollEditor
                    content={newFileContent}
                    onChange={setNewFileContent}
                    placeholder="Write your markdown content here..."
                    editorHeight="500px"
                    editorTitle="Content"
                    previewTitle="Preview"
                />

                <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        {!newFileName && <span className="text-red-500">⚠ Enter a filename</span>}
                        {newFileName && !newFileContent && <span className="text-red-500">⚠ Enter some content</span>}
                        {newFileName && newFileContent && <span className="text-green-600">✓ Ready to create</span>}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsCreating(false)}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleCreateFile}
                            disabled={!newFileName || !newFileContent}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Create File
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Edit Mode
    if (isEditing && selectedFile) {
        return (
            <div className="space-y-6">
                {isOpenModalVisible && renderOpenModal()}
                {renderDeleteModal()}
                {renderAlertModal()}

                {/* Sticky Header with Action Buttons */}
                <div className="sticky top-16 z-40 bg-white border-b border-gray-200 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                            <h1 className="text-lg font-bold text-gray-900 truncate flex items-center gap-2">
                                {isOwnFile ? 'Editing: ' : 'Viewing: '}
                                <input
                                    type="text"
                                    value={editFileName}
                                    onChange={(e) => {
                                        setEditFileName(e.target.value);
                                        setHasUnsavedChanges(true);
                                    }}
                                    disabled={!isOwnFile}
                                    className={`bg-transparent border-none focus:outline-none ${isOwnFile ? 'cursor-text' : 'cursor-default'}`}
                                />
                                {selectedFile.githubSource?.downloadUrl && (
                                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-normal">
                                        <Github className="w-3 h-3" />
                                        GitHub
                                    </span>
                                )}
                            </h1>
                            {getSaveStatusIndicator()}
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Cancel */}
                            <button
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition text-sm font-medium"
                            >
                                Cancel
                            </button>

                            {/* Save button - only for own files */}
                            {isOwnFile && (
                                <button
                                    onClick={handleSaveFile}
                                    disabled={!hasUnsavedChanges || saving}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                                >
                                    {saving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Save
                                </button>
                            )}

                            {/* Send for Approval - hide for admin */}
                            {user?.role !== 'admin' && (
                                <button
                                    onClick={handleSendForApproval}
                                    disabled={sendingForApproval}
                                    className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-1.5 text-sm font-medium"
                                >
                                    {sendingForApproval ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                    {sendingForApproval ? 'Sending...' : 'Send for Approval'}
                                </button>
                            )}

                            {/* Divider */}
                            <div className="w-px h-6 bg-gray-300 mx-1"></div>

                            <button
                                onClick={() => setIsOpenModalVisible(true)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                                title="Open file"
                            >
                                <FolderOpen className="w-5 h-5 text-gray-600" />
                            </button>
                            <button
                                onClick={handleDownloadFile}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                                title="Download file"
                            >
                                <Download className="w-5 h-5 text-gray-600" />
                            </button>
                            {isOwnFile && selectedFile.githubSource?.downloadUrl && (
                                <button
                                    onClick={() => handleSyncFromGithub(currentFileId)}
                                    disabled={syncingFile === currentFileId}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                                    title="Sync from GitHub"
                                >
                                    {syncingFile === currentFileId ? (
                                        <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                                    ) : (
                                        <RefreshCw className="w-5 h-5 text-gray-600" />
                                    )}
                                </button>
                            )}
                            {isOwnFile && (
                                <button
                                    onClick={handleDeleteFile}
                                    className="p-2 hover:bg-red-100 rounded-lg transition"
                                    title="Delete file"
                                >
                                    <Trash2 className="w-5 h-5 text-red-600" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsEditing(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <X className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Toggle Buttons */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowDiff(false)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${!showDiff ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <Edit className="w-4 h-4 inline mr-2" />
                        Editor
                    </button>
                    <button
                        onClick={() => setShowDiff(true)}
                        className={`px-4 py-2 rounded-lg font-medium transition ${showDiff ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        <Eye className="w-4 h-4 inline mr-2" />
                        View Changes
                    </button>
                </div>

                {showDiff ? (
                    <DiffViewer
                        oldContent={selectedFile.content}
                        newContent={editContent}
                        oldTitle="Original"
                        newTitle="Your Changes"
                    />
                ) : (
                    <SyncScrollEditor
                        content={editContent}
                        onChange={handleContentChange}
                        placeholder="Write your markdown content here..."
                        editorHeight="500px"
                        editorTitle="Markdown Editor"
                        previewTitle="Live Preview"
                    />
                )}

                {/* File ownership indicator */}
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    {isOwnFile ? (
                        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-1 rounded">
                            <CheckCircle className="w-3 h-3" />
                            Your file - Can save directly or send for review
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Not your file - Requires admin approval
                        </span>
                    )}
                </div>
            </div>
        );
    }

    // Main Dashboard
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

            {isOpenModalVisible && renderOpenModal()}
            {renderDeleteModal()}
            {renderAlertModal()}
            {renderDeleteFolderModal()}
            {renderCreateFolderModal()}
            {renderUploadModal()}
            {renderGithubModal()}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Editor Dashboard</h1>
                    <p className="text-gray-500 mt-1">Create and edit markdown files</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setIsGithubModalVisible(true)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                        <Github className="w-4 h-4 mr-1.5" />
                        GitHub
                    </button>
                    <button
                        onClick={() => setIsUploadModalVisible(true)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                        <Upload className="w-4 h-4 mr-1.5" />
                        Upload
                    </button>
                    <button
                        onClick={() => setIsCreatingFolder(true)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                        <FolderPlus className="w-4 h-4 mr-1.5" />
                        New Folder
                    </button>
                    <button
                        onClick={() => setIsOpenModalVisible(true)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                        <FolderOpen className="w-4 h-4 mr-1.5" />
                        Open
                    </button>
                    <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm"
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('myfiles')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'myfiles'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        My Files ({myFiles.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('files')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'files'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        All Files ({files.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('edits')}
                        className={`pb-3 px-1 border-b-2 font-medium text-sm transition ${activeTab === 'edits'
                            ? 'border-purple-600 text-purple-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        My Edits ({myEdits.length})
                    </button>
                </nav>
            </div>

            {activeTab === 'myfiles' ? (
                <div className="space-y-4">
                    {/* Breadcrumb Navigation */}
                    <div className="flex items-center gap-2 text-sm">
                        <button
                            onClick={() => handleNavigateToBreadcrumb(-1)}
                            className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition ${currentFolder === null ? 'text-purple-600 font-medium' : 'text-gray-600'}`}
                        >
                            <Folder className="w-4 h-4" />
                            Root
                        </button>
                        {folderPath.map((folder, index) => (
                            <div key={folder._id} className="flex items-center gap-2">
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                                <button
                                    onClick={() => handleNavigateToBreadcrumb(index)}
                                    className={`px-2 py-1 rounded hover:bg-gray-100 transition ${index === folderPath.length - 1 ? 'text-purple-600 font-medium' : 'text-gray-600'}`}
                                >
                                    {folder.name}
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Back button when inside a folder */}
                    {currentFolder && (
                        <button
                            onClick={handleNavigateUp}
                            className="flex items-center gap-2 text-gray-600 hover:text-purple-600 transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}

                    {/* Folders and Files Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Render Folders */}
                        {getCurrentFolderContents().folders.map((folder) => (
                            <div
                                key={folder._id}
                                className="bg-white rounded-xl shadow-sm border border-blue-200 p-4 hover:shadow-md transition cursor-pointer relative"
                            >
                                {/* GitHub indicator */}
                                {folder.githubSource?.repo && (
                                    <div className="absolute top-2 right-12 p-1 bg-gray-100 rounded-md" title={`From GitHub: ${folder.githubSource.owner}/${folder.githubSource.repo}`}>
                                        <Github className="w-3 h-3 text-gray-600" />
                                    </div>
                                )}
                                <div className="flex items-start justify-between mb-3">
                                    <button
                                        onClick={() => handleNavigateToFolder(folder)}
                                        className="flex items-center gap-3 flex-1 text-left"
                                    >
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <Folder className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{folder.name}</h3>
                                            <p className="text-xs text-gray-500">Folder</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteFolder(folder);
                                        }}
                                        className="p-1.5 hover:bg-red-100 rounded-lg transition"
                                        title="Delete folder"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleNavigateToFolder(folder)}
                                        className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-1"
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                        Open Folder
                                    </button>
                                    {folder.githubSource?.repo && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleSyncFolderFromGithub(folder._id);
                                            }}
                                            disabled={syncingFolder === folder._id}
                                            className="px-3 py-2 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition flex items-center justify-center gap-1 disabled:opacity-50"
                                            title="Sync all files from GitHub"
                                        >
                                            {syncingFolder === folder._id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-4 h-4" />
                                            )}
                                            Sync
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Render Files */}
                        {getCurrentFolderContents().files.map((file) => (
                            <div
                                key={file._id}
                                className="bg-white rounded-xl shadow-sm border border-purple-200 p-4 hover:shadow-md transition"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                            <File className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{file.name}</h3>
                                            <p className="text-xs text-gray-500">Your file</p>
                                        </div>
                                    </div>
                                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                        Editable
                                    </span>
                                </div>

                                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                                    {file.content.substring(0, 100)}...
                                </p>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleStartEdit(file, true)}
                                        className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-1"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit & Save
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFileFromList(file)}
                                        className="px-3 py-2 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition flex items-center justify-center gap-1"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Empty State */}
                        {getCurrentFolderContents().folders.length === 0 && getCurrentFolderContents().files.length === 0 && (
                            <div className="col-span-full bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                                <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p className="text-gray-500 mb-4">
                                    {currentFolder ? 'This folder is empty' : 'You haven\'t created any files or folders yet'}
                                </p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => setIsCreatingFolder(true)}
                                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                    >
                                        <FolderPlus className="w-4 h-4 mr-2" />
                                        Create Folder
                                    </button>
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Create File
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'files' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {files.map((file) => (
                        <div
                            key={file._id}
                            className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-gray-900">{file.name}</h3>
                                        <p className="text-xs text-gray-500">{file.author?.name}</p>
                                    </div>
                                </div>
                                {getStatusBadge(file.status)}
                            </div>

                            <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                                {file.content.substring(0, 100)}...
                            </p>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSelectedFile(file)}
                                    className="flex-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-1"
                                >
                                    <Eye className="w-4 h-4" />
                                    View
                                </button>
                                <button
                                    onClick={() => handleStartEdit(file, myFiles.some(f => f._id === file._id))}
                                    className="flex-1 px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-1"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="divide-y divide-gray-100">
                        {myEdits.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No edits yet. Start editing a file!</p>
                            </div>
                        ) : (
                            myEdits.map((edit) => (
                                <div key={edit._id} className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${edit.status === 'approved' ? 'bg-green-100' :
                                                edit.status === 'rejected' ? 'bg-red-100' : 'bg-yellow-100'
                                                }`}>
                                                {edit.status === 'approved' ? (
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                ) : edit.status === 'rejected' ? (
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                ) : (
                                                    <Clock className="w-5 h-5 text-yellow-600" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-gray-900">{edit.file?.name}</h3>
                                                <p className="text-xs text-gray-500">
                                                    Submitted {new Date(edit.createdAt).toLocaleDateString()}
                                                    {edit.reviewedAt && ` • Reviewed ${new Date(edit.reviewedAt).toLocaleDateString()}`}
                                                </p>
                                            </div>
                                        </div>
                                        {getStatusBadge(edit.status)}
                                    </div>
                                    {/* Show review notes if rejected */}
                                    {edit.status === 'rejected' && edit.reviewNotes && (
                                        <div className="mt-3 ml-13 p-3 bg-red-50 rounded-lg border border-red-100">
                                            <p className="text-sm text-red-700">
                                                <span className="font-medium">Rejection reason:</span> {edit.reviewNotes}
                                            </p>
                                        </div>
                                    )}
                                    {/* Show success message if approved */}
                                    {edit.status === 'approved' && (
                                        <div className="mt-3 ml-13 p-3 bg-green-50 rounded-lg border border-green-100">
                                            <p className="text-sm text-green-700">
                                                ✓ Your changes have been applied to the file.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Quick Preview Modal */}
            {selectedFile && !isEditing && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <h2 className="font-semibold text-gray-900">{selectedFile.name}</h2>
                                {selectedFile.githubSource?.downloadUrl && (
                                    <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                                        <Github className="w-3 h-3" />
                                        GitHub
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <MarkdownRenderer content={selectedFile.content} />
                        </div>
                        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setSelectedFile(null)}
                                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
                            >
                                Close
                            </button>
                            {selectedFile.githubSource?.downloadUrl && myFiles.some(f => f._id === selectedFile._id) && (
                                <button
                                    onClick={() => handleSyncFromGithub(selectedFile._id)}
                                    disabled={syncingFile === selectedFile._id}
                                    className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    {syncingFile === selectedFile._id ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Syncing...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="w-4 h-4" />
                                            Sync from GitHub
                                        </>
                                    )}
                                </button>
                            )}
                            <button
                                onClick={() => handleStartEdit(selectedFile, myFiles.some(f => f._id === selectedFile._id))}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                            >
                                <Edit className="w-4 h-4" />
                                Edit This File
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
