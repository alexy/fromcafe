#!/bin/bash

# Usage: ./switch-branch.sh [main|themes-dev]

if [ $# -eq 0 ]; then
    echo "Usage: $0 [main|themes-dev]"
    echo "Current branch setting: $(grep '^BRANCH=' .env | cut -d'=' -f2 | tr -d '"')"
    exit 1
fi

BRANCH=$1

if [ "$BRANCH" != "main" ] && [ "$BRANCH" != "themes-dev" ]; then
    echo "Error: Branch must be 'main' or 'themes-dev'"
    exit 1
fi

echo "🔄 Switching to $BRANCH branch configuration..."

# Update BRANCH variable
sed -i '' "s/^BRANCH=.*/BRANCH=\"$BRANCH\"/" .env

if [ "$BRANCH" = "themes-dev" ]; then
    # Switch to themes database URLs
    THEMES_URL=$(grep '^THEMES_DATABASE_URL=' .env | cut -d'=' -f2-)
    sed -i '' "s|^PRISMA_DATABASE_URL=.*|PRISMA_DATABASE_URL=$THEMES_URL|" .env
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$THEMES_URL|" .env
    echo "✅ Switched to themes development database"
    echo "💡 You can now develop themes in isolation"
else
    # Switch to main database URLs  
    MAIN_URL=$(grep '^MAIN_DATABASE_URL=' .env | cut -d'=' -f2-)
    sed -i '' "s|^PRISMA_DATABASE_URL=.*|PRISMA_DATABASE_URL=$MAIN_URL|" .env
    sed -i '' "s|^DATABASE_URL=.*|DATABASE_URL=$MAIN_URL|" .env
    echo "✅ Switched to main production database"
    echo "💡 Using production data and deployed configuration"
fi

echo ""
echo "🔧 Next steps:"
echo "   1. Run: npx prisma generate"
echo "   2. Run: npm run dev"
echo ""