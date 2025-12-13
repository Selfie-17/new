import express from 'express';
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
========================================================= */
router.delete('/:id', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const folder = await Folder.findById(req.params.id);
        if (!folder) {
            return res.status(404).json({ message: 'Folder not found' });
        }

        if (folder.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only delete your own folders' });
        }

        // Recursive function to delete folder and all contents
        const deleteFolderRecursive = async (folderId) => {
            // Find all subfolders
            const subfolders = await Folder.find({ parent: folderId });

            // Recursively delete subfolders
            for (const subfolder of subfolders) {
                await deleteFolderRecursive(subfolder._id);
            }

            // Delete all files in this folder
            await File.deleteMany({ folder: folderId });

            // Delete the folder itself
            await Folder.findByIdAndDelete(folderId);
        };

        await deleteFolderRecursive(req.params.id);

        res.json({ message: 'Folder and contents deleted successfully' });
    } catch (error) {
        console.error('Error deleting folder:', error);
        res.status(500).json({ message: 'Failed to delete folder' });
    }
});

export default router;
