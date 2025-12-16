import express from 'express';
import archiver from 'archiver';
import Folder from '../models/Folder.js';
import File from '../models/File.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/* =========================================================
   GET ALL FOLDERS FOR CURRENT USER
========================================================= */
router.get('/my', authenticate, async (req, res) => {
    try {
        const folders = await Folder.find({ author: req.user._id })
            .populate('author', 'name email')
            .populate('parent', 'name')
            .sort({ name: 1 });

        res.json(folders);
    } catch (error) {
        console.error('Error fetching folders:', error);
        res.status(500).json({ message: 'Failed to fetch folders' });
    }
});

/* =========================================================
   GET ALL FOLDERS FOR ADMIN (from all users)
========================================================= */
router.get('/admin/all', authenticate, authorize('admin'), async (req, res) => {
    try {
        const folders = await Folder.find({})
            .populate('author', 'name email')
            .populate('parent', 'name')
            .sort({ name: 1 });

        res.json(folders);
    } catch (error) {
        console.error('Error fetching all folders:', error);
        res.status(500).json({ message: 'Failed to fetch folders' });
    }
});

/* =========================================================
   GET ALL PUBLISHED FOLDERS (for viewers)
   Returns folders that contain at least one published file
========================================================= */
router.get('/published', authenticate, async (req, res) => {
    try {
        // Get all published files
        const publishedFiles = await File.find({
            status: 'approved',
            published: true
        }).select('folder');

        // Get unique folder IDs from published files
        const folderIds = [...new Set(
            publishedFiles
                .filter(f => f.folder !== null)
                .map(f => f.folder.toString())
        )];

        // Helper to get all parent folders recursively
        const getAllParentFolders = async (folderIdSet) => {
            const folders = await Folder.find({ _id: { $in: [...folderIdSet] } });
            const parentIds = folders
                .filter(f => f.parent !== null)
                .map(f => f.parent.toString());

            const newParents = parentIds.filter(id => !folderIdSet.has(id));
            if (newParents.length > 0) {
                newParents.forEach(id => folderIdSet.add(id));
                await getAllParentFolders(folderIdSet);
            }
            return folderIdSet;
        };

        // Get all folders including parents
        const allFolderIds = await getAllParentFolders(new Set(folderIds));

        const folders = await Folder.find({ _id: { $in: [...allFolderIds] } })
            .populate('author', 'name email')
            .populate('parent', 'name')
            .sort({ name: 1 });

        res.json(folders);
    } catch (error) {
        console.error('Error fetching published folders:', error);
        res.status(500).json({ message: 'Failed to fetch folders' });
    }
});

/* =========================================================
   GET FOLDER TREE STRUCTURE (folders + files)
========================================================= */
router.get('/tree', authenticate, async (req, res) => {
    try {
        const folders = await Folder.find({ author: req.user._id })
            .populate('author', 'name email')
            .sort({ name: 1 });

        const files = await File.find({ author: req.user._id })
            .populate('author', 'name email')
            .sort({ name: 1 });

        // Build tree structure
        const buildTree = (parentId = null) => {
            const folderItems = folders
                .filter(f => (f.parent ? f.parent.toString() : null) === (parentId ? parentId.toString() : null))
                .map(folder => ({
                    _id: folder._id,
                    name: folder.name,
                    type: 'folder',
                    author: folder.author,
                    createdAt: folder.createdAt,
                    updatedAt: folder.updatedAt,
                    children: buildTree(folder._id)
                }));

            const fileItems = files
                .filter(f => (f.folder ? f.folder.toString() : null) === (parentId ? parentId.toString() : null))
                .map(file => ({
                    _id: file._id,
                    name: file.name,
                    type: 'file',
                    content: file.content,
                    status: file.status,
                    author: file.author,
                    createdAt: file.createdAt,
                    updatedAt: file.updatedAt
                }));

            return [...folderItems, ...fileItems];
        };

        res.json(buildTree());
    } catch (error) {
        console.error('Error fetching folder tree:', error);
        res.status(500).json({ message: 'Failed to fetch folder tree' });
    }
});

