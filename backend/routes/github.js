import express from 'express';
import Folder from '../models/Folder.js';
import File from '../models/File.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/* =========================================================
   FETCH PUBLIC GITHUB REPO CONTENTS
   Returns the tree structure of markdown files in a repo
========================================================= */
router.get('/repo', authenticate, async (req, res) => {
    try {
        const { owner, repo, path = '' } = req.query;

        if (!owner || !repo) {
            return res.status(400).json({ message: 'Owner and repo are required' });
        }

        // Fetch repo contents from GitHub API
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        const response = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'MD-Collab-App'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ message: 'Repository not found or is private' });
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const contents = await response.json();

        // Filter and transform the contents
        const items = Array.isArray(contents) ? contents : [contents];

        const filteredItems = items
            .filter(item => {
                // Include directories and markdown files only
                if (item.type === 'dir') return true;
                if (item.type === 'file' && item.name.endsWith('.md')) return true;
                return false;
            })
            .map(item => ({
                name: item.name,
                path: item.path,
                type: item.type === 'dir' ? 'folder' : 'file',
                size: item.size,
                sha: item.sha,
                downloadUrl: item.download_url
            }));

        res.json({
            owner,
            repo,
            path,
            items: filteredItems
        });
    } catch (error) {
        console.error('Error fetching GitHub repo:', error);
        res.status(500).json({ message: 'Failed to fetch repository contents' });
    }
});

/* =========================================================
   FETCH FILE CONTENT FROM GITHUB
========================================================= */
router.get('/file-content', authenticate, async (req, res) => {
    try {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({ message: 'File URL is required' });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'MD-Collab-App'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
        }

        const content = await response.text();
        res.json({ content });
    } catch (error) {
        console.error('Error fetching file content:', error);
        res.status(500).json({ message: 'Failed to fetch file content' });
    }
});

/* =========================================================
   IMPORT GITHUB REPO AS FOLDER
   Creates a folder structure with all markdown files from a repo
========================================================= */
router.post('/import', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { owner, repo, parentFolderId } = req.body;

        if (!owner || !repo) {
            return res.status(400).json({ message: 'Owner and repo are required' });
        }

        // Validate parent folder if provided
        if (parentFolderId) {
            const parentFolder = await Folder.findById(parentFolderId);
            if (!parentFolder) {
                return res.status(404).json({ message: 'Parent folder not found' });
            }
            if (parentFolder.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Cannot import into folder you do not own' });
            }
        }

        // Check if folder with repo name already exists
        const existingFolder = await Folder.findOne({
            name: repo,
            author: req.user._id,
            parent: parentFolderId || null
        });

        if (existingFolder) {
            return res.status(400).json({ message: `Folder "${repo}" already exists. Delete it first or choose a different location.` });
        }

        // Create root folder for the repo with GitHub source info
        const repoFolder = new Folder({
            name: repo,
            author: req.user._id,
            parent: parentFolderId || null,
            githubSource: {
                owner: owner,
                repo: repo,
                path: ''
            }
        });
        await repoFolder.save();

        // Recursive function to fetch and create folder structure
        const importContents = async (path, parentFolder) => {
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'MD-Collab-App'
                }
            });

            if (!response.ok) {
                console.error(`Failed to fetch ${path}: ${response.status}`);
                return;
            }

            const contents = await response.json();
            const items = Array.isArray(contents) ? contents : [contents];

            for (const item of items) {
                if (item.type === 'dir') {
                    // Create subfolder with GitHub source info
                    const subfolder = new Folder({
                        name: item.name,
                        author: req.user._id,
                        parent: parentFolder._id,
                        githubSource: {
                            owner: owner,
                            repo: repo,
                            path: item.path
                        }
                    });
                    await subfolder.save();

                    // Recursively import contents
                    await importContents(item.path, subfolder);
                } else if (item.type === 'file' && item.name.endsWith('.md')) {
                    // Fetch file content
                    try {
                        const fileResponse = await fetch(item.download_url, {
                            headers: { 'User-Agent': 'MD-Collab-App' }
                        });

                        if (fileResponse.ok) {
                            const content = await fileResponse.text();

                            // Create file with GitHub source info for sync
                            const file = new File({
                                name: item.name,
                                content: content,
                                author: req.user._id,
                                folder: parentFolder._id,
                                status: 'approved',
                                githubSource: {
                                    owner: owner,
                                    repo: repo,
                                    path: item.path,
                                    downloadUrl: item.download_url,
                                    lastSyncedAt: new Date()
                                },
                                versions: [{
                                    content: content,
                                    updatedBy: req.user._id
                                }]
                            });
                            await file.save();
                        }
                    } catch (fileError) {
                        console.error(`Failed to fetch file ${item.name}:`, fileError);
                    }
                }
            }
        };

        // Start importing from root
        await importContents('', repoFolder);

        await repoFolder.populate('author', 'name email');

        res.status(201).json({
            message: `Successfully imported repository "${repo}"`,
            folder: repoFolder
        });
    } catch (error) {
        console.error('Error importing GitHub repo:', error);
        res.status(500).json({ message: 'Failed to import repository' });
    }
});

