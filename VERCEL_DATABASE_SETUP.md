# Vercel Database Setup Fix

## Problem

Vercel deployment was failing with:
```
The table `public.accounts` does not exist in the current database.
```

**Root Cause:** The Vercel Prisma integration creates an empty database but doesn't run migrations to create the required tables.

## Solution

### 1. Updated Build Process

**Before:**
```json
"build": "prisma generate --no-engine && next build"
```

**After:**
```json
"build": "prisma generate --no-engine && prisma db push && next build"
```

The build process now:
1. Generates Prisma client (without engine for production)
2. **Pushes database schema to create tables**
3. Builds the Next.js application

### 2. Added Database Scripts

```json
{
  "db:setup": "prisma db push",
  "db:reset": "prisma db push --force-reset"
}
```

These can be used for manual database operations if needed.

### 3. Added Required Environment Variables

**Local `.env`:**
```env
# Main database connection
DATABASE_URL="prisma+postgres://localhost:51213/..."

# Direct connection for migrations
DIRECT_URL="postgresql://postgres:postgres@localhost:51214/template1?sslmode=disable"
```

**Vercel Environment:**
- `DATABASE_URL` - Provided by Prisma integration
- `DIRECT_URL` - Provided by Prisma integration  
- `POSTGRES_URL` - Also provided (alternative format)

## What Happens on Deployment

### Vercel Build Process:
1. **Install dependencies** - `npm install`
2. **Generate Prisma client** - `prisma generate --no-engine`
3. **🆕 Create database tables** - `prisma db push`
4. **Build Next.js app** - `next build`

### Database Tables Created:
- `users` - User accounts and Evernote tokens
- `accounts` - NextAuth account linking
- `sessions` - User sessions
- `verification_tokens` - Email verification
- `blogs` - Blog configurations
- `posts` - Blog posts synced from Evernote
- `domains` - Custom domain mappings

## Verification

✅ **Local build**: `npm run build` - Creates tables and builds successfully  
✅ **Database schema**: All required tables will be created automatically  
✅ **Vercel deployment**: Should now complete successfully with working database  

## Manual Database Operations

If needed, you can manually set up the database:

```bash
# Set up database (safe, won't delete data)
npm run db:setup

# Reset database (⚠️ DESTRUCTIVE - deletes all data)
npm run db:reset
```

## Result

The Vercel deployment will now automatically create all required database tables during the build process, resolving the "table does not exist" error while maintaining full compatibility with local development.