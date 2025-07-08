import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ContentSource, ContentFormat } from '@prisma/client'

export async function POST() {
  try {
    // Find the anthropology blog
    const blog = await prisma.blog.findFirst({
      where: { subdomain: 'anthropology' }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Create the test post with the exact ID Ulysses is looking for
    const post = await prisma.post.create({
      data: {
        blogId: blog.id,
        title: 'Test Ghost Post for Ulysses',
        content: '# Test Post\n\nThis is a test post created for Ulysses to update.',
        excerpt: 'This is a test post created for Ulysses to update.',
        slug: 'test-ghost-post-for-ulysses',
        isPublished: true,
        publishedAt: new Date(),
        contentSource: ContentSource.GHOST,
        contentFormat: ContentFormat.MARKDOWN,
        ghostPostId: 'test123456789012345678901234', // The exact ID Ulysses is looking for
        sourceUrl: '/api/ghost/admin/posts',
        sourceUpdatedAt: new Date()
      }
    })

    console.log('Created test Ghost post:', post.id, 'with Ghost ID:', post.ghostPostId)

    return NextResponse.json({ 
      success: true, 
      post: {
        id: post.id,
        ghostPostId: post.ghostPostId,
        title: post.title
      }
    })

  } catch (error) {
    console.error('Error creating test Ghost post:', error)
    return NextResponse.json({ error: 'Failed to create test post' }, { status: 500 })
  }
}