import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    folder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null // null means root level
    },
    status: {
        type: String,
        enum: ['draft', 'approved'],
        default: 'approved'
    },
    published: {
        type: Boolean,
        default: true // Files are published by default
    },
    // GitHub source tracking for sync feature
    githubSource: {
        owner: { type: String, default: null },
        repo: { type: String, default: null },
        path: { type: String, default: null },
        downloadUrl: { type: String, default: null },
        lastSyncedAt: { type: Date, default: null }
    },
    versions: [{
        content: String,
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

export default mongoose.model('File', fileSchema);
