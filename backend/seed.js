import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import File from './models/File.js';

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await File.deleteMany({});
        console.log('Cleared existing data');

        // Create users
        const admin = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin'
        });

        const editor = await User.create({
            name: 'Editor User',
            email: 'editor@example.com',
            password: 'password123',
            role: 'editor'
        });

        const viewer = await User.create({
            name: 'Viewer User',
            email: 'viewer@example.com',
            password: 'password123',
            role: 'viewer'
        });

        console.log('Created users:');
        console.log('  - admin@example.com (password: password123)');
        console.log('  - editor@example.com (password: password123)');
        console.log('  - viewer@example.com (password: password123)');

        // Create sample files
        await File.create({
            name: 'README.md',
            content: `# Welcome to MD Collab Platform

This is a **collaborative markdown editing platform** designed for teams.

## Features

- **Role-based Access Control**: Admin, Editor, and Viewer roles
- **Real-time Markdown Preview**: See your changes instantly
- **GitHub-style Diff Viewer**: View what's been added or removed
- **Approval Workflow**: Editors submit changes for admin approval

## Getting Started

1. Login with your credentials
2. Navigate to your dashboard based on your role
3. Start collaborating!

## Quick Links

- [View Files](/viewer) - Browse all approved markdown files
- [Editor Dashboard](/editor) - Create and edit files
- [Admin Panel](/admin) - Review and approve changes

---

*Built with React, Node.js, and MongoDB*`,
            author: admin._id,
            status: 'approved'
        });

        await File.create({
            name: 'CONTRIBUTING.md',
            content: `# Contributing Guidelines

We welcome contributions from the community!

## How to Contribute

1. **Fork the repository** - Create your own copy
2. **Create a feature branch** - \`git checkout -b feature/amazing-feature\`
3. **Make your changes** - Edit the markdown files
4. **Submit for review** - Send your changes for admin approval

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow

## Questions?

Feel free to reach out to the admin team if you have any questions.`,
            author: admin._id,
            status: 'approved'
        });

        await File.create({
            name: 'API.md',
            content: `# API Documentation

## Authentication

All API endpoints require authentication using JWT tokens.

### Login
\`\`\`
POST /api/auth/login
Body: { email, password }
\`\`\`

### Register
\`\`\`
POST /api/auth/register
Body: { name, email, password, role }
\`\`\`

## Files

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/files | GET | Get all approved files |
| /api/files/:id | GET | Get single file |
| /api/files | POST | Create new file |

## Edits

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/edits/my | GET | Get my edit submissions |
| /api/edits/pending | GET | Get pending edits (admin) |
| /api/edits/:id/approve | POST | Approve an edit |
| /api/edits/:id/reject | POST | Reject an edit |`,
            author: admin._id,
            status: 'approved'
        });

        console.log('Created sample files');
        console.log('\n✅ Seed completed successfully!');

        process.exit(0);
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedData();
