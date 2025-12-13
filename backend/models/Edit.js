import mongoose from 'mongoose';

const editSchema = new mongoose.Schema({
    file: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'File',
        required: true
    },
    editor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    originalContent: {
        type: String,
        required: true
    },
    newContent: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: {
        type: Date
    },
    reviewNotes: {
        type: String
    }
}, {
    timestamps: true
});

export default mongoose.model('Edit', editSchema);
