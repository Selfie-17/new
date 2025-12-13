import { useState, useEffect } from 'react';
import { FileText, Search, Eye, Clock, User, AlertCircle, Folder, ChevronRight, Home, ArrowLeft, Github } from 'lucide-react';
import axios from '../config/axiosConfig';
import MarkdownRenderer from '../components/MarkdownRenderer';

export default function ViewerDashboard() {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [selectedFile, setSelectedFile] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [backendConnected, setBackendConnected] = useState(true);

    // Folder navigation state
    const [currentFolder, setCurrentFolder] = useState(null); // null = root
    const [folderPath, setFolderPath] = useState([]); // breadcrumb path

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [filesRes, foldersRes] = await Promise.all([
                axios.get('/api/files'),
                axios.get('/api/folders/published')
            ]);
            console.log('Fetched files:', filesRes.data);
            console.log('Fetched folders:', foldersRes.data);
            setFiles(filesRes.data);
            setFolders(foldersRes.data);
            setBackendConnected(true);
        } catch (error) {
            console.error('Fetch error:', error);
            setBackendConnected(false);
            // Demo data for testing without backend
            setFiles([
                {
                    _id: '1',
                    name: 'README.md',
                    content: `# Welcome to MD Collab :rocket:

This is a **collaborative markdown editing platform** with *full* ***GitHub Flavored Markdown*** support.

## Features :sparkles:

- [x] Role-based access control
- [x] Real-time markdown preview
- [x] GitHub-style diff viewer
- [x] Approval workflow
- [ ] Coming soon: Real-time collaboration

## Code Examples

### JavaScript
\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);

// Arrow function
const add = (a, b) => a + b;
\`\`\`

### Python
\`\`\`python
def hello_world():
    print("Hello, World!")
    return True
\`\`\`

You can also use inline code like \`npm install\` in your text.

## Blockquotes

> This platform makes markdown collaboration easy and intuitive.
> 
> > Nested quotes work too!

## Links & Images

[Visit GitHub](https://github.com "GitHub Homepage")

## Math Support

Inline math: $E = mc^2$

Block math:
$$
\\sum_{i=1}^{n} x_i = x_1 + x_2 + ... + x_n
$$

## Horizontal Rule

---

## Strikethrough

~~This text is struck through~~

## Emojis

:heart: :fire: :thumbsup: :rocket: :star:

`,
                    author: { name: 'Admin User' },
                    status: 'approved',
                    updatedAt: new Date().toISOString()
                },
                {
                    _id: '2',
                    name: 'CONTRIBUTING.md',
                    content: `# Contributing Guidelines :handshake:

We welcome contributions! :tada:

## How to Contribute

1. Fork the repository
2. Create a feature branch
   - Use descriptive branch names
   - Keep changes focused
3. Make your changes
4. Submit a pull request

## Code Style

| Rule | Description | Example |
|:-----|:-----------:|--------:|
| Indentation | Use 2 spaces | \`  code\` |
| Naming | camelCase | \`myVariable\` |
| Comments | Be descriptive | \`// Handles X\` |

## Task Checklist

- [x] Read the guidelines
- [x] Fork the repo
- [ ] Make changes
- [ ] Submit PR

## Important Notes

> **Note:** Always run tests before submitting!

> **Warning:** Don't commit sensitive data.

## Contact

Mention @maintainer for help with issues #123
`,
                    author: { name: 'Editor User' },
                    status: 'approved',
                    updatedAt: new Date().toISOString()
                },
                {
                    _id: '3',
                    name: 'API.md',
                    content: `# API Documentation :books:

## Authentication

All endpoints require a valid JWT token.

\`\`\`bash
curl -H "Authorization: Bearer <token>" https://api.example.com/files
\`\`\`

## Endpoints

### GET /api/files

Returns all approved markdown files.

**Response:**
\`\`\`json
{
  "status": "success",
  "data": [
    { "id": "1", "name": "README.md" }
  ]
}
\`\`\`

### POST /api/files

Create a new markdown file.

| Parameter | Type | Required | Description |
|:----------|:----:|:--------:|:------------|
| name | string | :white_check_mark: | File name |
| content | string | :white_check_mark: | Markdown content |
| status | string | :x: | File status |

## Rate Limits

- **Free tier:** 100 requests/hour
- **Pro tier:** 1000 requests/hour

## Error Codes

| Code | Meaning |
|------|----------|
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Server Error |

---

*Last updated: December 2025*
`,
                    author: { name: 'Admin User' },
                    status: 'approved',
                    folder: null,
                    updatedAt: new Date().toISOString()
                }
            ]);
            setFolders([]);
        }
        setLoading(false);
    };

    // Get folders in current directory
    const getCurrentFolders = () => {
        return folders.filter(folder => {
            const parentId = folder.parent?._id || folder.parent;
            if (currentFolder === null) {
                // Root level - show folders without parent or with empty/null parent
                return !parentId || parentId === null || parentId === undefined || parentId === '';
            }
            return parentId === currentFolder || parentId?.toString() === currentFolder;
        });
    };

    // Get files in current directory
    const getCurrentFiles = () => {
        if (currentFolder === null) {
            // Root level - show ALL files that don't have a folder
            return files.filter(file => {
                // Check if file has no folder assigned
                if (!file.folder) return true;
                if (file.folder === null) return true;
                if (typeof file.folder === 'object' && !file.folder._id) return true;
                return false;
            });
        }

        // Inside a folder - show files in that folder
        return files.filter(file => {
            const folderId = typeof file.folder === 'object'
                ? file.folder?._id
                : file.folder;
            return folderId === currentFolder || folderId?.toString() === currentFolder;
        });
    };

    // Navigation handlers
    const handleNavigateToFolder = (folder) => {
        if (folder === null) {
            setCurrentFolder(null);
            setFolderPath([]);
        } else {
            setCurrentFolder(folder._id);
            setFolderPath(prev => [...prev, folder]);
        }
        setSelectedFile(null);
    };

    const handleNavigateUp = () => {
        if (folderPath.length === 0) return;
        const newPath = [...folderPath];
        newPath.pop();
        setFolderPath(newPath);
        setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1]._id : null);
        setSelectedFile(null);
    };

    const handleNavigateToBreadcrumb = (index) => {
        if (index === -1) {
            setCurrentFolder(null);
            setFolderPath([]);
        } else {
            const newPath = folderPath.slice(0, index + 1);
            setFolderPath(newPath);
            setCurrentFolder(newPath[newPath.length - 1]._id);
        }
        setSelectedFile(null);
    };

    // Filter based on search
    const filteredFolders = getCurrentFolders().filter(folder =>
        folder.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const filteredFiles = getCurrentFiles().filter(file =>
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Markdown Files</h1>
                    <p className="text-gray-500 mt-1">Browse and read all published markdown files</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search files and folders..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent w-full sm:w-64"
                    />
                </div>
            </div>

            {/* Breadcrumb Navigation */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3">
                <div className="flex items-center gap-2 text-sm overflow-x-auto">
                    <button
                        onClick={() => handleNavigateToBreadcrumb(-1)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg transition ${currentFolder === null
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Home className="w-4 h-4" />
                        <span>Root</span>
                    </button>
                    {folderPath.map((folder, index) => (
                        <div key={folder._id} className="flex items-center gap-2">
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                            <button
                                onClick={() => handleNavigateToBreadcrumb(index)}
                                className={`px-2 py-1 rounded-lg transition ${index === folderPath.length - 1
                                    ? 'bg-purple-100 text-purple-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                            >
                                {folder.name}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File/Folder List */}
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-purple-600" />
                            Contents ({filteredFolders.length + filteredFiles.length})
                        </h2>
                        {currentFolder !== null && (
                            <button
                                onClick={handleNavigateUp}
                                className="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                        )}
                    </div>
                    <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                        {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>This folder is empty</p>
                            </div>
                        ) : (
                            <>
                                {/* Folders */}
                                {filteredFolders.map((folder) => (
                                    <button
                                        key={folder._id}
                                        onClick={() => handleNavigateToFolder(folder)}
                                        className="w-full p-4 text-left hover:bg-gray-50 transition flex items-center gap-3"
                                    >
                                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center relative">
                                            <Folder className="w-5 h-5 text-yellow-600" />
                                            {folder.githubSource?.repo && (
                                                <div className="absolute -top-1 -right-1 p-0.5 bg-gray-200 rounded-full">
                                                    <Github className="w-2.5 h-2.5 text-gray-600" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-gray-900 truncate">{folder.name}</p>
                                            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                <User className="w-3 h-3" />
                                                <span>{folder.author?.name || 'Unknown'}</span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-400" />
                                    </button>
                                ))}

                                {/* Files */}
                                {filteredFiles.map((file) => (
                                    <button
                                        key={file._id}
                                        onClick={() => setSelectedFile(file)}
                                        className={`w-full p-4 text-left hover:bg-gray-50 transition ${selectedFile?._id === file._id ? 'bg-purple-50 border-l-4 border-purple-600' : ''
                                            }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center relative">
                                                    <FileText className="w-5 h-5 text-purple-600" />
                                                    {file.githubSource?.repo && (
                                                        <div className="absolute -top-1 -right-1 p-0.5 bg-gray-200 rounded-full">
                                                            <Github className="w-2.5 h-2.5 text-gray-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{file.name}</p>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                                        <User className="w-3 h-3" />
                                                        <span>{file.author?.name}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 ml-13">
                                            <Clock className="w-3 h-3" />
                                            <span>{new Date(file.updatedAt).toLocaleDateString()}</span>
                                        </div>
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Markdown Preview */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Eye className="w-5 h-5 text-purple-600" />
                            Preview
                        </h2>
                        {selectedFile && (
                            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                {selectedFile.status}
                            </span>
                        )}
                    </div>
                    <div className="p-6 max-h-[600px] overflow-y-auto">
                        {selectedFile ? (
                            <MarkdownRenderer content={selectedFile.content} />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                                <Eye className="w-16 h-16 mb-4 text-gray-300" />
                                <p className="text-lg font-medium">Select a file to preview</p>
                                <p className="text-sm">Click on any file from the list</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
