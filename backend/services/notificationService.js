import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Socket.io instance will be set from server.js
let io = null;

export const setSocketIO = (socketIO) => {
    io = socketIO;
};

// Helper to emit to user room
const emitToUser = (userId, event, data) => {
    if (io) {
        io.to(`user:${userId}`).emit(event, data);
    }
};

// Create notification and emit via socket
export const createNotification = async ({
    userId,
    type,
    actorId = null,
    fileId = null,
    editId = null,
    title,
    message,
    meta = {}
}) => {
    try {
        const notification = await Notification.create({
            userId,
            type,
            actorId,
            fileId,
            editId,
            title,
            message,
            meta
        });

        // Populate actor and file for the emitted notification
        const populatedNotif = await Notification.findById(notification._id)
            .populate('actorId', 'name email')
            .populate('fileId', 'name')
            .lean();

        // Emit real-time notification
        emitToUser(userId.toString(), 'notification:new', populatedNotif);

        // Emit updated unread count
        const count = await Notification.countDocuments({ userId, isRead: false });
        emitToUser(userId.toString(), 'notification:unreadCount', { count });

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

// Notify all admins
export const notifyAdmins = async ({ type, actorId, fileId, editId, title, message, meta }) => {
    try {
        const admins = await User.find({ role: 'admin' }).select('_id');
        const notifications = await Promise.all(
            admins.map(admin =>
                createNotification({
                    userId: admin._id,
                    type,
                    actorId,
                    fileId,
                    editId,
                    title,
                    message,
                    meta
                })
            )
        );
        return notifications;
    } catch (error) {
        console.error('Error notifying admins:', error);
        return [];
    }
};

// Notify all viewers (for file published)
export const notifyViewers = async ({ type, actorId, fileId, title, message, meta }) => {
    try {
        const viewers = await User.find({ role: 'viewer' }).select('_id');
        const notifications = await Promise.all(
            viewers.map(viewer =>
                createNotification({
                    userId: viewer._id,
                    type,
                    actorId,
                    fileId,
                    title,
                    message,
                    meta
                })
            )
        );
        return notifications;
    } catch (error) {
        console.error('Error notifying viewers:', error);
        return [];
    }
};

// Get unread count for a user
export const getUnreadCount = async (userId) => {
    try {
        return await Notification.countDocuments({ userId, isRead: false });
    } catch (error) {
        console.error('Error getting unread count:', error);
        return 0;
    }
};
