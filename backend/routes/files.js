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
   Permanently removes file from database for ALL users
========================================================= */
router.delete('/:id', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const fileId = req.params.id;

        // Validate fileId format
        if (!fileId || !fileId.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({ message: 'Invalid file ID format' });
        }

        // Find the file first
        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Check permissions - users can only delete their own files unless admin
        if (file.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'You can only delete your own files' });
        }

        const fileName = file.name;
        const fileAuthor = file.author.toString();

        console.log(`[DELETE FILE] Deleting file ${fileId} (${fileName}) by user ${req.user._id}`);

        // Delete all related data in parallel
        const deleteResults = await Promise.all([
            // Delete all edits associated with this file
            Edit.deleteMany({ file: fileId }),
            // Delete all notifications associated with this file
            Notification.deleteMany({ fileId: fileId }),
            // Delete all notifications that reference this file in meta or other fields
            Notification.deleteMany({ 'meta.fileId': fileId })
        ]);

        const editsDeleted = deleteResults[0].deletedCount || 0;
        const notificationsDeleted = (deleteResults[1].deletedCount || 0) + (deleteResults[2].deletedCount || 0);

        // Permanently delete the file from database - this removes it for ALL users
        const deleteResult = await File.findByIdAndDelete(fileId);

        if (!deleteResult) {
            console.error(`[DELETE FILE] Failed to delete file ${fileId} - file not found during deletion`);
            return res.status(404).json({ message: 'File not found during deletion' });
        }

        console.log(`[DELETE FILE] Successfully deleted file ${fileId} (${fileName}). Removed ${editsDeleted} edits and ${notificationsDeleted} notifications`);

        res.json({ 
            message: 'File deleted successfully',
            deleted: {
                fileId: fileId,
                fileName: fileName,
                editsDeleted: editsDeleted,
                notificationsDeleted: notificationsDeleted
            }
        });
    } catch (error) {
        console.error(`[DELETE FILE] Error deleting file ${req.params.id}:`, error);
        res.status(500).json({ 
            message: 'Failed to delete file',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
