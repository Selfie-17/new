import express from 'express';
import Notification from '../models/Notification.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Get all notifications for the current user (paginated)
router.get('/', authenticate, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const query = { userId: req.user._id };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }

        const [notifications, total] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('actorId', 'name email')
                .populate('fileId', 'name')
                .lean(),
            Notification.countDocuments(query)
        ]);

        res.json({
            notifications,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// Get unread count
router.get('/unread', authenticate, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            userId: req.user._id,
            isRead: false
        });
        res.json({ count });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ message: 'Failed to get unread count' });
    }
});

// Mark notifications as read
router.post('/mark-read', authenticate, async (req, res) => {
    try {
        const { ids, all } = req.body;

        if (all === true) {
            await Notification.updateMany(
                { userId: req.user._id, isRead: false },
                { isRead: true }
            );
        } else if (ids && Array.isArray(ids)) {
            await Notification.updateMany(
                { _id: { $in: ids }, userId: req.user._id },
                { isRead: true }
            );
        } else {
            return res.status(400).json({ message: 'Provide ids array or all: true' });
        }

        const count = await Notification.countDocuments({
            userId: req.user._id,
            isRead: false
        });

        res.json({ success: true, unreadCount: count });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
});

// Mark single notification as read
router.post('/:id/read', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        const count = await Notification.countDocuments({
            userId: req.user._id,
            isRead: false
        });

        res.json({ notification, unreadCount: count });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ message: 'Failed to mark notification as read' });
    }
});

// Delete a notification
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ message: 'Failed to delete notification' });
    }
});

// Clear all notifications for user
router.delete('/', authenticate, async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user._id });
        res.json({ message: 'All notifications cleared' });
    } catch (error) {
        console.error('Error clearing notifications:', error);
        res.status(500).json({ message: 'Failed to clear notifications' });
    }
});

export default router;
