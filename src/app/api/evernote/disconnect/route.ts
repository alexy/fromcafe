import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  console.log('Disconnect request - session check:', {
    hasSession: !!session,
    userId: session?.user?.id,
    userEmail: session?.user?.email
  })
  
  if (!session?.user?.id) {
    console.log('No session found for disconnect request')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('Starting disconnect process for user:', session.user.id)
    
    // Get user's current Evernote credentials and connected blogs before disconnecting
    console.log('Fetching user from database...')
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

    console.log('User found in database:', {
      userId: session.user.id,
      userExists: !!user,
      hasEvernoteToken: !!user?.evernoteToken,
      blogCount: user?.blogs?.length || 0
    })

    if (!user) {
      console.log('User not found in database!')
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Unregister all webhooks before disconnecting
    if (user?.evernoteToken && user.blogs.length > 0) {
      const { EvernoteService } = await import('@/lib/evernote')
      const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, session.user.id)
      
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
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { 
        evernoteToken: null,
        evernoteUserId: null,
        evernoteNoteStoreUrl: null,
        evernotePublishedTagGuid: null,  // Clear cached tag GUID
        evernoteAccountId: null          // Clear account ID cache
      },
      select: {
        id: true,
        evernoteToken: true,
        evernoteUserId: true,
        evernoteNoteStoreUrl: true
      }
    })

    console.log('Successfully disconnected Evernote for user:', session.user.id)
    console.log('Updated user state after disconnect:', {
      id: updatedUser.id,
      hasEvernoteToken: !!updatedUser.evernoteToken,
      evernoteUserId: updatedUser.evernoteUserId,
      evernoteNoteStoreUrl: updatedUser.evernoteNoteStoreUrl
    })
    
    // Double-check by reading the user again
    const verifyUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        evernoteToken: true,
        evernoteUserId: true,
        evernoteNoteStoreUrl: true
      }
    })
    
    console.log('Verification read after disconnect:', {
      hasEvernoteToken: !!verifyUser?.evernoteToken,
      evernoteUserId: verifyUser?.evernoteUserId,
      evernoteNoteStoreUrl: verifyUser?.evernoteNoteStoreUrl
    })
    
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