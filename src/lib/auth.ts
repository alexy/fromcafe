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

// Ensure NEXTAUTH_URL is set for NextAuth's internal URL detection
if (process.env.VERCEL && !process.env.NEXTAUTH_URL) {
  const computedUrl = getBaseUrl()
  console.log('Setting NEXTAUTH_URL to computed value:', computedUrl)
  process.env.NEXTAUTH_URL = computedUrl
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
      // Always use our explicit base URL to prevent random redirects
      const forcedBaseUrl = getBaseUrl()
      
      console.log('NextAuth redirect:', { 
        url, 
        originalBaseUrl: baseUrl, 
        forcedBaseUrl,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        VERCEL_ENV: process.env.VERCEL_ENV 
      })
      
      if (url.startsWith('/')) {
        return `${forcedBaseUrl}${url}`
      }
      
      // If the URL starts with the original baseUrl, replace it with our forced one
      if (url.startsWith(baseUrl)) {
        return url.replace(baseUrl, forcedBaseUrl)
      }
      
      // If it's already using our forced base URL, keep it
      if (url.startsWith(forcedBaseUrl)) {
        return url
      }
      
      // Default to forced base URL
      return forcedBaseUrl
    },
  },
  session: {
    strategy: 'jwt' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days (in seconds)
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}

export default NextAuth(authOptions)