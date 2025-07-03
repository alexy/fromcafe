#!/bin/bash

echo "🎨 Setting up themes branch development environment..."

# Check if we're on themes branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "themes" ]; then
    echo "❌ Please switch to themes branch first: git checkout themes"
    exit 1
fi

# Check if .env exists (main branch env)
if [ ! -f .env ]; then
    echo "❌ No .env file found. Please set up your main branch environment first."
    echo "Copy .env.template to .env and fill in your credentials."
    exit 1
fi

echo "✅ Found main branch .env file"

# Create themes .env if it doesn't exist
if [ ! -f .env.themes ]; then
    echo "🔧 Creating .env.themes from template..."
    cp .env.themes.template .env.themes
    echo "📝 Please edit .env.themes and:"
    echo "   1. Change the database name/URL to use a separate database"
    echo "   2. Verify your OAuth credentials are correct"
    echo ""
    echo "After editing .env.themes, run this script again."
    exit 1
fi

echo "✅ Found .env.themes file"

# Switch to themes database
echo "🗄️ Switching to themes database..."
cp .env .env.main.backup
cp .env.themes .env

# Setup database
echo "📊 Setting up themes database schema..."
npx prisma db push --force-reset
npx prisma generate

echo ""
echo "🎉 Themes branch setup complete!"
echo ""
echo "✅ Using separate database for themes development"
echo "✅ Main branch database is safe and untouched"
echo "✅ You can now develop themes without affecting production"
echo ""
echo "💡 To switch back to main branch:"
echo "   git checkout main"
echo "   cp .env.main.backup .env"
echo ""
echo "🎨 Start developing themes!"