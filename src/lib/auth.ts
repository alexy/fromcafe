/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'

// Force base URL for consistent OAuth redirects (prioritizes actual deployment URL)
const getBaseUrl = () => {
  // For Vercel deployments, always use the actual VERCEL_URL (preview or production)
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    const vercelUrl = `https://${process.env.VERCEL_URL}`
    console.log('Using VERCEL_URL:', vercelUrl)
    return vercelUrl
  }
  
  // Use NEXTAUTH_URL if explicitly set and not on Vercel
  if (process.env.NEXTAUTH_URL) {
    console.log('Using explicit NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
    return process.env.NEXTAUTH_URL
  }
  
  // Local development fallback
  return 'http://localhost:3000'
}

// Let NextAuth handle URL detection automatically on Vercel
// Don't override NEXTAUTH_URL - let Vercel's automatic detection work

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  debug: process.env.NODE_ENV === 'development',
  // Explicitly set base URL to prevent auto-detection issues
  ...(process.env.VERCEL && {
    trustHost: true,
    useSecureCookies: true,
  }),
  callbacks: {
    session: async ({ session, token }: { session: any; token: any }) => {
      if (session?.user) {
        session.user.id = token.sub!
      }
      return session
    },
    jwt: async ({ user, token }: { user: any; token: any }) => {
      if (user) {
        token.uid = user.id
      }
      return token
    },
    redirect: async ({ url, baseUrl }: { url: string; baseUrl: string }) => {
      console.log('NextAuth redirect:', { 
        url, 
        baseUrl,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_ENV: process.env.VERCEL_ENV 
      })
      
      // For relative URLs, use the baseUrl
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`
      }
      
      // For absolute URLs that match our domain, allow them
      if (url.startsWith(baseUrl)) {
        return url
      }
      
      // Default to dashboard for any other case
      return `${baseUrl}/dashboard`
    },
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days (in seconds)
  },
  cookies: {
    sessionToken: {
      name: `${process.env.VERCEL ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.VERCEL ? 'none' : 'lax', // 'none' for cross-site OAuth on Vercel
        path: '/',
        secure: !!process.env.VERCEL,
      },
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}

export default NextAuth(authOptions)