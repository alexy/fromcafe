# Themes Branch Database Setup

This themes branch uses a **separate database instance** to ensure the main branch database remains untouched and deployable to Vercel.

## 🗄️ Database Configuration

- **Main Branch**: Uses your production database
- **Themes Branch**: Uses separate themes development database  
- **Isolation**: Complete separation - no impact on main branch data

## 🚨 **SECURITY: Environment Setup**

**IMPORTANT: Never commit `.env` files to git!**

### First Time Setup:

1. **Create your environment files:**
   ```bash
   # Copy templates and fill in your actual values
   cp .env.template .env                    # For main branch
   cp .env.themes.template .env.themes      # For themes branch
   ```

2. **Edit both files with your actual OAuth secrets:**
   - Google OAuth credentials
   - Evernote OAuth credentials
   - NextAuth secret
   - **Use different database names/URLs for themes branch**

## 🔄 Switching Between Branches

### To Main Branch (for Vercel deployment):
```bash
git checkout main
cp .env.template .env    # Copy template
# Edit .env with your main branch database config
npx prisma generate
```

### To Themes Branch (for theme development):
```bash
git checkout themes
./scripts/switch-to-themes-db.sh  # Handles database switching
```

## 📁 Important Files

- `.env.template` - Template for main branch environment
- `.env.themes.template` - Template for themes branch environment
- `.env` - Your actual environment (NEVER commit this!)
- `.env.themes` - Your themes environment (NEVER commit this!)
- `scripts/switch-to-main-db.sh` - Script to switch to main database
- `scripts/switch-to-themes-db.sh` - Script to switch to themes database

## ⚠️ Security Notes

1. **Never commit `.env` files to git** - they contain OAuth secrets
2. **Always use different database instances** for main vs themes
3. **Keep your OAuth credentials secure**
4. **The `.env.*` files are git-ignored for security**

## 🚀 Theme System Features

- 4 beautiful themes: Classic, Minimal, Modern, Vintage Newspaper
- Theme selection in blog settings UI
- Dynamic theme switching without rebuild
- Mobile responsive designs
- Type-safe theme components

## 🛠️ Development Workflow

1. Work on themes branch with separate database
2. Test theme functionality thoroughly
3. When ready to merge:
   - Switch to main branch
   - Restore main database config
   - Merge theme code (without database changes)
   - Deploy to Vercel safely

This ensures your main branch and production database remain stable while developing themes!