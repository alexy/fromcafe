/* eslint-disable @typescript-eslint/no-explicit-any */
import NextAuth from 'next-auth'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  debug: process.env.NODE_ENV === 'development',
  // Force consistent URL for Vercel deployments to prevent redirect URI mismatches
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
      // Force redirect to production URL on Vercel to prevent OAuth mismatch
      if (process.env.VERCEL && process.env.VERCEL_ENV === 'production') {
        const productionUrl = 'https://fromcafe.vercel.app'
        if (url.startsWith('/')) {
          return `${productionUrl}${url}`
        }
        if (url.startsWith(baseUrl)) {
          return url.replace(baseUrl, productionUrl)
        }
        return productionUrl
      }
      // Default behavior for local development
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  session: {
    strategy: 'jwt' as const,
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}

export default NextAuth(authOptions)