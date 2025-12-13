import express from 'express';
import File from '../models/File.js';
import Edit from '../models/Edit.js';
import Notification from '../models/Notification.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

/* =========================================================
   GET ALL PUBLISHED FILES (All authenticated users)
   Non-admins only see published files
========================================================= */
router.get('/', authenticate, async (req, res) => {
    try {
        // All users see approved files (published check removed for simplicity)
        // Admins see all approved files, viewers/editors also see all approved files
        const query = { status: 'approved' };

        const files = await File.find(query)
            .populate('author', 'name email')
            .populate('folder', '_id name')
            .sort({ updatedAt: -1 });

        res.json(files);
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ message: 'Failed to fetch files' });
    }
});

/* =========================================================
   GET ALL FILES FOR ADMIN (includes published status)
========================================================= */
router.get('/admin/all', authenticate, authorize('admin'), async (req, res) => {
    try {
        const files = await File.find({})
            .populate('author', 'name email')
            .sort({ updatedAt: -1 });

        res.json(files);
    } catch (error) {
        console.error('Error fetching all files:', error);
        res.status(500).json({ message: 'Failed to fetch files' });
    }
});

/* =========================================================
   GET FILES CREATED BY CURRENT USER
   IMPORTANT: must be before "/:id"
========================================================= */
router.get('/my/files', authenticate, async (req, res) => {
    try {
        const files = await File.find({ author: req.user._id })
            .populate('author', 'name email')
            .sort({ updatedAt: -1 });

        res.json(files);
    } catch (error) {
        console.error('Error fetching my files:', error);
        res.status(500).json({ message: 'Failed to fetch files' });
    }
});

/* =========================================================
   GET SINGLE FILE
========================================================= */
router.get('/:id', authenticate, async (req, res) => {
    try {
        const file = await File.findById(req.params.id)
            .populate('author', 'name email');

        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        res.json(file);
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).json({ message: 'Failed to fetch file' });
    }
});

/* =========================================================
   CREATE NEW FILE (Editor & Admin)
========================================================= */
router.post('/', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { name, content, folderId } = req.body;

        const file = new File({
            name,
            content,
            author: req.user._id,
            folder: folderId || null,
            status: 'approved',
            versions: [
                {
                    content,
                    updatedBy: req.user._id
                }
            ]
        });

        await file.save();
        await file.populate('author', 'name email');
        if (file.folder) {
            await file.populate('folder', 'name');
        }

        res.status(201).json(file);
    } catch (error) {
        console.error('Error creating file:', error);
        res.status(500).json({ message: 'Failed to create file' });
    }
});

/* =========================================================
   UPDATE FILE DIRECTLY (Admin Only)
========================================================= */
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { content } = req.body;

        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        file.versions.push({
            content: file.content,
            updatedBy: req.user._id
        });

        file.content = content;
        await file.save();
        await file.populate('author', 'name email');

        res.json(file);
    } catch (error) {
        console.error('Error updating file:', error);
        res.status(500).json({ message: 'Failed to update file' });
    }
});

/* =========================================================
   SAVE / UPDATE OWN FILE (Editor & Admin)
========================================================= */
router.put('/:id/save', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { content, name } = req.body;

        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        if (file.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only save your own files' });
        }

        file.versions.push({
            content: file.content,
            updatedBy: req.user._id
        });

        file.content = content;
        if (name) file.name = name;

        await file.save();
        await file.populate('author', 'name email');

        res.json(file);
    } catch (error) {
        console.error('Error saving file:', error);
        res.status(500).json({ message: 'Failed to save file' });
    }
});

/* =========================================================
   TOGGLE PUBLISH STATUS (Admin Only)
========================================================= */
router.patch('/:id/publish', authenticate, authorize('admin'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        file.published = !file.published;
        await file.save();
        await file.populate('author', 'name email');

        res.json({
            message: `File ${file.published ? 'published' : 'unpublished'} successfully`,
            file
        });
    } catch (error) {
        console.error('Error toggling publish status:', error);
        res.status(500).json({ message: 'Failed to update publish status' });
    }
});

/* =========================================================
   SET PUBLISH STATUS (Admin Only)
========================================================= */
router.put('/:id/publish', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { published } = req.body;

        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        file.published = published;
        await file.save();
        await file.populate('author', 'name email');

        res.json({
            message: `File ${file.published ? 'published' : 'unpublished'} successfully`,
            file
        });
    } catch (error) {
        console.error('Error setting publish status:', error);
        res.status(500).json({ message: 'Failed to update publish status' });
    }
});

/* =========================================================
   BULK PUBLISH/UNPUBLISH FILES IN FOLDER (Admin Only)
   Sets publish status for all files in a folder (and subfolders)
========================================================= */
router.post('/admin/bulk-publish', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { folderId, published } = req.body;

        // Get all folder IDs including subfolders
        const Folder = (await import('../models/Folder.js')).default;

        const getAllFolderIds = async (parentId) => {
            const ids = [parentId];
            const subfolders = await Folder.find({ parent: parentId });
            for (const sub of subfolders) {
                const subIds = await getAllFolderIds(sub._id);
                ids.push(...subIds);
            }
            return ids;
        };

        let query = {};
        if (folderId) {
            const folderIds = await getAllFolderIds(folderId);
            query = { folder: { $in: folderIds } };
        } else {
            // Root level - files with no folder
            query = { folder: null };
        }

        const result = await File.updateMany(query, { published });

        res.json({
            message: `${result.modifiedCount} files ${published ? 'published' : 'unpublished'} successfully`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Error bulk updating publish status:', error);
        res.status(500).json({ message: 'Failed to bulk update publish status' });
    }
});

/* =========================================================
   DELETE FILE
   Admin: delete any
   Editor: delete any
========================================================= */
router.delete('/:id', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        await Promise.all([
            Edit.deleteMany({ file: req.params.id }),
            Notification.deleteMany({ fileId: req.params.id })
        ]);

        await File.findByIdAndDelete(req.params.id);

        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ message: 'Failed to delete file' });
    }
});

export default router;
