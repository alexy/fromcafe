import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blogSlug = searchParams.get('blog')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const showContent = searchParams.get('content') === 'true'

    // Build where clause
    const whereClause: {
      blog?: { slug: string }
    } = {}
    if (blogSlug) {
      whereClause.blog = { slug: blogSlug }
    }

    // Get posts with blog information
    const posts = await prisma.post.findMany({
      where: whereClause,
      include: {
        blog: {
          select: {
            slug: true,
            title: true,
            subdomain: true,
            customDomain: true,
            user: {
              select: {
                slug: true
              }
            }
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit
    })

    // Get total count
    const totalCount = await prisma.post.count({ where: whereClause })

    // Format response
    const formattedPosts = posts.map(post => {
      const figureCount = (post.content.match(/<figure>/g) || []).length
      const figcaptionCount = (post.content.match(/<figcaption>/g) || []).length
      const hasNestedFigures = figureCount > 0 && post.content.includes('<figure>') && 
        post.content.lastIndexOf('<figure>') > post.content.indexOf('<figure>')

      // Generate URL based on blog configuration
      let postUrl = ''
      if (post.blog.customDomain) {
        postUrl = `https://${post.blog.customDomain}/${post.slug}`
      } else if (post.blog.subdomain) {
        postUrl = `https://${post.blog.subdomain}.from.cafe/${post.slug}`
      } else {
        postUrl = `https://from.cafe/${post.blog.user.slug}/${post.blog.slug}/${post.slug}`
      }

      return {
        id: post.id,
        title: post.title,
        slug: post.slug,
        blog: {
          slug: post.blog.slug,
          title: post.blog.title,
          subdomain: post.blog.subdomain,
          customDomain: post.blog.customDomain,
          userSlug: post.blog.user.slug
        },
        url: postUrl,
        isPublished: post.isPublished,
        contentFormat: post.contentFormat,
        contentLength: post.content.length,
        figureCount,
        figcaptionCount,
        hasNestedFigures,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        publishedAt: post.publishedAt,
        ...(showContent && { 
          content: post.content,
          excerpt: post.excerpt 
        })
      }
    })

    return NextResponse.json({
      posts: formattedPosts,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    })

  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'clear-cache') {
      // Force cache invalidation by updating a post's updatedAt timestamp
      const { postId } = await request.json()
      
      if (!postId) {
        return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
      }

      await prisma.post.update({
        where: { id: postId },
        data: { updatedAt: new Date() }
      })

      return NextResponse.json({ message: 'Cache invalidated for post' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (error) {
    console.error('Error in admin post action:', error)
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    )
  }
}