# Evernote Blog

A service like Postach.io that allows blogging via Evernote. Transform your Evernote notes into beautiful, professional blogs.

## Features

- **Google OAuth Authentication**: Secure sign-in with Google accounts
- **Evernote Integration**: Connect your Evernote notebooks to your blog
- **Automatic Publishing**: Tag notes with "published" to make them live
- **Custom Domains**: Connect your own domain to your blog
- **Real-time Sync**: Automatic synchronization every 15 minutes
- **Blog Management**: User-friendly dashboard for managing blogs and posts

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js with Google OAuth
- **Deployment**: Vercel
- **Styling**: Tailwind CSS

## Setup

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Google OAuth credentials
- Evernote developer account

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd evernote-blog
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.template .env
```

Fill in the required environment variables:
- `PRISMA_DATABASE_URL`: PostgreSQL connection string  
- `DATABASE_URL`: Same as PRISMA_DATABASE_URL for compatibility
- `NEXTAUTH_SECRET`: Random secret for NextAuth.js
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `EVERNOTE_CONSUMER_KEY` & `EVERNOTE_CONSUMER_SECRET`: Evernote API credentials

4. Set up the database:
```bash
npx prisma db push
npx prisma generate
```

5. Run the development server:
```bash
npm run dev
```

## Deployment to Vercel

1. Connect your repository to Vercel
2. Set up environment variables in Vercel dashboard
3. Deploy the application

The application includes:
- Automatic database table creation
- Cron job for syncing (every 15 minutes)
- Custom domain support via middleware
- Multi-theme support for blogs

## How It Works

1. **Sign Up**: Users sign in with their Google account
2. **Connect Evernote**: Link Evernote account to access notebooks
3. **Create Blog**: Set up a blog linked to an Evernote notebook
4. **Publish Posts**: Add "published" tag to notes in Evernote
5. **Auto-Sync**: System automatically syncs notes every 15 minutes
6. **Custom Domain**: Optionally connect custom domain

## API Endpoints

- `GET /api/auth/[...nextauth]` - Authentication
- `POST /api/blogs` - Create new blog
- `GET /api/blogs` - Get user's blogs  
- `POST /api/sync` - Manual sync trigger
- `GET /api/cron/sync` - Automated sync (Vercel cron)
- `POST /api/domains` - Add custom domain

## Database Schema

- **User**: User accounts with Google OAuth
- **Blog**: User's blogs linked to Evernote notebooks
- **Post**: Individual blog posts from Evernote notes
- **Domain**: Custom domain configurations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Documentation

Additional technical documentation and guides are available in the `/HOWTO` directory:

- [Deployment Configuration](HOWTO/DEPLOYMENT.md) - Database setup and deployment guide
- [Evernote SDK Environment Issues](HOWTO/EVERNOTE_SDK_ENVIRONMENT_DISCREPANCY.md) - SDK behavior differences between environments
- [Vercel Database Setup](HOWTO/VERCEL_DATABASE_SETUP.md) - Vercel deployment database configuration
- [Theme System](HOWTO/THEMES_BRANCH_README.md) - Multi-theme support documentation
- [OAuth Architecture](HOWTO/OAUTH_ARCHITECTURE.md) - Authentication system design
- [Sync Optimization](HOWTO/SYNC_OPTIMIZATION.md) - Performance improvements for Evernote syncing
- [Rate Limiting](HOWTO/RATE_LIMITING.md) - API rate limiting implementation

## License

MIT License
