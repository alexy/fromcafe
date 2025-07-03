#!/bin/bash

echo "🔄 Switching to themes branch database..."

# Check if .env.themes.template exists
if [ ! -f .env.themes.template ]; then
    echo "❌ .env.themes.template not found!"
    echo "Please create .env.themes.template based on .env.template"
    exit 1
fi

# Backup current .env if it exists
if [ -f .env ]; then
    cp .env .env.main.backup
    echo "✅ Backed up main .env to .env.main.backup"
fi

# Check if user has created .env.themes
if [ ! -f .env.themes ]; then
    echo "❌ .env.themes not found!"
    echo "Please copy .env.themes.template to .env.themes and fill in your values"
    echo "Make sure to use a different database name for themes development"
    exit 1
fi

# Use themes environment
cp .env.themes .env
echo "✅ Switched to themes database configuration"

# Reset and setup themes database
echo "🗄️ Setting up themes database..."
npx prisma db push --force-reset
npx prisma generate

echo "✅ Themes database is ready!"
echo "ℹ️  You are now using a separate database for themes development"
echo "ℹ️  To switch back to main: ./scripts/switch-to-main-db.sh"