/* =========================================================
   GET ALL FILES IN FOLDER (including subfolders)
   For PDF download functionality
========================================================= */
router.get('/:id/files', authenticate, async (req, res) => {
    try {
        const folderId = req.params.id;

        if (!folderId || !folderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid folder ID format' });
        }

        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Recursive function to get all files
        const getAllFilesRecursive = async (currentFolderId) => {
            let files = await File.find({ folder: currentFolderId })
                .populate('author', 'name email');

            const subfolders = await Folder.find({ parent: currentFolderId });
            for (const subfolder of subfolders) {
                const subFiles = await getAllFilesRecursive(subfolder._id);
                files = [...files, ...subFiles];
            }

            return files;
        };

        const files = await getAllFilesRecursive(folderId);
        res.json(files);
    } catch (error) {
        console.error('Error fetching folder files:', error);
        res.status(500).json({ message: 'Failed to fetch folder files' });
    }
});

/* =========================================================
   GET SINGLE FOLDER
========================================================= */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const folder = await Folder.findById(req.params.id)
            .populate('author', 'name email')
            .populate('parent', 'name');

        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        res.json(folder);
    } catch (error) {
        console.error('Error fetching folder:', error);
        res.status(500).json({ message: 'Failed to fetch folder' });
    }
});

/* =========================================================
   CREATE NEW FOLDER (Editor & Admin)
========================================================= */
router.post('/', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { name, parentId } = req.body;

        // Validate parent folder if provided
        if (parentId) {
            const parentFolder = await Folder.findById(parentId);
            if (!parentFolder) {
                return res.status(404).json({ message: 'Parent folder not found' });
            }
            // Check if user owns the parent folder
            if (parentFolder.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Cannot create folder in folder you do not own' });
            }
        }

        // Check for duplicate folder name in same parent
        const existingFolder = await Folder.findOne({
            name,
            author: req.user._id,
            parent: parentId || null
        });

        if (existingFolder) {
            return res.status(400).json({ message: 'Folder with this name already exists in this location' });
        }

        const folder = new Folder({
            name,
            author: req.user._id,
            parent: parentId || null
        });

        await folder.save();
        await folder.populate('author', 'name email');

        res.status(201).json(folder);
    } catch (error) {
        console.error('Error creating folder:', error);
        res.status(500).json({ message: 'Failed to create folder' });
    }
});

/* =========================================================
   RENAME FOLDER (Editor & Admin - own folders only)
========================================================= */
router.put('/:id', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { name } = req.body;

        const folder = await Folder.findById(req.params.id);
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        if (folder.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only rename your own folders' });
        }

        // Check for duplicate name
        const existingFolder = await Folder.findOne({
            name,
            author: folder.author,
            parent: folder.parent,
            _id: { $ne: folder._id }
        });

        if (existingFolder) {
            return res.status(400).json({ message: 'Folder with this name already exists in this location' });
        }

        folder.name = name;
        await folder.save();
        await folder.populate('author', 'name email');

        res.json(folder);
    } catch (error) {
        console.error('Error renaming folder:', error);
        res.status(500).json({ message: 'Failed to rename folder' });
    }
});

