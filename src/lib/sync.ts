import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'
import * as cron from 'node-cron'

export interface SyncResult {
  blogId: string
  blogTitle: string
  notesFound: number
  newPosts: number
  updatedPosts: number
  unpublishedPosts: number
  totalPublishedPosts: number
  error?: string
  posts: Array<{
    title: string
    isNew: boolean
    isUpdated: boolean
    isUnpublished: boolean
  }>
}

export interface UserSyncResult {
  success: boolean
  results: SyncResult[]
  totalNewPosts: number
  totalUpdatedPosts: number
  error?: string
}

export class SyncService {
  static async syncUserBlogs(userId: string): Promise<UserSyncResult> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
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
        },
      })

      if (!user?.evernoteToken) {
        console.log(`User ${userId} has no Evernote token, skipping sync`)
        return {
          success: false,
          results: [],
          totalNewPosts: 0,
          totalUpdatedPosts: 0,
          error: 'No Evernote token found'
        }
      }

      const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined)
      const results: SyncResult[] = []

      for (const blog of user.blogs) {
        if (blog.evernoteNotebook) {
          try {
            const result = await this.syncBlogPosts(blog.id, blog.title, blog.evernoteNotebook, evernoteService)
            results.push(result)
          } catch (error) {
            console.error(`Failed to sync blog ${blog.id}:`, error)
            // Add a failed sync result
            results.push({
              blogId: blog.id,
              blogTitle: blog.title,
              notesFound: 0,
              newPosts: 0,
              updatedPosts: 0,
              unpublishedPosts: 0,
              totalPublishedPosts: 0,
              posts: [{
                title: `Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isNew: false,
                isUpdated: false,
                isUnpublished: false
              }]
            })
          }
        }
      }

      const totalNewPosts = results.reduce((sum, r) => sum + r.newPosts, 0)
      const totalUpdatedPosts = results.reduce((sum, r) => sum + r.updatedPosts, 0)

      return {
        success: true,
        results,
        totalNewPosts,
        totalUpdatedPosts
      }
    } catch (error) {
      console.error(`Error syncing user ${userId}:`, error)
      return {
        success: false,
        results: [],
        totalNewPosts: 0,
        totalUpdatedPosts: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  static async syncBlogPosts(blogId: string, blogTitle: string, notebookGuid: string, evernoteService: EvernoteService): Promise<SyncResult> {
    const result: SyncResult = {
      blogId,
      blogTitle,
      notesFound: 0,
      newPosts: 0,
      updatedPosts: 0,
      unpublishedPosts: 0,
      totalPublishedPosts: 0,
      posts: []
    }

    let currentSyncState: { updateCount: number }

    try {
      console.log(`Starting sync for blog ${blogId}, notebook ${notebookGuid}`)
      
      // Check if the account has changed since last sync
      currentSyncState = await evernoteService.getSyncState()
      console.log(`Current sync state updateCount: ${currentSyncState.updateCount}`)
      
      // Get the blog's last sync state
      const blog = await prisma.blog.findUnique({
        where: { id: blogId },
        select: { lastSyncUpdateCount: true }
      })
      
      if (blog?.lastSyncUpdateCount && currentSyncState.updateCount !== -1) {
        if (currentSyncState.updateCount <= blog.lastSyncUpdateCount) {
          console.log(`No changes since last sync (current: ${currentSyncState.updateCount}, last: ${blog.lastSyncUpdateCount}). Skipping sync.`)
          return {
            ...result,
            posts: [{
              title: 'No changes detected since last sync',
              isNew: false,
              isUpdated: false,
              isUnpublished: false
            }]
          }
        }
        console.log(`Changes detected (current: ${currentSyncState.updateCount}, last: ${blog.lastSyncUpdateCount}). Proceeding with sync.`)
      } else {
        console.log(`First sync or unable to get sync state. Proceeding with full sync.`)
      }
      
      const notes = await evernoteService.getNotesFromNotebook(notebookGuid)
      console.log(`Found ${notes.length} notes in notebook ${notebookGuid}`)
      
      result.notesFound = notes.length
      
      for (const note of notes) {
        const isPublished = evernoteService.isPublished(note.tagNames)
        const slug = this.generateSlug(note.title)
        console.log(`Note "${note.title}" - Published: ${isPublished}, Tags: [${note.tagNames.join(', ')}]`)
        
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
          result.updatedPosts++
          result.posts.push({
            title: note.title,
            isNew: false,
            isUpdated: true,
            isUnpublished: false
          })
        } else if (isPublished) {
          // Create new published post
          console.log(`Creating new post for note "${note.title}"`)
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
          result.newPosts++
          result.posts.push({
            title: note.title,
            isNew: true,
            isUpdated: false,
            isUnpublished: false
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
          result.unpublishedPosts++
          result.posts.push({
            title: post.title,
            isNew: false,
            isUpdated: false,
            isUnpublished: true
          })
        }
      }

      // Get final count of published posts
      const finalPublishedCount = await prisma.post.count({
        where: { blogId, isPublished: true }
      })
      result.totalPublishedPosts = finalPublishedCount

      // Update the blog's last synced time, attempt time, and sync state
      await prisma.blog.update({
        where: { id: blogId },
        data: { 
          lastSyncedAt: new Date(),
          lastSyncAttemptAt: new Date(),
          lastSyncUpdateCount: currentSyncState.updateCount !== -1 ? currentSyncState.updateCount : undefined
        }
      })

      return result
    } catch (error) {
      console.error(`Error syncing blog ${blogId}:`, error)
      
      // Update only the attempt time for failed syncs (don't update sync state on failure)
      try {
        await prisma.blog.update({
          where: { id: blogId },
          data: { lastSyncAttemptAt: new Date() }
        })
      } catch (updateError) {
        console.error('Failed to update sync attempt time:', updateError)
      }
      
      // Return error information instead of throwing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        ...result,
        error: errorMessage,
        posts: [{
          title: `Error: ${errorMessage}`,
          isNew: false,
          isUpdated: false,
          isUnpublished: false
        }]
      }
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
        await this.syncUserBlogs(user.id).catch(error => {
          console.error(`Failed to sync user ${user.id}:`, error)
        })
      }
      
      console.log('Scheduled sync completed')
    })
  }
}