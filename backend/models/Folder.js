import mongoose from 'mongoose';

const folderSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Folder',
        default: null // null means root folder
    },
    // GitHub source tracking for imported folders
    githubSource: {
        owner: { type: String, default: null },
        repo: { type: String, default: null },
        path: { type: String, default: null }
    }
}, {
    timestamps: true
});

// Index for efficient queries
folderSchema.index({ author: 1, parent: 1 });

export default mongoose.model('Folder', folderSchema);
