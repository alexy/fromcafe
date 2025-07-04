import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDomainToVercel, VercelDomainError } from '@/lib/vercel-domains'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { domain, blogId } = body

    console.log('Adding domain:', { domain, blogId, userId: session.user.id })

    if (!domain || !blogId) {
      return NextResponse.json({ error: 'Domain and blogId are required' }, { status: 400 })
    }

    // Validate domain format - simple but effective validation
    const domainRegex = /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/
    if (!domainRegex.test(domain) || domain.length > 253 || domain.includes('..') || domain.startsWith('-') || domain.endsWith('-')) {
      return NextResponse.json({ 
        error: 'Invalid domain format. Please enter a valid domain like example.com',
        provided: domain,
        debug: 'Domain validation failed'
      }, { status: 400 })
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

    // Check if domain is already in use by another blog
    const existingBlog = await prisma.blog.findFirst({
      where: {
        customDomain: domain,
        id: { not: blogId }
      }
    })

    if (existingBlog) {
      return NextResponse.json({ error: 'Domain is already in use by another blog' }, { status: 400 })
    }

    try {
      // Add domain to Vercel
      const vercelResponse = await addDomainToVercel(domain)
      
      // Update blog with custom domain
      const updatedBlog = await prisma.blog.update({
        where: { id: blogId },
        data: {
          customDomain: domain,
          urlFormat: 'custom'
        }
      })

      return NextResponse.json({
        success: true,
        blog: updatedBlog,
        vercel: {
          verified: vercelResponse.verified,
          verification: vercelResponse.verification
        }
      })

    } catch (vercelError) {
      if (vercelError instanceof VercelDomainError) {
        // If domain already exists in Vercel, that might be OK
        if (vercelError.code === 'domain_already_exists') {
          const updatedBlog = await prisma.blog.update({
            where: { id: blogId },
            data: {
              customDomain: domain,
              urlFormat: 'custom'
            }
          })

          return NextResponse.json({
            success: true,
            blog: updatedBlog,
            warning: 'Domain already exists in Vercel project'
          })
        }
        
        console.error('Vercel domain error:', {
          message: vercelError.message,
          code: vercelError.code,
          status: vercelError.status,
          domain,
          blogId
        })
        
        return NextResponse.json({ 
          error: `Vercel domain setup failed: ${vercelError.message}`,
          code: vercelError.code,
          debug: {
            domain,
            hasApiToken: !!process.env.VERCEL_API_TOKEN,
            hasProjectId: !!process.env.VERCEL_PROJECT_ID,
            tokenLength: process.env.VERCEL_API_TOKEN?.length || 0
          }
        }, { status: 400 })
      }
      
      throw vercelError
    }

  } catch (error) {
    console.error('Error adding custom domain:', error)
    return NextResponse.json({ error: 'Failed to add custom domain' }, { status: 500 })
  }
}