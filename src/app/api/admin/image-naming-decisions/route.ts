import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Get all image naming decisions for admin review
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const namingSource = searchParams.get('namingSource')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}
    if (postId) {
      where.postId = postId
    }
    if (namingSource) {
      where.namingSource = namingSource
    }

    // Get total count
    const total = await prisma.imageNamingDecision.count({ where })

    // Get paginated results
    const decisions = await prisma.imageNamingDecision.findMany({
      where,
      include: {
        post: {
          select: {
            id: true,
            title: true,
            slug: true,
            blog: {
              select: {
                title: true,
                slug: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    })

    return NextResponse.json({
      success: true,
      data: {
        decisions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    })

  } catch (error) {
    console.error('Error fetching image naming decisions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch image naming decisions' },
      { status: 500 }
    )
  }
}

/**
 * Update a blob filename (rename)
 */
export async function PUT(request: NextRequest) {
  try {
    // Check admin access
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { id, newFilename, newNamingSource, newDecisionReason } = body

    if (!id || !newFilename) {
      return NextResponse.json({ error: 'ID and new filename are required' }, { status: 400 })
    }

    // Get the current decision
    const decision = await prisma.imageNamingDecision.findUnique({
      where: { id }
    })

    if (!decision) {
      return NextResponse.json({ error: 'Naming decision not found' }, { status: 404 })
    }

    // TODO: Implement actual blob renaming with Vercel Blob API
    // This would involve copying the blob to the new filename and deleting the old one
    
    // For now, just update the database record
    const updatedDecision = await prisma.imageNamingDecision.update({
      where: { id },
      data: {
        blobFilename: newFilename,
        namingSource: newNamingSource || 'TITLE',
        decisionReason: newDecisionReason || `Manually renamed by admin to ${newFilename}`,
        updatedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedDecision
    })

  } catch (error) {
    console.error('Error updating image naming decision:', error)
    return NextResponse.json(
      { error: 'Failed to update image naming decision' },
      { status: 500 }
    )
  }
}