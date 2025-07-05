import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

/**
 * Parse Ghost token and look up associated blog/user
 */
async function parseGhostToken(authHeader: string): Promise<{ blogId: string; userId: string } | null> {
  try {
    if (!authHeader.startsWith('Ghost ')) {
      return null
    }

    const token = authHeader.substring(6) // Remove 'Ghost ' prefix
    
    console.log('DEBUG: Received token length:', token.length)
    
    // Check if it's a JWT token (starts with eyJ)
    if (token.startsWith('eyJ')) {
      try {
        // Decode JWT without verification to get the kid (key ID)
        const decoded = jwt.decode(token, { complete: true }) as { header: { kid: string; alg: string } } | null
        
        if (!decoded || !decoded.header || !decoded.header.kid) {
          console.log('Invalid JWT: missing kid in header')
          return null
        }
        
        const kid = decoded.header.kid
        console.log('DEBUG: JWT kid (Admin API key ID):', kid)
        console.log('DEBUG: JWT algorithm:', decoded.header.alg)
        
        // Find the Admin API key by matching the ID part (before colon)
        const allTokens = await prisma.ghostToken.findMany({
          select: {
            token: true,
            blogId: true,
            userId: true,
            expiresAt: true
          }
        })

        let matchingToken = null
        for (const tokenRecord of allTokens) {
          const [tokenId] = tokenRecord.token.split(':')
          if (tokenId === kid) {
            matchingToken = tokenRecord
            break
          }
        }

        if (!matchingToken) {
          console.log('Admin API key not found in database for ID:', kid)
          console.log('Available token IDs in database:', allTokens.map(t => t.token.split(':')[0]))
          return null
        }
        
        console.log('DEBUG: Found matching token in database')

        // Check if token has expired
        if (matchingToken.expiresAt < new Date()) {
          console.log('Admin API key expired')
          await prisma.ghostToken.delete({
            where: { token: matchingToken.token }
          })
          return null
        }

        // Extract the secret part and decode from hex
        const secret = matchingToken.token.split(':')[1]
        console.log('DEBUG: Secret length:', secret.length, 'chars')
        console.log('DEBUG: Secret preview:', secret.substring(0, 10) + '...')
        const secretBuffer = Buffer.from(secret, 'hex')
        console.log('DEBUG: Secret buffer length:', secretBuffer.length, 'bytes')

        // Verify JWT with the decoded secret
        try {
          jwt.verify(token, secretBuffer, { algorithms: ['HS256'] })
          console.log('JWT verified successfully with Admin API key')
          return {
            blogId: matchingToken.blogId,
            userId: matchingToken.userId
          }
        } catch (jwtError) {
          console.log('JWT verification failed:', jwtError)
          return null
        }
        
      } catch (error) {
        console.log('Error parsing JWT:', error)
        return null
      }
    }
    
    // Check if it's a direct Admin API key (id:secret format)
    if (/^[a-f0-9]{24}:[a-f0-9]{64}$/.test(token)) {
      const ghostToken = await prisma.ghostToken.findUnique({
        where: { token },
        select: {
          blogId: true,
          userId: true,
          expiresAt: true
        }
      })

      if (!ghostToken) {
        return null
      }

      if (ghostToken.expiresAt < new Date()) {
        await prisma.ghostToken.delete({
          where: { token }
        })
        return null
      }

      return {
        blogId: ghostToken.blogId,
        userId: ghostToken.userId
      }
    }
    
    console.log('Invalid token format:', token.length, 'chars')
    return null
  } catch (error) {
    console.error('Error parsing Ghost token:', error)
    return null
  }
}

/**
 * Find blog by domain, subdomain, or slug
 */
async function findBlogByIdentifier(
  domain?: string, 
  subdomain?: string, 
  blogSlug?: string
): Promise<{ id: string; userId: string; user: { slug: string | null } } | null> {
  try {
    let whereClause: { customDomain?: string; subdomain?: string; slug?: string } = {}
    
    if (domain) {
      whereClause = { customDomain: domain }
    } else if (subdomain) {
      whereClause = { subdomain: subdomain }
    } else if (blogSlug) {
      whereClause = { slug: blogSlug }
    } else {
      return null
    }

    const blog = await prisma.blog.findFirst({
      where: whereClause,
      select: {
        id: true,
        userId: true,
        user: {
          select: {
            slug: true
          }
        }
      }
    })

    return blog
  } catch (error) {
    console.error('Error finding blog by identifier:', error)
    return null
  }
}

/**
 * GET /ghost/api/v4/admin/users/me - Get current user information (Ghost Admin API compatible)
 */
export async function GET(request: NextRequest) {
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain')
    const blogSlug = searchParams.get('blogSlug')

    // Find the blog by URL structure
    const blog = await findBlogByIdentifier(domain || undefined, subdomain || undefined, blogSlug || undefined)
    if (!blog) {
      return NextResponse.json(
        { errors: [{ message: 'Blog not found for this URL' }] },
        { status: 404 }
      )
    }

    // Parse authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { errors: [{ message: 'Authorization header is required' }] },
        { status: 401 }
      )
    }

    const tokenData = await parseGhostToken(authHeader)
    if (!tokenData) {
      return NextResponse.json(
        { errors: [{ message: 'Invalid authorization token' }] },
        { status: 401 }
      )
    }

    // Verify token is valid for this specific blog
    if (tokenData.blogId !== blog.id) {
      return NextResponse.json(
        { errors: [{ message: 'Authorization token not valid for this blog' }] },
        { status: 403 }
      )
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        slug: true
      }
    })

    if (!user) {
      return NextResponse.json(
        { errors: [{ message: 'User not found' }] },
        { status: 404 }
      )
    }

    // Return Ghost-compatible user information
    return NextResponse.json({
      users: [{
        id: user.id,
        name: user.displayName || user.email || 'User',
        slug: user.slug || 'user',
        email: user.email,
        profile_image: null,
        cover_image: null,
        bio: null,
        website: null,
        location: null,
        facebook: null,
        twitter: null,
        accessibility: null,
        status: 'active',
        meta_title: null,
        meta_description: null,
        tour: null,
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        roles: [{
          id: 'owner',
          name: 'Owner',
          description: 'Blog owner',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]
      }]
    })

  } catch (error) {
    console.error('Error getting Ghost user info:', error)
    return NextResponse.json(
      { errors: [{ message: 'Internal server error' }] },
      { status: 500 }
    )
  }
}