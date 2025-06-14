#!/usr/bin/env node

console.log('🔍 Build Environment Check');
console.log('========================');
console.log('Node Version:', process.version);
console.log('NPM Version:', process.env.npm_version || 'Unknown');
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Working Directory:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV || 'Not set');

const fs = require('fs');
const path = require('path');

// Check if client directory exists
const clientDir = path.join(process.cwd(), 'client');
console.log('Client Directory Exists:', fs.existsSync(clientDir));

if (fs.existsSync(clientDir)) {
    const clientPackageJson = path.join(clientDir, 'package.json');
    console.log('Client package.json Exists:', fs.existsSync(clientPackageJson));
    
    if (fs.existsSync(clientPackageJson)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(clientPackageJson, 'utf8'));
            console.log('Client App Name:', pkg.name);
            console.log('React Scripts Version:', pkg.dependencies['react-scripts']);
        } catch (error) {
            console.error('Error reading client package.json:', error.message);
        }
    }
}

console.log('========================');
console.log('✅ Environment check complete'); 