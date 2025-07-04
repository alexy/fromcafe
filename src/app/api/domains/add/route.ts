import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { addDomainToVercel, VercelDomainError, ensurePrimaryDomain, validateDomainConfiguration } from '@/lib/vercel-domains'

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
      // Add domain to Vercel to serve content directly
      const vercelResponse = await addDomainToVercel(domain)
      
      // Ensure primary domain remains set (but allow custom domains to serve content)
      await ensurePrimaryDomain()
      
      // Validate domain configuration
      const isConfigValid = await validateDomainConfiguration(domain)
      if (!isConfigValid) {
        console.warn(`⚠️ Domain ${domain} may not be properly configured to serve content`)
      }
      
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
          verification: vercelResponse.verification,
          configValid: isConfigValid
        }
      })

    } catch (vercelError) {
      if (vercelError instanceof VercelDomainError) {
        // If domain already exists in Vercel, that might be OK
        if (vercelError.code === 'domain_already_exists' || 
            vercelError.code === 'cannot_set_production_branch_as_preview') {
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
            warning: vercelError.code === 'cannot_set_production_branch_as_preview' 
              ? 'Domain already exists as preview domain - converted to production'
              : 'Domain already exists in Vercel project'
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