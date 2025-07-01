import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user's current Evernote credentials and connected blogs before disconnecting
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        evernoteToken: true,
        evernoteNoteStoreUrl: true,
        blogs: {
          select: {
            id: true,
            evernoteWebhookId: true
          },
          where: {
            evernoteWebhookId: { not: null }
          }
        }
      },
    })

    // Unregister all webhooks before disconnecting
    if (user?.evernoteToken && user.blogs.length > 0) {
      const { EvernoteService } = await import('@/lib/evernote')
      const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined)
      
      console.log(`Unregistering ${user.blogs.length} webhooks before disconnecting Evernote`)
      
      for (const blog of user.blogs) {
        if (blog.evernoteWebhookId) {
          try {
            await evernoteService.unregisterWebhook(blog.evernoteWebhookId)
            console.log(`Unregistered webhook: ${blog.evernoteWebhookId}`)
          } catch (error) {
            console.error(`Failed to unregister webhook ${blog.evernoteWebhookId}:`, error)
          }
        }
      }

      // Clear webhook IDs from all blogs
      await prisma.blog.updateMany({
        where: { 
          userId: session.user.id,
          evernoteWebhookId: { not: null }
        },
        data: { evernoteWebhookId: null }
      })
    }

    // Remove Evernote credentials from the user's account
    await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        evernoteToken: null,
        evernoteUserId: null,
        evernoteNoteStoreUrl: null
      },
    })

    console.log('Successfully disconnected Evernote for user:', session.user.id)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Successfully disconnected from Evernote' 
    })
  } catch (error) {
    console.error('Error disconnecting from Evernote:', error)
    return NextResponse.json({ 
      error: 'Failed to disconnect from Evernote' 
    }, { status: 500 })
  }
}