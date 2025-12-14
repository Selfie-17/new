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

        // Get the latest commit SHA from the repository
        let latestCommitSha = null;
        try {
            const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'MD-Collab-App'
                }
            });
            if (commitsResponse.ok) {
                const commits = await commitsResponse.json();
                if (commits.length > 0) {
                    latestCommitSha = commits[0].sha;
                    console.log(`[IMPORT] Latest commit SHA for ${owner}/${repo}: ${latestCommitSha}`);
                }
            }
        } catch (commitError) {
            console.warn(`[IMPORT] Could not fetch commit SHA:`, commitError.message);
        }

        // Create root folder for the repo with GitHub source info
        const repoFolder = new Folder({
            name: repo,
            author: req.user._id,
            parent: parentFolderId || null,
            githubSource: {
                owner: owner,
                repo: repo,
                path: '',
                lastCommitSha: latestCommitSha
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

        // Update folder with latest commit SHA after import
        if (latestCommitSha) {
            repoFolder.githubSource.lastCommitSha = latestCommitSha;
            await repoFolder.save();
        }

        await repoFolder.populate('author', 'name email');

        res.status(201).json({
            message: `Successfully imported repository "${repo}"`,
            folder: repoFolder,
            commitSha: latestCommitSha
        });
    } catch (error) {
        console.error('Error importing GitHub repo:', error);
        res.status(500).json({ message: 'Failed to import repository' });
    }
});

