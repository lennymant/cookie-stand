#!/bin/bash

echo "📦 Pulling latest from GitHub..."
git pull origin main

echo "📂 Setting file permissions..."
chmod -R 755 .

echo "🚀 Restarting server..."
pm2 restart app.js  # or whatever process manager you use

echo "✅ Deploy complete!"
