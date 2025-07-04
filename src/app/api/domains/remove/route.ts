import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { removeDomainFromVercel, VercelDomainError } from '@/lib/vercel-domains'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { blogId } = body

    if (!blogId) {
      return NextResponse.json({ error: 'BlogId is required' }, { status: 400 })
    }

    // Check if user owns the blog
    const blog = await prisma.blog.findFirst({
      where: {
        id: blogId,
        userId: session.user.id
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found or unauthorized' }, { status: 404 })
    }

    if (!blog.customDomain) {
      return NextResponse.json({ error: 'Blog does not have a custom domain' }, { status: 400 })
    }

    const domain = blog.customDomain

    try {
      // Remove domain from Vercel
      await removeDomainFromVercel(domain)
    } catch (vercelError) {
      if (vercelError instanceof VercelDomainError) {
        console.warn(`Vercel domain removal warning: ${vercelError.message}`)
        // Continue with database update even if Vercel removal fails
      } else {
        throw vercelError
      }
    }

    // Update blog to remove custom domain
    const updatedBlog = await prisma.blog.update({
      where: { id: blogId },
      data: {
        customDomain: null,
        urlFormat: 'path' // Revert to path-based URLs
      }
    })

    return NextResponse.json({
      success: true,
      blog: updatedBlog,
      removedDomain: domain
    })

  } catch (error) {
    console.error('Error removing custom domain:', error)
    return NextResponse.json({ error: 'Failed to remove custom domain' }, { status: 500 })
  }
}