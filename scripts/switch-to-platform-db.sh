#!/bin/bash

echo "🔄 Switching to platform branch database..."

# Check if .env.platform.template exists
if [ ! -f .env.platform.template ]; then
    echo "❌ .env.platform.template not found!"
    echo "Please create .env.platform.template based on .env.template"
    exit 1
fi

# Backup current .env if it exists
if [ -f .env ]; then
    cp .env .env.main.backup
    echo "✅ Backed up main .env to .env.main.backup"
fi

# Check if user has created .env.platform
if [ ! -f .env.platform ]; then
    echo "❌ .env.platform not found!"
    echo "Please copy .env.platform.template to .env.platform and fill in your values"
    echo "Make sure to use a different database name for platform development"
    exit 1
fi

# Use platform environment
cp .env.platform .env
echo "✅ Switched to platform database configuration"

# Reset and setup platform database
echo "🗄️ Setting up platform database..."
npx prisma db push --force-reset
npx prisma generate

echo "✅ Platform database is ready!"
echo "ℹ️  You are now using a separate database for platform development"
echo "ℹ️  To switch back to main: ./scripts/switch-to-main-db.sh"