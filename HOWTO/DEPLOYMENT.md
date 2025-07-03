# Deployment Configuration

## Database Setup

The application uses Prisma with PostgreSQL for data storage. The database configuration has been simplified to use a single connection URL.

### Environment Variables Required:

1. **PRISMA_DATABASE_URL** - The primary database connection URL:
   ```
   PRISMA_DATABASE_URL="prisma+postgres://localhost:51213/?api_key=YOUR_API_KEY"
   ```

2. **DATABASE_URL** - Secondary database URL (same as PRISMA_DATABASE_URL for compatibility):
   ```
   DATABASE_URL="prisma+postgres://localhost:51213/?api_key=YOUR_API_KEY"
   ```

### Database Configuration Options:

#### Option 1: Prisma Data Platform (Recommended for Production)
```env
PRISMA_DATABASE_URL="prisma+postgres://your-host:port/?api_key=your_api_key"
DATABASE_URL="prisma+postgres://your-host:port/?api_key=your_api_key"
```

#### Option 2: Standard PostgreSQL (Local Development)
```env
PRISMA_DATABASE_URL="postgresql://username:password@localhost:5432/evernote_blog"
DATABASE_URL="postgresql://username:password@localhost:5432/evernote_blog"
```

### Branch-Specific Database Configuration

The application supports branch-specific database isolation:

- **Main Branch**: Uses main production database
- **Development Branch**: Can use separate development database

Use the provided `.env.template` file as a starting point for your environment configuration.

### Prisma Schema Configuration

The current schema uses a simplified database configuration:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("PRISMA_DATABASE_URL")
}
```

No `directUrl` configuration is needed - the application uses a single connection URL for all database operations.