import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type ApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Record<string, string | string[]> }
) => Promise<NextResponse<T | { error: string }>>

export type AuthenticatedApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Record<string, string | string[]>; user: { id: string; role: string } }
) => Promise<NextResponse<T | { error: string }>>

export type BlogOwnerApiHandler<T = unknown> = (
  request: NextRequest,
  context: { params: Record<string, string | string[]>; user: { id: string; role: string }; blog: unknown }
) => Promise<NextResponse<T | { error: string }>>

/**
 * Middleware to require authentication
 */
export function withAuth<T = unknown>(handler: AuthenticatedApiHandler<T>): ApiHandler<T> {
  return async (request: NextRequest, context: { params: Record<string, string | string[]> }) => {
    try {
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        )
      }

      // Get user details including role
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true }
      })

      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        )
      }

      return handler(request, {
        ...context,
        user: { id: user.id, role: user.role }
      })
    } catch (error) {
      console.error('Authentication middleware error:', error)
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware to require admin role
 */
export function withAdmin<T = unknown>(handler: AuthenticatedApiHandler<T>): ApiHandler<T> {
  return withAuth<T>(async (request, context) => {
    if (context.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }
    
    return handler(request, context)
  })
}

/**
 * Middleware to verify blog ownership or admin access
 */
export function withBlogOwnership<T = unknown>(
  handler: BlogOwnerApiHandler<T>,
  blogIdParam: string = 'id'
): AuthenticatedApiHandler<T> {
  return async (request: NextRequest, context) => {
    try {
      const params = await context.params
      const blogId = params[blogIdParam]

      if (!blogId || Array.isArray(blogId)) {
        return NextResponse.json(
          { error: 'Blog ID required' },
          { status: 400 }
        )
      }

      // Find blog and verify ownership (or admin access)
      const blog = await prisma.blog.findFirst({
        where: {
          id: blogId as string,
          ...(context.user.role !== 'ADMIN' ? { userId: context.user.id } : {})
        },
        include: {
          user: {
            select: { id: true, slug: true, displayName: true }
          }
        }
      })

      if (!blog) {
        return NextResponse.json(
          { error: 'Blog not found or access denied' },
          { status: 404 }
        )
      }

      return handler(request, {
        ...context,
        blog
      })
    } catch (error) {
      console.error('Blog ownership middleware error:', error)
      return NextResponse.json(
        { error: 'Blog access verification failed' },
        { status: 500 }
      )
    }
  }
}

/**
 * Middleware for centralized error handling
 */
export function withErrorHandler<T = unknown>(handler: ApiHandler<T>): ApiHandler<T> {
  return async (request: NextRequest, context: { params: Record<string, string | string[]> }) => {
    try {
      return await handler(request, context)
    } catch (error) {
      console.error('API Error:', error)
      
      // Handle specific Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        switch (error.code) {
          case 'P2002':
            return NextResponse.json(
              { error: 'A record with these details already exists' },
              { status: 409 }
            )
          case 'P2025':
            return NextResponse.json(
              { error: 'Record not found' },
              { status: 404 }
            )
          default:
            break
        }
      }

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Combine multiple middleware functions
 */
export function composeMiddleware<T = unknown>(...middlewares: Array<(handler: ApiHandler<T>) => ApiHandler<T>>) {
  return (handler: ApiHandler<T>): ApiHandler<T> => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler)
  }
}

/**
 * Common middleware combinations
 */
export const withAuthAndErrorHandler = <T = unknown>(handler: AuthenticatedApiHandler<T>) =>
  withErrorHandler(withAuth(handler))

export const withBlogOwnershipAndErrorHandler = <T = unknown>(
  handler: BlogOwnerApiHandler<T>,
  blogIdParam?: string
) =>
  withErrorHandler(withAuth(withBlogOwnership(handler, blogIdParam)))

export const withAdminAndErrorHandler = <T = unknown>(handler: AuthenticatedApiHandler<T>) =>
  withErrorHandler(withAdmin(handler))