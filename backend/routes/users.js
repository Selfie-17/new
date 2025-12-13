import express from 'express';
import User from '../models/User.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res) => {
    try {
        const users = await User.find().select('-password').sort({ createdAt: -1 });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

// Get user by ID (admin only)
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Failed to fetch user' });
    }
});

// Update user role (admin only)
router.put('/:id/role', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { role } = req.body;

        if (!['viewer', 'editor', 'admin'].includes(role)) {
            return res.status(400).json({ message: 'Invalid role' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            { role },
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ message: 'Failed to update user role' });
    }
});

// Update user details (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        const { name, email, role } = req.body;

        // Check if email is already taken by another user
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: req.params.id } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email already in use' });
            }
        }

        const updateData = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email;
        if (role && ['viewer', 'editor', 'admin'].includes(role)) updateData.role = role;

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: 'Failed to update user' });
    }
});

// Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
    try {
        // Prevent self-deletion
        if (req.params.id === req.user._id.toString()) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }

        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

export default router;