/* =========================================================
   DELETE FOLDER (Editor & Admin - own folders only)
   Recursively deletes subfolders and files
   Permanently removes all files from database for ALL users
========================================================= */
router.delete('/:id', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const folderId = req.params.id;

        // Validate folderId format
        if (!folderId || !folderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid folder ID format' });
        }

        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        if (folder.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only delete your own folders' });
        }

        const folderName = folder.name;
        console.log(`[DELETE FOLDER] Deleting folder ${folderId} (${folderName}) by user ${req.user._id}`);

        // Import Edit and Notification models
        const Edit = (await import('../models/Edit.js')).default;
        const Notification = (await import('../models/Notification.js')).default;

        let totalFilesDeleted = 0;
        let totalEditsDeleted = 0;
        let totalNotificationsDeleted = 0;

        // Recursive function to delete folder and all contents
        const deleteFolderRecursive = async (currentFolderId) => {
            // Find all subfolders
            const subfolders = await Folder.find({ parent: currentFolderId });

            // Recursively delete subfolders
            for (const subfolder of subfolders) {
                await deleteFolderRecursive(subfolder._id);
            }

            // Get all files in this folder before deleting
            const filesInFolder = await File.find({ folder: currentFolderId });
            const fileIds = filesInFolder.map(f => f._id);

            if (fileIds.length > 0) {
                // Delete all related data for these files
                const [editsResult, notificationsResult1, notificationsResult2] = await Promise.all([
                    Edit.deleteMany({ file: { $in: fileIds } }),
                    Notification.deleteMany({ fileId: { $in: fileIds } }),
                    Notification.deleteMany({ 'meta.fileId': { $in: fileIds } })
                ]);

                totalEditsDeleted += editsResult.deletedCount || 0;
                totalNotificationsDeleted += (notificationsResult1.deletedCount || 0) + (notificationsResult2.deletedCount || 0);
            }

            // Delete all files in this folder - permanently removes from database for ALL users
            const filesResult = await File.deleteMany({ folder: currentFolderId });
            totalFilesDeleted += filesResult.deletedCount || 0;

            // Delete the folder itself
            await Folder.findByIdAndDelete(currentFolderId);
        };

        await deleteFolderRecursive(folderId);

        console.log(`[DELETE FOLDER] Successfully deleted folder ${folderId} (${folderName}). Removed ${totalFilesDeleted} files, ${totalEditsDeleted} edits, and ${totalNotificationsDeleted} notifications`);

        res.json({
            message: 'Folder and contents deleted successfully',
            deleted: {
                folderId: folderId,
                folderName: folderName,
                filesDeleted: totalFilesDeleted,
                editsDeleted: totalEditsDeleted,
                notificationsDeleted: totalNotificationsDeleted
            }
        });
    } catch (error) {
        console.error(`[DELETE FOLDER] Error deleting folder ${req.params.id}:`, error);
        res.status(500).json({
            message: 'Failed to delete folder',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/* =========================================================
   DOWNLOAD FOLDER AS ZIP
   Downloads all files in a folder and subfolders as a ZIP file
========================================================= */
router.get('/:id/download', authenticate, async (req, res) => {
    try {
        const folderId = req.params.id;

        // Validate folderId format
        if (!folderId || !folderId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid folder ID format' });
        }

        const folder = await Folder.findById(folderId);
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        // Check if user owns the folder, is admin, or if the folder is published
        const isOwner = folder.author.toString() === req.user._id.toString();
        const isAdmin = req.user.role === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: 'You can only download your own folders' });
        }

        console.log(`[DOWNLOAD FOLDER] Downloading folder ${folderId} (${folder.name}) by user ${req.user._id}`);

        // Set up the response as a ZIP file
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${folder.name}.zip"`);

        // Create a ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Pipe the archive to the response
        archive.pipe(res);

        // Handle archive errors
        archive.on('error', (err) => {
            console.error('[DOWNLOAD FOLDER] Archive error:', err);
            res.status(500).json({ message: 'Failed to create ZIP archive' });
        });

        // Recursive function to add folder contents to archive
        const addFolderContents = async (currentFolderId, currentPath) => {
            // Get all files in this folder
            const files = await File.find({ folder: currentFolderId });

            for (const file of files) {
                const filePath = currentPath ? `${currentPath}/${file.name}` : file.name;
                archive.append(file.content, { name: filePath });
            }

            // Get all subfolders
            const subfolders = await Folder.find({ parent: currentFolderId });

            for (const subfolder of subfolders) {
                const subfolderPath = currentPath ? `${currentPath}/${subfolder.name}` : subfolder.name;
                await addFolderContents(subfolder._id, subfolderPath);
            }
        };

        // Add all folder contents to archive
        await addFolderContents(folderId, '');

        // Finalize the archive
        await archive.finalize();

        console.log(`[DOWNLOAD FOLDER] Successfully created ZIP for folder ${folderId} (${folder.name})`);
    } catch (error) {
        console.error(`[DOWNLOAD FOLDER] Error downloading folder ${req.params.id}:`, error);
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Failed to download folder',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});

export default router;
