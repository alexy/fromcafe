import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'

export interface GhostAuthResult {
  blogId: string
  userId: string
}

/**
 * Parse and validate Ghost authentication token (JWT or simple format)
 */
export async function parseGhostToken(authHeader: string): Promise<GhostAuthResult | null> {
  try {
    if (!authHeader.startsWith('Ghost ')) {
      return null
    }

    const token = authHeader.substring(6) // Remove 'Ghost ' prefix
    
    console.log('DEBUG: Received token length:', token.length)
    
    // Check if it's a JWT token (starts with eyJ)
    if (token.startsWith('eyJ')) {
      return await parseJWTToken(token)
    }
    
    // Fallback to simple token format validation for non-JWT tokens
    return await parseSimpleToken(token)
  } catch (error) {
    console.error('Error parsing Ghost token:', error)
    return null
  }
}

/**
 * Clean up expired tokens from the database
 */
export async function cleanupExpiredTokens(): Promise<void> {
  try {
    const deletedTokens = await prisma.ghostToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    
    if (deletedTokens.count > 0) {
      console.log(`Cleaned up ${deletedTokens.count} expired Ghost tokens`)
    }
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error)
  }
}

/**
 * Parse JWT-based Ghost token
 */
async function parseJWTToken(token: string): Promise<GhostAuthResult | null> {
  try {
    // Decode JWT without verification to get the kid (key ID)
    const decoded = jwt.decode(token, { complete: true }) as { header: { kid: string; alg: string } } | null
    
    if (!decoded || !decoded.header || !decoded.header.kid) {
      console.log('Invalid JWT: missing kid in header')
      return null
    }
    
    const kid = decoded.header.kid
    console.log('DEBUG: JWT kid (Admin API key ID):', kid)
    
    // Find the Admin API key by matching the ID part (before colon)
    const allTokens = await prisma.ghostToken.findMany({
      select: {
        token: true,
        blogId: true,
        userId: true,
        expiresAt: true
      }
    })
    
    console.log('DEBUG: Found', allTokens.length, 'tokens in database')
    
    let matchingToken = null
    
    for (const dbToken of allTokens) {
      const [tokenId] = dbToken.token.split(':')
      console.log('DEBUG: Checking token ID:', tokenId, 'against kid:', kid)
      
      if (tokenId === kid) {
        matchingToken = dbToken
        console.log('DEBUG: Found matching token for kid:', kid)
        break
      }
    }
    
    if (!matchingToken) {
      console.log('No matching Admin API key found for kid:', kid)
      return null
    }
    
    // Check if token has expired
    if (matchingToken.expiresAt < new Date()) {
      console.log('Token expired, cleaning up')
      await prisma.ghostToken.delete({
        where: { token: matchingToken.token }
      })
      return null
    }
    
    // Use the secret part (after colon) for JWT verification
    const [, secret] = matchingToken.token.split(':')
    
    console.log('DEBUG: Using secret for verification, length:', secret.length)
    
    // Verify JWT with the secret as a string (Ghost standard)
    try {
      jwt.verify(token, secret, { algorithms: ['HS256'] })
      console.log('JWT verified successfully with Admin API key')
      return {
        blogId: matchingToken.blogId,
        userId: matchingToken.userId
      }
    } catch (jwtError) {
      console.log('JWT verification failed:', jwtError)
      // Try with hex-decoded buffer as fallback
      try {
        const secretBuffer = Buffer.from(secret, 'hex')
        jwt.verify(token, secretBuffer, { algorithms: ['HS256'] })
        console.log('JWT verified successfully with hex-decoded secret')
        return {
          blogId: matchingToken.blogId,
          userId: matchingToken.userId
        }
      } catch (jwtError2) {
        console.log('JWT verification failed with hex-decoded secret:', jwtError2)
        return null
      }
    }
  } catch (error) {
    console.error('Error processing JWT:', error)
    return null
  }
}

/**
 * Parse simple format Ghost token (24-char-id:64-char-hex)
 */
async function parseSimpleToken(token: string): Promise<GhostAuthResult | null> {
  // Validate token format: 24-char-id:64-char-hex
  if (!/^[a-f0-9]{24}:[a-f0-9]{64}$/.test(token)) {
    console.log('Invalid token format:', token.length, 'chars')
    return null
  }
  
  // Look up the token in our database
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

  // Check if token has expired
  if (ghostToken.expiresAt < new Date()) {
    // Token expired, clean it up
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

/**
 * Find blog by domain, subdomain, or slug
 */
export async function findBlogByIdentifier(
  domain?: string, 
  subdomain?: string, 
  blogSlug?: string
): Promise<{ id: string; userId: string; user: { slug: string | null } } | null> {
  try {
    let whereClause: { customDomain?: string; subdomain?: string; slug?: string } = {}
    
    if (domain) {
      // Custom domain
      whereClause = { customDomain: domain }
    } else if (subdomain) {
      // Subdomain
      whereClause = { subdomain: subdomain }
    } else if (blogSlug) {
      // Path-based blog slug
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
 * Validate Ghost authentication and find associated blog
 */
export async function validateGhostAuth(
  request: Request,
  domain?: string,
  subdomain?: string, 
  blogSlug?: string
): Promise<{
  tokenData: GhostAuthResult
  blog: { id: string; userId: string; user: { slug: string | null } }
} | { error: Response }> {
  // Clean up expired tokens periodically
  await cleanupExpiredTokens()

  // Parse authentication
  const authHeader = request.headers.get('authorization')
  if (!authHeader) {
    return {
      error: new Response(
        JSON.stringify({ errors: [{ message: 'Authorization header is required' }] }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  const tokenData = await parseGhostToken(authHeader)
  if (!tokenData) {
    return {
      error: new Response(
        JSON.stringify({ errors: [{ message: 'Invalid authorization token. Please generate a new token.' }] }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Find the blog by URL structure
  const blog = await findBlogByIdentifier(domain, subdomain, blogSlug)
  if (!blog) {
    return {
      error: new Response(
        JSON.stringify({ errors: [{ message: 'Blog not found for this URL' }] }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  // Verify token is valid for this specific blog
  if (tokenData.blogId !== blog.id) {
    return {
      error: new Response(
        JSON.stringify({ errors: [{ message: 'Authorization token not valid for this blog' }] }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  return { tokenData, blog }
}

/**
 * Find blog by domain, subdomain, or slug (extended version with more details)
 */
export async function findBlogByIdentifierExtended(
  domain?: string, 
  subdomain?: string, 
  blogSlug?: string
): Promise<{ id: string; title: string; description: string | null; customDomain: string | null; subdomain: string | null; slug: string; user: { slug: string | null } } | null> {
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
        title: true,
        description: true,
        customDomain: true,
        subdomain: true,
        slug: true,
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