/* =========================================================
   SYNC ENTIRE FOLDER FROM GITHUB
   Properly syncs folder structure:
   1. Fetches all GitHub content first
   2. Updates existing files in-place, creates new files/folders
   3. Removes files/folders that no longer exist in GitHub
   NOTE: This route must come before /sync/:fileId to ensure proper route matching
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
        const rootPath = folder.githubSource.path || '';
        const storedCommitSha = folder.githubSource.lastCommitSha;

        console.log(`[SYNC FOLDER] Syncing folder ${req.params.folderId} (${folder.name}) from GitHub repo ${owner}/${repo}`);
        console.log(`[SYNC FOLDER] Stored commit SHA: ${storedCommitSha || 'none'}`);

        // Get the latest commit SHA from the repository
        let latestCommitSha = null;
        try {
            const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'MD-Collab-App'
                }
            });
            if (commitsResponse.ok) {
                const commits = await commitsResponse.json();
                if (commits.length > 0) {
                    latestCommitSha = commits[0].sha;
                    console.log(`[SYNC FOLDER] Latest commit SHA: ${latestCommitSha}`);
                }
            } else {
                console.warn(`[SYNC FOLDER] Failed to fetch commits: ${commitsResponse.status}`);
            }
        } catch (commitError) {
            console.warn(`[SYNC FOLDER] Could not fetch commit SHA:`, commitError.message);
        }

        // Check if commit SHA has changed
        if (latestCommitSha && storedCommitSha && latestCommitSha === storedCommitSha) {
            console.log(`[SYNC FOLDER] Commit SHA matches. Repository is up to date. No sync needed.`);
            return res.json({
                message: 'Repository is already up to date. No changes detected.',
                syncedCount: 0,
                upToDateCount: 0,
                failedCount: 0,
                totalFiles: 0,
                commitSha: latestCommitSha,
                upToDate: true
            });
        }

        if (latestCommitSha) {
            console.log(`[SYNC FOLDER] Commit SHA changed (${storedCommitSha} -> ${latestCommitSha}). Syncing changes...`);
        } else {
            console.log(`[SYNC FOLDER] No commit SHA available or first sync. Syncing...`);
        }

        // Import Edit and Notification models for cleanup
        const Edit = (await import('../models/Edit.js')).default;
        const Notification = (await import('../models/Notification.js')).default;

        // Track all GitHub paths (files and folders) that exist in GitHub
        const githubFilePaths = new Set(); // Set of all file paths that exist in GitHub
        const githubFolderPaths = new Set(); // Set of all folder paths that exist in GitHub

        // Stats tracking
        let filesCreated = 0;
        let filesUpdated = 0;
        let filesUpToDate = 0;
        let filesFailed = 0;
        let foldersCreated = 0;

        // Recursive function to fetch and sync folder structure and files from GitHub
        const syncContents = async (path, parentFolder) => {
            const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'MD-Collab-App'
                }
            });

            if (!response.ok) {
                console.error(`[SYNC FOLDER] Failed to fetch ${path}: ${response.status}`);
                return;
            }

            const contents = await response.json();
            const items = Array.isArray(contents) ? contents : [contents];

            for (const item of items) {
                if (item.type === 'dir') {
                    // Track this folder path
                    githubFolderPaths.add(item.path);
                    
                    // Find or create subfolder
                    let subfolder = await Folder.findOne({
                        name: item.name,
                        parent: parentFolder._id,
                        author: req.user._id
                    });

                    if (!subfolder) {
                        // Create subfolder with GitHub source info
                        subfolder = new Folder({
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
                        foldersCreated++;
                        console.log(`[SYNC FOLDER] Created folder: ${item.path}`);
                    } else {
                        // Update folder GitHub source if needed
                        if (!subfolder.githubSource || subfolder.githubSource.path !== item.path) {
                            subfolder.githubSource = {
                                owner: owner,
                                repo: repo,
                                path: item.path
                            };
                            await subfolder.save();
                        }
                    }

                    // Recursively sync contents
                    await syncContents(item.path, subfolder);
                    
                } else if (item.type === 'file' && item.name.endsWith('.md')) {
                    // Track this file path
                    githubFilePaths.add(item.path);
                    
                    // Fetch file content from GitHub
                    try {
                        const fileResponse = await fetch(item.download_url, {
                            headers: { 'User-Agent': 'MD-Collab-App' }
                        });

                        if (!fileResponse.ok) {
                            console.error(`[SYNC FOLDER] Failed to fetch file ${item.name}: ${fileResponse.status}`);
                            filesFailed++;
                            continue;
                        }

                        const newContent = await fileResponse.text();

                        // Check if file already exists in this folder
                        let existingFile = await File.findOne({
                            name: item.name,
                            folder: parentFolder._id
                        });

                        if (existingFile) {
                            // File exists - check if content has changed
                            if (existingFile.content === newContent) {
                                // Content is the same, just update lastSyncedAt
                                existingFile.githubSource = {
                                    owner: owner,
                                    repo: repo,
                                    path: item.path,
                                    downloadUrl: item.download_url,
                                    lastSyncedAt: new Date()
                                };
                                await existingFile.save();
                                filesUpToDate++;
                                console.log(`[SYNC FOLDER] File up to date: ${item.path}`);
                            } else {
                                // Content changed - update file content
                                existingFile.content = newContent;
                                existingFile.githubSource = {
                                    owner: owner,
                                    repo: repo,
                                    path: item.path,
                                    downloadUrl: item.download_url,
                                    lastSyncedAt: new Date()
                                };
                                // Add new version
                                existingFile.versions.push({
                                    content: newContent,
                                    updatedBy: req.user._id,
                                    updatedAt: new Date()
                                });
                                await existingFile.save();
                                filesUpdated++;
                                console.log(`[SYNC FOLDER] Updated file: ${item.path}`);
                            }
                        } else {
                            // File doesn't exist - create new file
                            const newFile = new File({
                                name: item.name,
                                content: newContent,
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
                                    content: newContent,
                                    updatedBy: req.user._id
                                }]
                            });
                            await newFile.save();
                            filesCreated++;
                            console.log(`[SYNC FOLDER] Created file: ${item.path}`);
                        }
                    } catch (fileError) {
                        console.error(`[SYNC FOLDER] Error fetching file ${item.name}:`, fileError.message);
                        filesFailed++;
                    }
                }
            }
        };

        // Start syncing from root path
        await syncContents(rootPath, folder);

        console.log(`[SYNC FOLDER] GitHub content processed. Found ${githubFilePaths.size} files and ${githubFolderPaths.size} folders in GitHub.`);

        // Now remove files and folders that don't exist in GitHub anymore
        let removedFilesCount = 0;
        let removedFoldersCount = 0;

        // Get all folder IDs including subfolders recursively (get fresh list after creating new folders)
        const getAllFolderIds = async (parentId) => {
            const ids = [parentId];
            const subfolders = await Folder.find({ parent: parentId });
            for (const sub of subfolders) {
                const subIds = await getAllFolderIds(sub._id);
                ids.push(...subIds);
            }
            return ids;
        };

        const allFolderIds = await getAllFolderIds(folder._id);

        // Get all files in these folders that have GitHub source from this repo
        const allFilesInFolders = await File.find({
            folder: { $in: allFolderIds },
            'githubSource.owner': owner,
            'githubSource.repo': repo
        });

        // Find files that don't exist in GitHub anymore
        const filesToRemove = allFilesInFolders.filter(file => {
            const filePath = file.githubSource?.path;
            return filePath && !githubFilePaths.has(filePath);
        });

        if (filesToRemove.length > 0) {
            const fileIdsToRemove = filesToRemove.map(f => f._id);
            console.log(`[SYNC FOLDER] Removing ${filesToRemove.length} files that no longer exist in GitHub:`, filesToRemove.map(f => f.githubSource?.path).join(', '));
            
            await Promise.all([
                Edit.deleteMany({ file: { $in: fileIdsToRemove } }),
                Notification.deleteMany({ fileId: { $in: fileIdsToRemove } }),
                Notification.deleteMany({ 'meta.fileId': { $in: fileIdsToRemove } }),
                File.deleteMany({ _id: { $in: fileIdsToRemove } })
            ]);
            
            removedFilesCount = filesToRemove.length;
        }

        // Find and remove folders that don't exist in GitHub anymore (process from deepest to shallowest)
        const removeOrphanedFolders = async (parentFolderId) => {
            const subfolders = await Folder.find({ parent: parentFolderId });
            let removed = 0;

            for (const subfolder of subfolders) {
                // Recursively process subfolders first (depth-first)
                const subRemoved = await removeOrphanedFolders(subfolder._id);
                removed += subRemoved;

                const folderPath = subfolder.githubSource?.path;
                
                // Check if this folder exists in GitHub (only check folders with GitHub source)
                if (folderPath && !githubFolderPaths.has(folderPath)) {
                    // Delete all files in this folder first
                    const filesInFolder = await File.find({ folder: subfolder._id });
                    if (filesInFolder.length > 0) {
                        const fileIdsInFolder = filesInFolder.map(f => f._id);
                        
                        await Promise.all([
                            Edit.deleteMany({ file: { $in: fileIdsInFolder } }),
                            Notification.deleteMany({ fileId: { $in: fileIdsInFolder } }),
                            Notification.deleteMany({ 'meta.fileId': { $in: fileIdsInFolder } }),
                            File.deleteMany({ _id: { $in: fileIdsInFolder } })
                        ]);
                        removedFilesCount += filesInFolder.length;
                    }
                    
                    // Delete the folder
                    await Folder.findByIdAndDelete(subfolder._id);
                    console.log(`[SYNC FOLDER] Removed folder that no longer exists in GitHub: ${folderPath}`);
                    removed++;
                }
            }

            return removed;
        };

        removedFoldersCount = await removeOrphanedFolders(folder._id);

        const totalSynced = filesCreated + filesUpdated;
        console.log(`[SYNC FOLDER] Successfully synced folder ${req.params.folderId}: ${filesCreated} files created, ${filesUpdated} files updated, ${filesUpToDate} files up to date, ${filesFailed} failed, ${removedFilesCount} files removed, ${removedFoldersCount} folders removed`);

        // Update folder with latest commit SHA
        if (latestCommitSha) {
            folder.githubSource.lastCommitSha = latestCommitSha;
            await folder.save();
            console.log(`[SYNC FOLDER] Updated folder with latest commit SHA: ${latestCommitSha}`);
        }

        const messageParts = [];
        if (filesCreated > 0) messageParts.push(`${filesCreated} files created`);
        if (filesUpdated > 0) messageParts.push(`${filesUpdated} files updated`);
        if (filesUpToDate > 0) messageParts.push(`${filesUpToDate} files up to date`);
        if (removedFilesCount > 0) messageParts.push(`${removedFilesCount} files removed`);
        if (removedFoldersCount > 0) messageParts.push(`${removedFoldersCount} folders removed`);
        if (foldersCreated > 0) messageParts.push(`${foldersCreated} folders created`);
        if (filesFailed > 0) messageParts.push(`${filesFailed} failed`);
        
        const message = messageParts.length > 0 
            ? messageParts.join(', ')
            : 'Sync completed - no changes';

        res.json({
            message,
            syncedCount: totalSynced,
            filesCreated,
            filesUpdated,
            upToDateCount: filesUpToDate,
            failedCount: filesFailed,
            removedFilesCount,
            removedFoldersCount,
            foldersCreated,
            totalFiles: filesCreated + filesUpdated + filesUpToDate + filesFailed,
            commitSha: latestCommitSha,
            commitChanged: latestCommitSha !== storedCommitSha
        });
    } catch (error) {
        console.error('[SYNC FOLDER] Error syncing folder from GitHub:', error);
        res.status(500).json({ 
            message: 'Failed to sync folder from GitHub',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/* =========================================================
   SYNC FILE FROM GITHUB
   Updates file content from the original GitHub source
   IMPORTANT: This endpoint syncs ONLY the specified file, not the entire folder
========================================================= */
router.post('/sync/:fileId', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { fileId } = req.params;

        // Validate fileId is a valid MongoDB ObjectId
        if (!fileId || !fileId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid file ID format' });
        }

        // Find the file - ensure it's actually a File document, not a Folder
        const file = await File.findById(fileId);

        if (!file) {
            // Double-check it's not a folder ID that was mistakenly passed
            const folder = await Folder.findById(fileId);
            if (folder) {
                return res.status(400).json({ 
                    message: 'Invalid request: This is a folder ID. Use /sync-folder endpoint to sync folders.' 
                });
            }
            return res.status(404).json({ message: 'File not found' });
        }

        // Check if user owns the file or is admin
        if (file.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only sync your own files' });
        }

        // Check if file has GitHub source with valid downloadUrl
        if (!file.githubSource || !file.githubSource.downloadUrl) {
            return res.status(400).json({ 
                message: 'This file was not imported from GitHub or does not have a valid GitHub source URL' 
            });
        }

        // Validate downloadUrl is actually a file URL, not a directory
        const downloadUrl = file.githubSource.downloadUrl;
        if (!downloadUrl || typeof downloadUrl !== 'string' || downloadUrl.trim() === '') {
            return res.status(400).json({ message: 'Invalid GitHub source URL for this file' });
        }

        // Ensure we're only syncing this specific file - log for debugging
        console.log(`[SYNC FILE] Syncing file ${fileId} (${file.name}) from GitHub`);

        // Fetch latest content from GitHub - ONLY for this specific file
        const response = await fetch(downloadUrl, {
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

        // Update ONLY this file with new content - do not touch any other files
        file.content = newContent;
        file.githubSource.lastSyncedAt = new Date();
        file.versions.push({
            content: newContent,
            updatedBy: req.user._id,
            updatedAt: new Date()
        });

        await file.save();
        await file.populate('author', 'name email');

        console.log(`[SYNC FILE] Successfully synced file ${fileId} (${file.name})`);

        res.json({
            message: 'File synced successfully from GitHub',
            file,
            synced: true
        });
    } catch (error) {
        console.error(`[SYNC FILE] Error syncing file ${req.params.fileId} from GitHub:`, error);
        res.status(500).json({ 
            message: 'Failed to sync file from GitHub',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


export default router;
