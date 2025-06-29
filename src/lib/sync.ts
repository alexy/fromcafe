import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'
import * as cron from 'node-cron'

export class SyncService {
  static async syncUserBlogs(userId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { blogs: true },
      })

      if (!user?.evernoteToken) {
        console.log(`User ${userId} has no Evernote token, skipping sync`)
        return
      }

      const evernoteService = new EvernoteService(user.evernoteToken)

      for (const blog of user.blogs) {
        if (blog.evernoteNotebook) {
          await this.syncBlogPosts(blog.id, blog.evernoteNotebook, evernoteService)
        }
      }
    } catch (error) {
      console.error(`Error syncing user ${userId}:`, error)
    }
  }

  static async syncBlogPosts(blogId: string, notebookGuid: string, evernoteService: EvernoteService): Promise<void> {
    try {
      const notes = await evernoteService.getNotesFromNotebook(notebookGuid)
      
      for (const note of notes) {
        const isPublished = evernoteService.isPublished(note.tagNames)
        const slug = this.generateSlug(note.title)
        
        const existingPost = await prisma.post.findUnique({
          where: { evernoteNoteId: note.guid },
        })

        if (existingPost) {
          // Update existing post
          await prisma.post.update({
            where: { id: existingPost.id },
            data: {
              title: note.title,
              content: this.convertEvernoteToHtml(note.content),
              excerpt: this.generateExcerpt(note.content),
              isPublished,
              publishedAt: isPublished ? (existingPost.publishedAt || new Date()) : null,
              updatedAt: new Date(note.updated),
            },
          })
        } else if (isPublished) {
          // Create new published post
          await prisma.post.create({
            data: {
              blogId,
              evernoteNoteId: note.guid,
              title: note.title,
              content: this.convertEvernoteToHtml(note.content),
              excerpt: this.generateExcerpt(note.content),
              slug,
              isPublished: true,
              publishedAt: new Date(),
              createdAt: new Date(note.created),
              updatedAt: new Date(note.updated),
            },
          })
        }
      }

      // Handle unpublished posts (notes that no longer have 'published' tag)
      const currentPosts = await prisma.post.findMany({
        where: { blogId, isPublished: true },
      })

      for (const post of currentPosts) {
        const noteStillExists = notes.find(note => note.guid === post.evernoteNoteId)
        if (!noteStillExists || !evernoteService.isPublished(noteStillExists.tagNames)) {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              isPublished: false,
              publishedAt: null,
            },
          })
        }
      }
    } catch (error) {
      console.error(`Error syncing blog ${blogId}:`, error)
    }
  }

  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  static convertEvernoteToHtml(enmlContent: string): string {
    // Basic ENML to HTML conversion
    // In a real implementation, you'd use a proper ENML parser
    return enmlContent
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!DOCTYPE[^>]*>/g, '')
      .replace(/<en-note[^>]*>/g, '<div>')
      .replace(/<\/en-note>/g, '</div>')
      .replace(/<en-media[^>]*\/>/g, '') // Remove media for now
  }

  static generateExcerpt(content: string, maxLength: number = 200): string {
    const text = content.replace(/<[^>]*>/g, '').trim()
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }

  static startSyncScheduler(): void {
    // Run sync every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      console.log('Starting scheduled sync...')
      
      const users = await prisma.user.findMany({
        where: {
          evernoteToken: { not: null },
        },
        select: { id: true },
      })

      for (const user of users) {
        await this.syncUserBlogs(user.id)
      }
      
      console.log('Scheduled sync completed')
    })
  }
}