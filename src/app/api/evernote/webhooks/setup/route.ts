import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'

export async function POST() {
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user's Evernote credentials
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        evernoteToken: true,
        evernoteNoteStoreUrl: true,
        blogs: {
          select: {
            id: true,
            title: true,
            evernoteNotebook: true,
            evernoteWebhookId: true
          },
          where: {
            evernoteNotebook: { not: null },
            evernoteWebhookId: null // Only blogs that don't have webhooks yet
          }
        }
      },
    })

    if (!user?.evernoteToken) {
      return NextResponse.json({ error: 'Evernote not connected' }, { status: 400 })
    }

    if (user.blogs.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No blogs need webhook setup',
        registered: 0
      })
    }

    const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, session.user.id)
    let registered = 0
    let failed = 0

    for (const blog of user.blogs) {
      try {
        console.log(`Setting up webhook for blog "${blog.title}" with notebook ${blog.evernoteNotebook}`)
        
        const webhookId = await evernoteService.registerWebhook(blog.evernoteNotebook!)
        
        if (webhookId) {
          await prisma.blog.update({
            where: { id: blog.id },
            data: { evernoteWebhookId: webhookId }
          })
          
          registered++
          console.log(`Webhook registered for blog "${blog.title}": ${webhookId}`)
        } else {
          failed++
          console.error(`Failed to register webhook for blog "${blog.title}"`)
        }
      } catch (error) {
        failed++
        console.error(`Error setting up webhook for blog "${blog.title}":`, error)
      }
    }

    return NextResponse.json({ 
      success: true,
      message: `Webhook setup completed: ${registered} registered, ${failed} failed`,
      registered,
      failed
    })

  } catch (error) {
    console.error('Error setting up webhooks:', error)
    return NextResponse.json({ 
      error: 'Failed to setup webhooks' 
    }, { status: 500 })
  }
}