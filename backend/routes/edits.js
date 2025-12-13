import express from 'express';
import Edit from '../models/Edit.js';
import File from '../models/File.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { createNotification, notifyAdmins, notifyViewers } from '../services/notificationService.js';

const router = express.Router();

// Get all edits (admin only)
router.get('/all', authenticate, authorize('admin'), async (req, res) => {
    try {
        const edits = await Edit.find()
            .populate('file', 'name content')
            .populate('editor', 'name email')
            .populate('reviewedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(edits);
    } catch (error) {
        console.error('Error fetching edits:', error);
        res.status(500).json({ message: 'Failed to fetch edits' });
    }
});

// Get pending edits (admin only)
router.get('/pending', authenticate, authorize('admin'), async (req, res) => {
    try {
        const edits = await Edit.find({ status: 'pending' })
            .populate('file', 'name content')
            .populate('editor', 'name email')
            .sort({ createdAt: -1 });
        res.json(edits);
    } catch (error) {
        console.error('Error fetching pending edits:', error);
        res.status(500).json({ message: 'Failed to fetch pending edits' });
    }
});

// Get my edits (editor)
router.get('/my', authenticate, async (req, res) => {
    try {
        const edits = await Edit.find({ editor: req.user._id })
            .populate('file', 'name')
            .sort({ createdAt: -1 });
        res.json(edits);
    } catch (error) {
        console.error('Error fetching my edits:', error);
        res.status(500).json({ message: 'Failed to fetch edits' });
    }
});

// Submit edit for approval (editor)
router.post('/', authenticate, authorize('editor', 'admin'), async (req, res) => {
    try {
        const { fileId, newContent } = req.body;

        const file = await File.findById(fileId);
        if (!file) {
            return res.status(404).json({ message: 'File not found' });
        }

        // If admin, apply directly
        if (req.user.role === 'admin') {
            file.versions.push({
                content: file.content,
                updatedBy: req.user._id
            });
            file.content = newContent;
            await file.save();

            const edit = new Edit({
                file: fileId,
                editor: req.user._id,
                originalContent: file.versions[file.versions.length - 1]?.content || '',
                newContent,
                status: 'approved',
                reviewedBy: req.user._id,
                reviewedAt: new Date()
            });
            await edit.save();

            return res.status(201).json({ message: 'Changes applied directly', edit });
        }

        // For editors, create pending edit
        const edit = new Edit({
            file: fileId,
            editor: req.user._id,
            originalContent: file.content,
            newContent,
            status: 'pending'
        });

        await edit.save();
        await edit.populate('file', 'name');

        // Notify all admins about new submission
        await notifyAdmins({
            type: 'version_submitted',
            actorId: req.user._id,
            fileId: fileId,
            editId: edit._id,
            title: `New submission: ${file.name}`,
            message: `${req.user.name} submitted changes for ${file.name}`,
            meta: {
                editorName: req.user.name,
                fileName: file.name,
                editId: edit._id.toString()
            }
        });

        res.status(201).json(edit);
    } catch (error) {
        console.error('Error submitting edit:', error);
        res.status(500).json({ message: 'Failed to submit edit' });
    }
});

// Approve edit (admin only)
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
    try {
        const edit = await Edit.findById(req.params.id);
        if (!edit) {
            return res.status(404).json({ message: 'Edit not found' });
        }

        if (edit.status !== 'pending') {
            return res.status(400).json({ message: 'Edit has already been reviewed' });
        }

        // Update the file with new content
        const file = await File.findById(edit.file);
        if (file) {
            file.versions.push({
                content: file.content,
                updatedBy: req.user._id
            });
            file.content = edit.newContent;
            await file.save();
        }

        // Update edit status
        edit.status = 'approved';
        edit.reviewedBy = req.user._id;
        edit.reviewedAt = new Date();
        edit.reviewNotes = req.body.notes || '';
        await edit.save();

        // Populate for notification
        await edit.populate('editor', 'name');

        // Notify the editor that their submission was approved
        await createNotification({
            userId: edit.editor._id,
            type: 'version_approved',
            actorId: req.user._id,
            fileId: edit.file,
            editId: edit._id,
            title: `Approved: ${file.name}`,
            message: `Your submission for ${file.name} was approved by ${req.user.name}`,
            meta: {
                adminName: req.user.name,
                fileName: file.name,
                editId: edit._id.toString()
            }
        });

        // Notify viewers about published file
        await notifyViewers({
            type: 'file_published',
            actorId: edit.editor._id,
            fileId: edit.file,
            title: `File updated: ${file.name}`,
            message: `${file.name} has been updated`,
            meta: {
                fileName: file.name,
                fileId: file._id.toString()
            }
        });

        res.json({ message: 'Edit approved and applied', edit });
    } catch (error) {
        console.error('Error approving edit:', error);
        res.status(500).json({ message: 'Failed to approve edit' });
    }
});

// Reject edit (admin only)
router.post('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
    try {
        const edit = await Edit.findById(req.params.id);
        if (!edit) {
            return res.status(404).json({ message: 'Edit not found' });
        }

        if (edit.status !== 'pending') {
            return res.status(400).json({ message: 'Edit has already been reviewed' });
        }

        edit.status = 'rejected';
        edit.reviewedBy = req.user._id;
        edit.reviewedAt = new Date();
        edit.reviewNotes = req.body.notes || '';
        await edit.save();

        // Populate for notification
        await edit.populate('file', 'name');
        await edit.populate('editor', 'name');

        // Notify the editor that their submission was rejected
        await createNotification({
            userId: edit.editor._id,
            type: 'version_rejected',
            actorId: req.user._id,
            fileId: edit.file._id,
            editId: edit._id,
            title: `Changes requested: ${edit.file.name}`,
            message: edit.reviewNotes
                ? `${req.user.name} requested changes: "${edit.reviewNotes}"`
                : `${req.user.name} requested changes for ${edit.file.name}`,
            meta: {
                adminName: req.user.name,
                fileName: edit.file.name,
                editId: edit._id.toString(),
                notes: edit.reviewNotes
            }
        });

        res.json({ message: 'Edit rejected', edit });
    } catch (error) {
        console.error('Error rejecting edit:', error);
        res.status(500).json({ message: 'Failed to reject edit' });
    }
});

// Get single edit
router.get('/:id', authenticate, async (req, res) => {
    try {
        const edit = await Edit.findById(req.params.id)
            .populate('file', 'name content')
            .populate('editor', 'name email')
            .populate('reviewedBy', 'name email');

        if (!edit) {
            return res.status(404).json({ message: 'Edit not found' });
        }

        // Check permission
        if (req.user.role !== 'admin' && edit.editor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        res.json(edit);
    } catch (error) {
        console.error('Error fetching edit:', error);
        res.status(500).json({ message: 'Failed to fetch edit' });
    }
});

export default router;
