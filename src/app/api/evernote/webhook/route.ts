import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'
import { SyncService } from '@/lib/sync'

// Simple ENML to HTML conversion for webhooks (without image processing)
function convertEvernoteToHtmlSimple(enmlContent: string): string {
  return enmlContent
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .replace(/<en-note[^>]*>/g, '<div>')
    .replace(/<\/en-note>/g, '</div>')
    .replace(/<en-media[^>]*\/>/g, '') // Remove media tags (images will be handled by main sync)
}

interface EvernoteWebhookPayload {
  userId: number
  guid: string
  notebookGuid?: string
  reason: 'create' | 'update' | 'delete'
}

export async function POST(request: NextRequest) {
  try {
    const payload: EvernoteWebhookPayload = await request.json()
    console.log('Received Evernote webhook:', payload)

    const { userId: evernoteUserId, guid: noteGuid, notebookGuid, reason } = payload

    // Find the user by their Evernote user ID
    const user = await prisma.user.findFirst({
      where: { evernoteUserId: evernoteUserId.toString() },
      select: { 
        id: true,
        evernoteToken: true,
        evernoteNoteStoreUrl: true,
        blogs: {
          select: {
            id: true,
            title: true,
            evernoteNotebook: true
          }
        }
      }
    })

    if (!user?.evernoteToken) {
      console.log(`User not found or no Evernote token for userId: ${evernoteUserId}`)
      return NextResponse.json({ success: true, message: 'User not found or not connected' })
    }

    // Find which blog(s) are connected to this notebook
    const relevantBlogs = notebookGuid 
      ? user.blogs.filter(blog => blog.evernoteNotebook === notebookGuid)
      : user.blogs.filter(blog => blog.evernoteNotebook) // If no notebookGuid, check all

    if (relevantBlogs.length === 0) {
      console.log(`No blogs connected to notebook: ${notebookGuid}`)
      return NextResponse.json({ success: true, message: 'No connected blogs for this notebook' })
    }

    const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, user.id)

    for (const blog of relevantBlogs) {
      await handleNoteChange(noteGuid, reason, blog.id, blog.title, evernoteService)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Processed webhook for ${relevantBlogs.length} blog(s)` 
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to process webhook' 
    }, { status: 500 })
  }
}

async function handleNoteChange(
  noteGuid: string, 
  reason: 'create' | 'update' | 'delete',
  blogId: string,
  blogTitle: string,
  evernoteService: EvernoteService
) {
  console.log(`Processing ${reason} for note ${noteGuid} in blog ${blogTitle}`)

  try {
    if (reason === 'delete') {
      // Handle note deletion - remove the post if it exists
      await handleNoteDeleted(noteGuid)
      return
    }

    // For create/update, fetch the note to check its publish status
    const note = await evernoteService.getNote(noteGuid)
    const isPublished = evernoteService.isPublished(note.tagNames)
    
    console.log(`Note "${note.title}" - Published: ${isPublished}, Tags: [${note.tagNames.join(', ')}]`)

    // Check if post already exists
    const existingPost = await prisma.post.findUnique({
      where: { evernoteNoteId: noteGuid }
    })

    if (isPublished) {
      if (existingPost) {
        // Update existing post
        await updateExistingPost(existingPost.id, note)
        console.log(`Updated post: ${note.title}`)
      } else {
        // Create new post
        await createNewPost(note, blogId)
        console.log(`Created new post: ${note.title}`)
      }
    } else {
      if (existingPost) {
        // Note lost published tag - unpublish or delete
        await unpublishPost(existingPost.id)
        console.log(`Unpublished post: ${note.title}`)
      }
      // If no existing post and not published, do nothing
    }

    // Update the blog's last sync time
    await prisma.blog.update({
      where: { id: blogId },
      data: { 
        lastSyncedAt: new Date(),
        lastSyncAttemptAt: new Date()
      }
    })

  } catch (error) {
    console.error(`Error handling note change for ${noteGuid}:`, error)
    
    // Update attempt time on error
    await prisma.blog.update({
      where: { id: blogId },
      data: { lastSyncAttemptAt: new Date() }
    }).catch(updateError => {
      console.error('Failed to update sync attempt time:', updateError)
    })
  }
}

async function handleNoteDeleted(noteGuid: string) {
  const existingPost = await prisma.post.findUnique({
    where: { evernoteNoteId: noteGuid }
  })

  if (existingPost) {
    await prisma.post.delete({
      where: { id: existingPost.id }
    })
    console.log(`Deleted post for note: ${noteGuid}`)
  }
}

async function createNewPost(note: { guid: string; title: string; content: string; created: number; updated: number }, blogId: string) {
  const slug = SyncService.generateSlug(note.title)
  
  await prisma.post.create({
    data: {
      blogId,
      evernoteNoteId: note.guid,
      title: note.title,
      content: convertEvernoteToHtmlSimple(note.content),
      excerpt: SyncService.generateExcerpt(note.content),
      slug,
      isPublished: true,
      publishedAt: new Date(),
      createdAt: new Date(note.created),
      updatedAt: new Date(note.updated),
    }
  })
}

async function updateExistingPost(postId: string, note: { title: string; content: string; updated: number }) {
  await prisma.post.update({
    where: { id: postId },
    data: {
      title: note.title,
      content: convertEvernoteToHtmlSimple(note.content),
      excerpt: SyncService.generateExcerpt(note.content),
      isPublished: true,
      publishedAt: new Date(), // Update publish time on update
      updatedAt: new Date(note.updated),
    }
  })
}

async function unpublishPost(postId: string) {
  await prisma.post.update({
    where: { id: postId },
    data: {
      isPublished: false,
      publishedAt: null,
    }
  })
}