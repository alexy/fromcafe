# Deployment Configuration

## Database Setup

Your deployment environment is configured to use Prisma Data Platform for connection pooling. You need to set two environment variables:

### Environment Variables Required:

1. **DATABASE_URL** - The Prisma connection pool URL:
   ```
   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_API_KEY"
   ```

2. **DIRECT_URL** - The direct PostgreSQL connection for migrations:
   ```
   DIRECT_URL="postgresql://username:password@host:port/database"
   ```

### For Local Development:

If you want to use a standard PostgreSQL connection locally, you can set:
```
DATABASE_URL="postgresql://username:password@localhost:5432/evernote_blog"
DIRECT_URL="postgresql://username:password@localhost:5432/evernote_blog"
```

### Troubleshooting:

If you get the error "the URL must start with the protocol `prisma://`", it means:
- Your `DATABASE_URL` is set to use Prisma Data Platform
- You need to provide a `DIRECT_URL` for direct database operations
- Or you need to change `DATABASE_URL` to a standard PostgreSQL URL

## Alternative: Use Standard PostgreSQL

If you prefer not to use Prisma Data Platform, set your environment to use a standard PostgreSQL URL:

```env
DATABASE_URL="postgresql://username:password@host:port/database"
```

And remove the `directUrl` line from `prisma/schema.prisma`.