/* =========================================================
   SYNC FILE FROM GITHUB
   Updates file content from the original GitHub source
========================================================= */
router.post('/sync/:fileId', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const file = await File.findById(req.params.fileId);

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check if user owns the file or is admin
        if (file.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only sync your own files' });
        }

        // Check if file has GitHub source
        if (!file.githubSource || !file.githubSource.downloadUrl) {
            return res.status(400).json({ message: 'This file was not imported from GitHub' });
        }

        // Fetch latest content from GitHub
        const response = await fetch(file.githubSource.downloadUrl, {
            headers: { 'User-Agent': 'MD-Collab-App' }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return res.status(404).json({ message: 'File no longer exists on GitHub' });
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const newContent = await response.text();

        // Check if content has changed
        if (newContent === file.content) {
            return res.json({
                message: 'File is already up to date',
                file,
                synced: false
            });
        }

        // Update file with new content
        file.content = newContent;
        file.githubSource.lastSyncedAt = new Date();
        file.versions.push({
            content: newContent,
            updatedBy: req.user._id,
            updatedAt: new Date()
        });

        await file.save();
        await file.populate('author', 'name email');

        res.json({
            message: 'File synced successfully from GitHub',
            file,
            synced: true
        });
    } catch (error) {
        console.error('Error syncing file from GitHub:', error);
        res.status(500).json({ message: 'Failed to sync file from GitHub' });
    }
});

/* =========================================================
   SYNC ENTIRE FOLDER FROM GITHUB
   Updates all files in a folder from their GitHub sources
========================================================= */
router.post('/sync-folder/:folderId', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const folder = await Folder.findById(req.params.folderId);

        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Check if user owns the folder or is admin
        if (folder.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only sync your own folders' });
        }

        // Check if folder has GitHub source
        if (!folder.githubSource || !folder.githubSource.repo) {
            return res.status(400).json({ message: 'This folder was not imported from GitHub' });
        }

        const { owner, repo } = folder.githubSource;

        // Get all folder IDs including subfolders recursively
        const getAllFolderIds = async (parentId) => {
            const ids = [parentId];
            const subfolders = await Folder.find({ parent: parentId });
            for (const sub of subfolders) {
                const subIds = await getAllFolderIds(sub._id);
                ids.push(...subIds);
            }
            return ids;
        };

        const folderIds = await getAllFolderIds(folder._id);

        // Get all files in these folders that have GitHub source
        const files = await File.find({
            folder: { $in: folderIds },
            'githubSource.downloadUrl': { $exists: true, $ne: null }
        });

        let syncedCount = 0;
        let failedCount = 0;
        let upToDateCount = 0;

        for (const file of files) {
            try {
                const response = await fetch(file.githubSource.downloadUrl, {
                    headers: { 'User-Agent': 'MD-Collab-App' }
                });

                if (!response.ok) {
                    failedCount++;
                    continue;
                }

                const newContent = await response.text();

                if (newContent === file.content) {
                    upToDateCount++;
                    continue;
                }

                file.content = newContent;
                file.githubSource.lastSyncedAt = new Date();
                file.versions.push({
                    content: newContent,
                    updatedBy: req.user._id,
                    updatedAt: new Date()
                });

                await file.save();
                syncedCount++;
            } catch (err) {
                console.error(`Failed to sync file ${file.name}:`, err);
                failedCount++;
            }
        }

        res.json({
            message: `Synced ${syncedCount} files, ${upToDateCount} already up to date, ${failedCount} failed`,
            syncedCount,
            upToDateCount,
            failedCount,
            totalFiles: files.length
        });
    } catch (error) {
        console.error('Error syncing folder from GitHub:', error);
        res.status(500).json({ message: 'Failed to sync folder from GitHub' });
    }
});

export default router;
