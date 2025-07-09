import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { postId } = await request.json()
    
    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    // Get the post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, content: true, title: true }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Fix nested figures in the content
    let fixedContent = post.content

    // Pattern to match nested figures: <figure><figure>...</figure><figcaption></figcaption></figure>
    const nestedFigurePattern = /<figure>\s*<figure>\s*(.*?)\s*<\/figure>\s*<figcaption><\/figcaption>\s*<\/figure>/gs

    // Replace nested figures with single figures
    fixedContent = fixedContent.replace(nestedFigurePattern, '<figure>$1</figure>')

    // Also handle cases where the inner figure doesn't have a figcaption but outer does
    const nestedFigurePattern2 = /<figure>\s*<figure>\s*(.*?)\s*<\/figure>\s*<figcaption>(.*?)<\/figcaption>\s*<\/figure>/gs
    fixedContent = fixedContent.replace(nestedFigurePattern2, '<figure>$1<figcaption>$2</figcaption></figure>')

    // Count how many fixes were made
    const originalFigureCount = (post.content.match(/<figure>/g) || []).length
    const fixedFigureCount = (fixedContent.match(/<figure>/g) || []).length
    const figuresFixed = originalFigureCount - fixedFigureCount

    // Update the post if changes were made
    if (fixedContent !== post.content) {
      await prisma.post.update({
        where: { id: postId },
        data: { 
          content: fixedContent,
          updatedAt: new Date()
        }
      })

      return NextResponse.json({
        success: true,
        message: `Fixed ${figuresFixed} nested figures in post "${post.title}"`,
        figuresFixed,
        originalFigureCount,
        fixedFigureCount
      })
    } else {
      return NextResponse.json({
        success: true,
        message: `No nested figures found in post "${post.title}"`,
        figuresFixed: 0,
        originalFigureCount,
        fixedFigureCount
      })
    }

  } catch (error) {
    console.error('Error fixing nested figures:', error)
    return NextResponse.json(
      { error: 'Failed to fix nested figures' },
      { status: 500 }
    )
  }
}

// GET endpoint to preview what would be fixed
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    
    if (!postId) {
      return NextResponse.json({ error: 'Post ID required' }, { status: 400 })
    }

    // Get the post
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, content: true, title: true }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Check for nested figures
    const hasNestedFigures = post.content.includes('<figure>') && 
      post.content.includes('<figure><figure>')
    
    const figureCount = (post.content.match(/<figure>/g) || []).length
    
    // Extract nested figure examples
    const nestedFigureMatches = post.content.match(/<figure>\s*<figure>.*?<\/figure>\s*<figcaption>.*?<\/figcaption>\s*<\/figure>/gs) || []

    return NextResponse.json({
      postId: post.id,
      title: post.title,
      hasNestedFigures,
      figureCount,
      nestedFigureExamples: nestedFigureMatches.slice(0, 3), // Show first 3 examples
      contentLength: post.content.length
    })

  } catch (error) {
    console.error('Error checking nested figures:', error)
    return NextResponse.json(
      { error: 'Failed to check nested figures' },
      { status: 500 }
    )
  }
}