/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'


// Function to get the correct base URL
function getBaseUrl() {
  // In production, always use the custom domain
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXTAUTH_URL || 'https://from.cafe'
  }
  
  // In development, use localhost
  return process.env.NEXTAUTH_URL || 'http://localhost:3000'
}

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
  url: getBaseUrl(),
  ...(process.env.VERCEL && {
    trustHost: true,
    useSecureCookies: true,
  }),
  callbacks: {
    session: async ({ session, token }: { session: any; token: any }) => {
      if (session?.user) {
        session.user.id = token.sub!
        session.user.role = token.role || 'USER'
        session.user.isActive = token.isActive !== false
      }
      return session
    },
    jwt: async ({ user, token, trigger }: { user: any; token: any; trigger?: string }) => {
      if (user) {
        token.uid = user.id
        // Store initial role when user logs in
        token.role = user.role || 'USER'
        token.isActive = user.isActive !== false
      }
      
      // Refresh user data when token is updated (e.g., after role change)
      if (trigger === 'update' && token.sub) {
        try {
          const updatedUser = await prisma.user.findUnique({
            where: { id: token.sub },
            select: { role: true, isActive: true }
          })
          if (updatedUser) {
            token.role = updatedUser.role
            token.isActive = updatedUser.isActive
          }
        } catch (error) {
          console.error('Error updating token with latest user data:', error)
        }
      }
      
      return token
    },
    redirect: async ({ url, baseUrl }: { url: string; baseUrl: string }) => {
      // Use our custom base URL instead of auto-detected one
      const customBaseUrl = getBaseUrl()
      console.log('🔍 NextAuth redirect called:', { url, baseUrl, customBaseUrl })
      
      // For relative URLs, use the custom baseUrl
      if (url.startsWith('/')) {
        return `${customBaseUrl}${url}`
      }
      
      // For absolute URLs that match our custom domain, allow them
      if (url.startsWith(customBaseUrl)) {
        return url
      }
      
      // If the URL contains admin, redirect to custom domain
      if (url.includes('/admin')) {
        return `${customBaseUrl}/admin`
      }
      
      // Don't redirect to dashboard if we're already on dashboard
      if (url === `${customBaseUrl}/dashboard` || url.endsWith('/dashboard')) {
        return `${customBaseUrl}/dashboard`
      }
      
      // For sign-in success without specific destination, go to dashboard
      return `${customBaseUrl}/dashboard`
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