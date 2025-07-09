# Claude Development Notes

## Database Connection

**IMPORTANT: Remote Database Access**

To connect to the remote database, you must set up the environment properly:

```bash
# Source the environment variables
source .env.local

# Set DATABASE_URL to the remote database URL
export DATABASE_URL=$DIRECT_URL
```

This is required for all Prisma operations including:
- `npx prisma migrate deploy`
- `npx prisma migrate status`
- `npx prisma db execute`
- `npx prisma studio`

**Why this is needed:**
- The project uses a remote database (not local)
- `DIRECT_URL` contains the connection string to the remote database
- `DATABASE_URL` is what Prisma uses by default
- We need to copy `DIRECT_URL` to `DATABASE_URL` for remote operations

## Testing Commands

After setting up the database connection:

```bash
# Run tests
npm test

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run build
npm run build
```

## Common Issues

1. **Migration failures**: Always check if migrations need to be deployed with `npx prisma migrate status`
2. **Database table not found**: Make sure migrations are applied to the remote database
3. **Connection errors**: Double-check that `DATABASE_URL=$DIRECT_URL` is set correctly