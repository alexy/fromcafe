import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getDomainConfig } from '@/lib/vercel-domains'

interface DomainStatusParams {
  params: Promise<{ domain: string }>
}

export async function GET(request: NextRequest, { params }: DomainStatusParams) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { domain } = await params

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 })
    }

    // Check if user owns a blog with this domain
    const blog = await prisma.blog.findFirst({
      where: {
        customDomain: domain,
        userId: session.user.id
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Domain not found or unauthorized' }, { status: 404 })
    }

    // Get domain configuration and status from Vercel
    const domainConfig = await getDomainConfig(domain)

    return NextResponse.json({
      success: true,
      domain: domain,
      blog: {
        id: blog.id,
        title: blog.title,
        slug: blog.slug
      },
      ...domainConfig
    })

  } catch (error) {
    console.error('Error getting domain status:', error)
    return NextResponse.json({ error: 'Failed to get domain status' }, { status: 500 })
  }
}