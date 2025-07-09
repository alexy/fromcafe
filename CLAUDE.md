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

## Ghost Token Management

### Token Expiration and Re-authentication

**Current Settings:**
- **Default expiration: 1 year** (changed from 24h to reduce re-authentication frequency)
- Tokens are automatically cleaned up when expired
- Available expiration options: '1h', '24h', '7d', '30d', '1y', 'never'

### What Happens When Tokens Expire

1. **Ghost API calls return 401 error** with message: "Invalid authorization token. Please generate a new token."
2. **System logs detailed expiration info** with format: `👻 Found expired Ghost token for kid: [token_id]`
3. **No automatic re-authentication** - manual intervention is required
4. **Ulysses will error out** until a new token is manually generated and configured

### Manual Re-authentication Process for Ulysses

When Ulysses starts failing with authentication errors:

1. **Identify the problem**: Look for 401 errors or authentication failures
2. **Access the admin panel**: 
   - Go to your blog's admin panel
   - Or directly visit `/api/ghost/admin/auth`
3. **Generate new token**:
   - Navigate to Ghost integration settings
   - Click "Generate New Token"
   - Copy the new token
4. **Update Ulysses**:
   - Open Ulysses
   - Go to Ghost blog settings
   - Replace the old token with the new one
   - Test the connection

### API Endpoints

- **Generate new token**: `POST /api/ghost/admin/auth`
- **Get blog info and current token**: `GET /api/ghost/admin/auth?blogId=[id]`

### Troubleshooting Token Issues

**Common Error Messages:**
- "Invalid authorization token. Please generate a new token." → Token expired
- "Authorization header is required" → Missing token
- "Authorization token not valid for this blog" → Wrong blog/token mismatch

**Debugging Steps:**
1. Check server logs for "👻 Found expired Ghost token" messages
2. Verify token format (should be 24-char-id:64-char-hex)
3. Confirm blog ID matches the token's blog ID
4. Test with a fresh token generation

### Improving the User Experience

**Current Limitations:**
- No automatic token refresh mechanism
- Users must manually update tokens in client applications
- No proactive notifications before expiration

**Potential Improvements:**
- Implement webhook-based token refresh
- Add email notifications for upcoming expirations
- Provide clearer error messages with re-authentication links
- Consider implementing refresh tokens for seamless renewal