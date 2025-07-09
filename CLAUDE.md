# Claude Development Notes

## Database Connection

**IMPORTANT: Vercel Production Database Access**

To connect to the Vercel production database, you must set up the environment properly:

```bash
# Source the environment variables
source .env.local

# For Vercel production database access:
PRISMA_DATABASE_URL=$PRISMA_DATABASE_URL [command]
```

Example:
```bash
source .env.local && PRISMA_DATABASE_URL=$PRISMA_DATABASE_URL node test-db.js
```

**Alternative for direct database access (bypassing Accelerate):**
```bash
# Source the environment variables
source .env.local

# Extract direct database URL from DIRECT_URL
eval $DIRECT_URL
export DATABASE_URL=$PRISMA_DATABASE_URL
```

This is required for all Prisma operations including:
- `npx prisma migrate deploy`
- `npx prisma migrate status`
- `npx prisma db execute`
- `npx prisma studio`

**Why this is needed:**
- The project uses Vercel's database with Prisma Accelerate
- `PRISMA_DATABASE_URL` contains the Accelerate connection string to the production database
- `DATABASE_URL` is what Prisma uses by default
- `DIRECT_URL` contains the raw connection string for direct access (when needed)
- For most operations, use `PRISMA_DATABASE_URL` to access the production data

## Testing Commands

After setting up the database connection:

```bash
# Run tests
npm test

# Run type checking
# npm run typecheck

# Run linting
npm run lint

# Run build
npm run build
```

## Common Issues

1. **Migration failures**: Always check if migrations need to be deployed with `npx prisma migrate status`
2. **Database table not found**: Make sure migrations are applied to the remote database
3. **Connection errors**: Double-check that `DATABASE_URL=$PRISMA_DATABASE_URL` is set correctly
4. **Evernote rate limits**: Evernote API has strict rate limits. If you hit a rate limit:
   - Wait the specified duration (usually 15-40 minutes)
   - Avoid frequent syncs during development
   - Use the debugging logs to identify excessive API calls