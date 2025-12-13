import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true
    },
    type: {
        type: String,
        enum: [
            'version_submitted',
            'version_approved',
            'version_rejected',
            'comment_added',
            'file_published',
            'file_updated',
            'system_announcement',
            'reminder'
        ],
        required: true
    },
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    fileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        default: null
    },
    editId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Edit',
        default: null
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    meta: {
        type: Object,
        default: {}
    },
    isRead: {
        type: Boolean,
        default: false
    },
    delivered: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Index for efficient queries
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export default mongoose.model('Notification', NotificationSchema);
