import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const blog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    return NextResponse.json({ blog })
  } catch (error) {
    console.error('Error fetching blog:', error)
    return NextResponse.json({ error: 'Failed to fetch blog' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const body = await request.json()
    const { title, description, author, isPublic, evernoteNotebook, evernoteNotebookName, theme, urlFormat, subdomain, customDomain } = body
    
    // Build update object with only provided fields
    const updateData: { 
      title?: string; 
      description?: string; 
      author?: string;
      isPublic?: boolean; 
      evernoteNotebook?: string | null;
      evernoteNotebookName?: string | null;
      evernoteWebhookId?: string | null;
      theme?: string;
      urlFormat?: string;
      subdomain?: string;
      customDomain?: string;
    } = {}
    
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (author !== undefined) updateData.author = author
    if (isPublic !== undefined) updateData.isPublic = isPublic
    if (evernoteNotebook !== undefined) updateData.evernoteNotebook = evernoteNotebook
    if (evernoteNotebookName !== undefined) updateData.evernoteNotebookName = evernoteNotebookName
    if (theme !== undefined) updateData.theme = theme
    if (urlFormat !== undefined) updateData.urlFormat = urlFormat
    if (subdomain !== undefined) updateData.subdomain = subdomain
    if (customDomain !== undefined) updateData.customDomain = customDomain

    // Get the current blog to check for webhook changes
    const currentBlog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      select: {
        evernoteNotebook: true,
        evernoteWebhookId: true
      }
    })

    if (!currentBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Handle webhook registration/unregistration if notebook connection changed
    if (evernoteNotebook !== undefined && currentBlog.evernoteNotebook !== evernoteNotebook) {
      // Get user's Evernote credentials for webhook management
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { 
          evernoteToken: true,
          evernoteNoteStoreUrl: true 
        },
      })

      if (user?.evernoteToken) {
        const { EvernoteService } = await import('@/lib/evernote')
        const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, session.user.id)

        // Unregister old webhook if it exists
        if (currentBlog.evernoteWebhookId) {
          console.log(`Unregistering webhook: ${currentBlog.evernoteWebhookId}`)
          await evernoteService.unregisterWebhook(currentBlog.evernoteWebhookId)
        }

        // Register new webhook if connecting to a notebook
        if (evernoteNotebook) {
          console.log(`Registering webhook for notebook: ${evernoteNotebook}`)
          const newWebhookId = await evernoteService.registerWebhook(evernoteNotebook)
          if (newWebhookId) {
            updateData.evernoteWebhookId = newWebhookId
            console.log(`Webhook registered: ${newWebhookId}`)
          } else {
            console.warn(`Failed to register webhook for notebook: ${evernoteNotebook}`)
          }
        } else {
          updateData.evernoteWebhookId = null
        }
      }
    }

    const blog = await prisma.blog.updateMany({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      data: updateData,
    })

    if (blog.count === 0) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Fetch the updated blog
    const updatedBlog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    })

    return NextResponse.json({ blog: updatedBlog })
  } catch (error) {
    console.error('Error updating blog:', error)
    return NextResponse.json({ error: 'Failed to update blog' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    const body = await request.json()
    
    // PATCH allows partial updates - only update provided fields
    const updateData: Record<string, string | boolean | null> = {}
    
    // Allow any valid blog field to be updated
    const allowedFields = ['title', 'description', 'author', 'isPublic', 'evernoteNotebook', 'evernoteNotebookName', 'theme', 'urlFormat', 'subdomain', 'customDomain']
    
    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && (typeof value === 'string' || typeof value === 'boolean' || value === null)) {
        updateData[key] = value
      }
    }

    const blog = await prisma.blog.updateMany({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      data: updateData,
    })

    if (blog.count === 0) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: 'Blog updated successfully' })
  } catch (error) {
    console.error('Error updating blog:', error)
    return NextResponse.json({ error: 'Failed to update blog' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const resolvedParams = await params
    
    // First check if the blog exists and belongs to the user
    const blog = await prisma.blog.findFirst({
      where: { 
        id: resolvedParams.id,
        userId: session.user.id 
      },
      select: {
        evernoteWebhookId: true,
        evernoteNotebook: true
      }
    })

    if (!blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 })
    }

    // Unregister webhook if it exists
    if (blog.evernoteWebhookId) {
      try {
        // Get user's Evernote credentials
        const user = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { 
            evernoteToken: true,
            evernoteNoteStoreUrl: true 
          },
        })

        if (user?.evernoteToken) {
          const { EvernoteService } = await import('@/lib/evernote')
          const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, session.user.id)
          
          console.log(`Unregistering webhook before blog deletion: ${blog.evernoteWebhookId}`)
          await evernoteService.unregisterWebhook(blog.evernoteWebhookId)
        }
      } catch (error) {
        console.error('Error unregistering webhook during blog deletion:', error)
        // Continue with deletion even if webhook cleanup fails
      }
    }

    // Delete all posts associated with the blog first
    await prisma.post.deleteMany({
      where: { blogId: resolvedParams.id }
    })

    // Then delete the blog
    await prisma.blog.delete({
      where: { id: resolvedParams.id }
    })

    return NextResponse.json({ message: 'Blog deleted successfully' })
  } catch (error) {
    console.error('Error deleting blog:', error)
    return NextResponse.json({ error: 'Failed to delete blog' }, { status: 500 })
  }
}