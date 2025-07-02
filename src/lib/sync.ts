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
  republishedPosts?: number
  totalPublishedPosts: number
  error?: string
  posts: Array<{
    title: string
    isNew: boolean
    isUpdated: boolean
    isUnpublished: boolean
    isRepublished?: boolean
  }>
}

export interface UserSyncResult {
  success: boolean
  results: SyncResult[]
  totalNewPosts: number
  totalUpdatedPosts: number
  totalUnpublishedPosts: number
  totalRepublishedPosts?: number
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
      const totalUnpublishedPosts = results.reduce((sum, r) => sum + r.unpublishedPosts, 0)
      const totalRepublishedPosts = results.reduce((sum, r) => sum + (r.republishedPosts || 0), 0)

      return {
        success: true,
        results,
        totalNewPosts,
        totalUpdatedPosts,
        totalUnpublishedPosts,
        totalRepublishedPosts
      }
    } catch (error) {
      console.error(`Error syncing user ${userId}:`, error)
      return {
        success: false,
        results: [],
        totalNewPosts: 0,
        totalUpdatedPosts: 0,
        totalUnpublishedPosts: 0,
        totalRepublishedPosts: 0,
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
      // NOTE: getSyncState() returns ACCOUNT-WIDE changes, not notebook-specific
      // This is still useful as an optimization - if the entire account hasn't changed,
      // we know this notebook hasn't changed either
      currentSyncState = await evernoteService.getSyncState()
      console.log(`Current account sync state updateCount: ${currentSyncState.updateCount}`)
      
      // Get the blog's last SUCCESSFUL sync state
      const blog = await prisma.blog.findUnique({
        where: { id: blogId },
        select: { 
          lastSyncUpdateCount: true, 
          lastSyncedAt: true,
          lastSyncAttemptAt: true 
        }
      })
      
      // Only use lastSyncUpdateCount if we have BOTH a successful sync time AND the update count
      // This ensures we don't skip syncs based on failed attempts
      const hasSuccessfulPreviousSync = blog?.lastSyncedAt && blog?.lastSyncUpdateCount
      
      if (hasSuccessfulPreviousSync && currentSyncState.updateCount !== -1) {
        if (currentSyncState.updateCount <= blog.lastSyncUpdateCount!) {
          console.log(`No account changes since last SUCCESSFUL sync (current: ${currentSyncState.updateCount}, last successful: ${blog.lastSyncUpdateCount}). Skipping sync.`)
          return {
            ...result,
            posts: [{
              title: 'No changes detected in Evernote account since last successful sync',
              isNew: false,
              isUpdated: false,
              isUnpublished: false
            }]
          }
        }
        console.log(`Account changes detected since last successful sync (current: ${currentSyncState.updateCount}, last successful: ${blog.lastSyncUpdateCount}). Proceeding with sync.`)
      } else {
        if (blog?.lastSyncAttemptAt && !blog?.lastSyncedAt) {
          console.log(`Previous sync attempts failed. Clearing stale sync state and proceeding with full sync.`)
          // Clear any stale sync update count from failed attempts
          try {
            await prisma.blog.update({
              where: { id: blogId },
              data: { lastSyncUpdateCount: null }
            })
          } catch (clearError) {
            console.error('Failed to clear stale sync state:', clearError)
          }
        } else {
          console.log(`First sync or unable to get account sync state. Proceeding with full sync.`)
        }
      }
      
      // Determine if this is an incremental sync or full sync
      // Only do incremental sync if we have a successful previous sync
      const isIncrementalSync = hasSuccessfulPreviousSync && currentSyncState.updateCount !== -1 && 
                               currentSyncState.updateCount > blog.lastSyncUpdateCount!
      
      let notes: import('@/lib/evernote').EvernoteNote[]
      if (isIncrementalSync && blog?.lastSyncedAt) {
        // Incremental sync: only get notes modified since last successful sync
        console.log(`Performing incremental sync - checking notes modified since ${blog.lastSyncedAt.toISOString()}`)
        console.log(`Sync state: updateCount=${currentSyncState.updateCount}, lastSyncUpdateCount=${blog.lastSyncUpdateCount}`)
        notes = await evernoteService.getNotesFromNotebook(notebookGuid, 100, blog.lastSyncedAt)
      } else {
        // Full sync: now more efficient with tag filtering, can handle more notes
        console.log(`Performing full sync - now optimized to filter by "published" tag first`)
        console.log(`Full sync reasons - hasSuccessfulPreviousSync: ${hasSuccessfulPreviousSync}, updateCount: ${currentSyncState.updateCount}, lastSyncUpdateCount: ${blog?.lastSyncUpdateCount}`)
        notes = await evernoteService.getNotesFromNotebook(notebookGuid, 50)
      }
      
      console.log(`Found ${notes.length} notes to process from notebook ${notebookGuid}`)
      
      result.notesFound = notes.length
      
      for (const note of notes) {
        const isPublished = evernoteService.isPublished(note.tagNames)
        const slug = this.generateSlug(note.title)
        console.log(`Note "${note.title}" - Published: ${isPublished}, Tags: [${note.tagNames.join(', ')}]`)
        
        const existingPost = await prisma.post.findUnique({
          where: { evernoteNoteId: note.guid },
        })

        if (existingPost) {
          // Check if post actually needs updating by comparing content
          const newContent = this.convertEvernoteToHtml(note.content)
          const newExcerpt = this.generateExcerpt(note.content)
          const newUpdatedAt = new Date(note.updated)
          const newPublishedAt = isPublished ? (existingPost.publishedAt || new Date()) : null
          
          // Determine if any content has actually changed
          const hasChanges = (
            existingPost.title !== note.title ||
            existingPost.content !== newContent ||
            existingPost.excerpt !== newExcerpt ||
            existingPost.isPublished !== isPublished ||
            (existingPost.publishedAt?.getTime() !== newPublishedAt?.getTime()) ||
            existingPost.updatedAt.getTime() !== newUpdatedAt.getTime()
          )
          
          if (hasChanges) {
            // Detect if this is a re-publishing (unpublished -> published)
            const isRepublishing = !existingPost.isPublished && isPublished
            
            // Only update if there are actual changes
            await prisma.post.update({
              where: { id: existingPost.id },
              data: {
                title: note.title,
                content: newContent,
                excerpt: newExcerpt,
                isPublished,
                publishedAt: newPublishedAt,
                updatedAt: newUpdatedAt,
              },
            })
            
            if (isRepublishing) {
              result.republishedPosts = (result.republishedPosts || 0) + 1
              result.posts.push({
                title: note.title,
                isNew: false,
                isUpdated: false,
                isUnpublished: false,
                isRepublished: true
              })
              console.log(`Re-published post "${note.title}" - was unpublished, now published`)
            } else {
              result.updatedPosts++
              result.posts.push({
                title: note.title,
                isNew: false,
                isUpdated: true,
                isUnpublished: false
              })
              console.log(`Updated post "${note.title}" - changes detected`)
            }
          } else {
            console.log(`Post "${note.title}" - no changes detected, skipping update`)
          }
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
      // CRITICAL: We need to check ALL notes in the notebook, not just published ones,
      // to detect notes that had their "published" tag removed
      const currentPosts = await prisma.post.findMany({
        where: { blogId, isPublished: true },
      })

      if (currentPosts.length > 0) {
        console.log(`Checking ${currentPosts.length} published posts for unpublished notes...`)
        
        // Fetch ALL notes metadata from notebook to detect unpublished ones
        // Use the evernoteService method to get all notes metadata (without tag filtering)
        let allNotesMetadata: { guid: string; tagGuids?: string[] }[] = []
        try {
          console.log('Fetching all notes metadata to detect unpublished posts...')
          
          // Use evernoteService to get all notes metadata (without tag filtering)
          const metadata = await evernoteService.getAllNotesMetadata(notebookGuid, isIncrementalSync && blog?.lastSyncedAt ? blog.lastSyncedAt : undefined)
          allNotesMetadata = metadata
          console.log(`Found ${allNotesMetadata.length} total notes for unpublish check`)
        } catch (error) {
          console.error('Failed to fetch all notes metadata for unpublish check:', error)
          // Fall back to checking only against the published notes we fetched
          allNotesMetadata = notes.map(note => ({ guid: note.guid, tagGuids: [] }))
        }

        for (const post of currentPosts) {
          const noteMetadata = allNotesMetadata.find(note => note.guid === post.evernoteNoteId)
          
          if (!noteMetadata) {
            // Note was deleted from Evernote entirely
            console.log(`Note ${post.evernoteNoteId} was deleted from Evernote, unpublishing post "${post.title}"`)
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
          } else {
            // Note still exists - check if it still has "published" tag
            try {
              const tagNames = await evernoteService.getTagNames(noteMetadata.tagGuids || [])
              if (!evernoteService.isPublished(tagNames)) {
                console.log(`Note "${post.title}" no longer has "published" tag, unpublishing post`)
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
            } catch (tagError) {
              console.error(`Failed to check tags for note ${post.evernoteNoteId}:`, tagError)
              // If we can't check tags, assume it's still published to avoid false unpublishing
            }
          }
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
      
      // Update only the attempt time for failed syncs 
      // Clear any stale sync update count from previous failed attempts
      try {
        await prisma.blog.update({
          where: { id: blogId },
          data: { 
            lastSyncAttemptAt: new Date(),
            // Don't update lastSyncedAt or lastSyncUpdateCount on failure
          }
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