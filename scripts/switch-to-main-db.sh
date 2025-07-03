#!/bin/bash

echo "🔄 Switching back to main branch database..."

# Restore main .env
if [ -f .env.main.backup ]; then
    cp .env.main.backup .env
    echo "✅ Restored main database configuration"
else
    echo "❌ No main .env backup found!"
    exit 1
fi

# Regenerate client for main database
npx prisma generate

echo "✅ Back to main database!"
echo "ℹ️  You are now using the main branch database"
echo "ℹ️  Safe to deploy to Vercel or switch to main branch"
echo "ℹ️  To switch to platform: ./scripts/switch-to-platform-db.sh"