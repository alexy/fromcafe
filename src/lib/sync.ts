import { prisma } from '@/lib/prisma'
import { EvernoteService } from '@/lib/evernote'
import { ContentProcessor } from '@/lib/content-processor'
import { tagPostBySource } from '@/lib/blog/tags'
import { ContentSource } from '@prisma/client'
import * as cron from 'node-cron'

export interface SyncResult {
  blogId: string
  blogTitle: string
  notesFound: number
  newPosts: number
  updatedPosts: number
  unpublishedPosts: number
  republishedPosts?: number
  republishedUpdatedPosts?: number
  totalPublishedPosts: number
  error?: string
  posts: Array<{
    title: string
    isNew: boolean
    isUpdated: boolean
    isUnpublished: boolean
    isRepublished?: boolean
    isRepublishedUpdated?: boolean
  }>
}

export interface UserSyncResult {
  success: boolean
  results: SyncResult[]
  totalNewPosts: number
  totalUpdatedPosts: number
  totalUnpublishedPosts: number
  totalRepublishedPosts?: number
  totalRepublishedUpdatedPosts?: number
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
          totalUnpublishedPosts: 0,
          totalRepublishedPosts: 0,
          totalRepublishedUpdatedPosts: 0,
          error: 'No Evernote token found'
        }
      }

      const evernoteService = new EvernoteService(user.evernoteToken, user.evernoteNoteStoreUrl || undefined, user.id)
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
      const totalRepublishedUpdatedPosts = results.reduce((sum, r) => sum + (r.republishedUpdatedPosts || 0), 0)

      return {
        success: true,
        results,
        totalNewPosts,
        totalUpdatedPosts,
        totalUnpublishedPosts,
        totalRepublishedPosts,
        totalRepublishedUpdatedPosts
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
        totalRepublishedUpdatedPosts: 0,
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
      republishedPosts: 0,
      republishedUpdatedPosts: 0,
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
          lastSyncAttemptAt: true,
          evernoteNotebook: true,
          evernoteNotebookName: true,
          showCameraMake: true
        }
      })
      
      // Only use lastSyncUpdateCount if we have BOTH a successful sync time AND the update count
      // This ensures we don't skip syncs based on failed attempts
      const hasSuccessfulPreviousSync = blog?.lastSyncedAt && blog?.lastSyncUpdateCount
      
      if (hasSuccessfulPreviousSync && currentSyncState.updateCount !== -1) {
        if (currentSyncState.updateCount <= blog.lastSyncUpdateCount!) {
          console.log(`No account changes since last SUCCESSFUL sync (current: ${currentSyncState.updateCount}, last successful: ${blog.lastSyncUpdateCount}). Skipping sync.`)
          
          // Clear lastSyncAttemptAt since this sync was successful (even though no changes)
          await prisma.blog.update({
            where: { id: blogId },
            data: { 
              lastSyncAttemptAt: null, // Clear attempt time since sync was successful
              lastSyncedAt: new Date() // Update sync time to show recent successful check
            }
          })
          
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
      // NOTE: During incremental syncs, we preserve images for unpublished posts to optimize republishing
      const isIncrementalSync = hasSuccessfulPreviousSync && currentSyncState.updateCount !== -1 && 
                               currentSyncState.updateCount > blog.lastSyncUpdateCount!
      
      // During full sync, refresh notebook name in case it was changed in Evernote
      if (!isIncrementalSync && blog?.evernoteNotebook) {
        console.log('Full sync: Refreshing notebook name for', blog.evernoteNotebook)
        try {
          const notebooks = await evernoteService.getNotebooks()
          const currentNotebook = notebooks.find((nb: { guid: string; name: string }) => nb.guid === blog.evernoteNotebook)
          if (currentNotebook && currentNotebook.name !== blog.evernoteNotebookName) {
            console.log(`Notebook name changed: "${blog.evernoteNotebookName}" → "${currentNotebook.name}"`)
            await prisma.blog.update({
              where: { id: blogId },
              data: { evernoteNotebookName: currentNotebook.name }
            })
          } else if (currentNotebook) {
            console.log(`Notebook name unchanged: "${currentNotebook.name}"`)
          } else {
            console.warn(`Notebook ${blog.evernoteNotebook} not found - may have been deleted`)
          }
        } catch (error) {
          console.error('Failed to refresh notebook name during full sync:', error)
          // Don't fail the entire sync if notebook name refresh fails
        }
      }
      
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
          const contentProcessor = new ContentProcessor()
          const processingResult = await contentProcessor.processEvernoteContent(note.content, note, existingPost.id, evernoteService, blog?.showCameraMake || false)
          const newContent = processingResult.processedContent
          const newExcerpt = contentProcessor.generateExcerpt(note.content)
          const newUpdatedAt = new Date(note.updated)
          const newPublishedAt = isPublished ? (existingPost.publishedAt || new Date()) : null
          
          // Separate content changes from publication status changes
          // Note: Don't compare updatedAt as it represents our DB timestamp, not Evernote's
          const titleChanged = existingPost.title !== note.title
          const contentChanged = existingPost.content !== newContent
          const excerptChanged = existingPost.excerpt !== newExcerpt
          
          // For republished posts, always force content processing to ensure images are handled
          const isRepublishing = !existingPost.isPublished && isPublished
          const hasContentChanges = titleChanged || contentChanged || excerptChanged || isRepublishing
          
          // EMERGENCY DEBUG: Always log content comparison for republished posts
          if (isRepublishing) {
            console.log(`🔍 REPUBLISHED POST DEBUG: "${note.title}" - titleChanged=${titleChanged}, contentChanged=${contentChanged}, excerptChanged=${excerptChanged}`)
            console.log(`📏 CONTENT LENGTHS: old=${existingPost.content?.length || 0}, new=${newContent.length}, timeSinceUpdate=${Math.round((Date.now() - note.updated) / 1000)}s`)
            console.log(`🔄 FORCING content update for republished post to re-process images`)
            
            // Show actual content comparison if lengths differ
            if (existingPost.content && newContent && existingPost.content.length !== newContent.length) {
              console.log(`📝 CONTENT DIFFERS: "${existingPost.content.substring(0, 100)}" vs "${newContent.substring(0, 100)}"`)
            } else if (existingPost.content && newContent) {
              console.log(`⚠️ SAME LENGTH BUT CHECK CONTENT: "${existingPost.content.substring(0, 100)}" vs "${newContent.substring(0, 100)}"`)
            }
            
            // Log processing results for republished posts
            if (processingResult.errors.length > 0) {
              console.log(`🖼️ Image processing errors for republished post:`, processingResult.errors)
            }
            if (processingResult.imageCount > 0) {
              console.log(`🖼️ Processed ${processingResult.imageCount} images for republished post`)
            }
            
            // RACE CONDITION DETECTION
            if (!contentChanged && (Date.now() - note.updated) < 60000) {
              console.log(`🚨 RACE CONDITION DETECTED: Content unchanged but note updated ${Math.round((Date.now() - note.updated) / 1000)}s ago`)
            }
          }
          
          // Debug logging for content change detection
          if (hasContentChanges) {
            console.log(`Content changes detected for "${note.title}":`)
            if (titleChanged) console.log(`  - Title: "${existingPost.title}" → "${note.title}"`)
            if (contentChanged) {
              console.log(`  - Content changed (lengths: ${existingPost.content?.length || 0} → ${newContent.length})`)
              console.log(`  - Old content preview: "${(existingPost.content || '').substring(0, 100)}..."`)
              console.log(`  - New content preview: "${newContent.substring(0, 100)}..."`)
            }
            if (excerptChanged) console.log(`  - Excerpt: "${existingPost.excerpt}" → "${newExcerpt}"`)
          } else {
            console.log(`No content changes detected for "${note.title}"`)
            console.log(`  - Content lengths: old=${existingPost.content?.length || 0}, new=${newContent.length}`)
          }
          
          const hasPublicationChanges = (
            existingPost.isPublished !== isPublished ||
            (existingPost.publishedAt?.getTime() !== newPublishedAt?.getTime())
          )
          
          const hasAnyChanges = hasContentChanges || hasPublicationChanges
          
          if (hasAnyChanges) {
            console.log(`Processing post "${note.title}": isRepublishing=${isRepublishing}, hasContentChanges=${hasContentChanges}, hasPublicationChanges=${hasPublicationChanges}`)
            
            // Only update if there are actual changes
            const updatedPost = await prisma.post.update({
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
            
            // Verify the content was actually updated in the database
            if (hasContentChanges && contentChanged) {
              console.log(`  VERIFY: Post "${note.title}" content updated in DB (new length: ${updatedPost.content?.length || 0})`)
              if (updatedPost.content !== newContent) {
                console.error(`  ERROR: Content mismatch after DB update! Expected length ${newContent.length}, got ${updatedPost.content?.length || 0}`)
              }
            }
            
            if (isRepublishing && hasContentChanges) {
              // Re-published AND content was updated
              result.republishedUpdatedPosts = (result.republishedUpdatedPosts || 0) + 1
              result.posts.push({
                title: note.title,
                isNew: false,
                isUpdated: false,
                isUnpublished: false,
                isRepublished: true,
                isRepublishedUpdated: true
              })
              console.log(`📊 COUNTER: republishedUpdatedPosts = ${result.republishedUpdatedPosts}`)
              console.log(`Re-published and updated post "${note.title}" - was unpublished, now published with content changes`)
              console.log(`  DEBUG: Content updated in DB: title="${note.title}", contentLength=${newContent.length}, excerpt="${newExcerpt}"`)
            } else if (isRepublishing) {
              // Re-published without content changes (BUT STILL UPDATE CONTENT FROM EVERNOTE)
              result.republishedPosts = (result.republishedPosts || 0) + 1
              result.posts.push({
                title: note.title,
                isNew: false,
                isUpdated: false,
                isUnpublished: false,
                isRepublished: true
              })
              console.log(`📊 COUNTER: republishedPosts = ${result.republishedPosts}`)
              console.log(`Re-published post "${note.title}" - was unpublished, now published (no content changes detected)`)
              console.log(`  DEBUG: Content lengths: old=${existingPost.content?.length || 0}, new=${newContent.length}`)
              console.log(`  NOTE: Content from Evernote was still saved to database even if no changes detected`)
            } else {
              // Just content updates (already published)
              result.updatedPosts++
              result.posts.push({
                title: note.title,
                isNew: false,
                isUpdated: true,
                isUnpublished: false
              })
              console.log(`📊 COUNTER: updatedPosts = ${result.updatedPosts}`)
              console.log(`Updated post "${note.title}" - content changes detected`)
            }
          } else {
            console.log(`Post "${note.title}" - no changes detected, skipping update`)
          }
        } else if (isPublished) {
          // Create new published post
          console.log(`Creating new post for note "${note.title}"`)
          const contentProcessor = new ContentProcessor()
          const newPost = await prisma.post.create({
            data: {
              blogId,
              evernoteNoteId: note.guid,
              title: note.title,
              content: '', // Will be updated below after processing images
              excerpt: contentProcessor.generateExcerpt(note.content),
              slug,
              isPublished: true,
              publishedAt: new Date(),
              createdAt: new Date(note.created),
              updatedAt: new Date(note.updated),
            },
          })
          
          // Process content with images after creating the post (need post ID)
          const processingResult = await contentProcessor.processEvernoteContent(note.content, note, newPost.id, evernoteService, blog?.showCameraMake || false)
          await prisma.post.update({
            where: { id: newPost.id },
            data: { content: processingResult.processedContent }
          })
          
          // Log any image processing errors
          if (processingResult.errors.length > 0) {
            console.warn(`Image processing errors for post ${newPost.id}:`, processingResult.errors)
          }
          console.log(`Processed ${processingResult.imageCount} images for new post "${note.title}"`)
          
          // Tag the post as coming from Evernote
          await tagPostBySource(newPost.id, ContentSource.EVERNOTE)
          
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
      // OPTIMIZATION: Use the published notes we already fetched instead of separate API call
      const currentPosts = await prisma.post.findMany({
        where: { blogId, isPublished: true },
      })

      if (currentPosts.length > 0) {
        console.log(`Checking ${currentPosts.length} published posts for unpublished notes...`)
        
        // OPTIMIZATION: Create a set of note GUIDs that are still published (from our main sync)
        const stillPublishedNoteGuids = new Set(notes.map(note => note.guid))
        console.log(`Found ${stillPublishedNoteGuids.size} notes still published in current sync`)
        console.log(`🔍 SYNC-DEBUG: Still published note GUIDs:`, Array.from(stillPublishedNoteGuids))

        for (const post of currentPosts) {
          console.log(`🔍 SYNC-DEBUG: Checking post "${post.title}" (${post.evernoteNoteId}) - contentSource: ${post.contentSource}`)
          
          // Only check Evernote posts (skip Ghost posts)
          if (!post.evernoteNoteId || post.contentSource !== 'EVERNOTE') {
            console.log(`🔍 SYNC-DEBUG: Skipping post "${post.title}" - not Evernote post`)
            continue
          }
          
          // Check if this post's note is still in the published notes we fetched
          const stillPublished = stillPublishedNoteGuids.has(post.evernoteNoteId)
          console.log(`🔍 SYNC-DEBUG: Post "${post.title}" still published: ${stillPublished}`)
          
          if (!stillPublished) {
            // Note is no longer published (either deleted or lost "published" tag)
            console.log(`🚨 UNPUBLISHING: Note "${post.title}" (${post.evernoteNoteId}) no longer published, unpublishing post`)
            
            // Clean up images for unpublished posts (only during full sync to preserve images for potential republishing)
            if (!isIncrementalSync) {
              console.log(`Full sync: Cleaning up images for unpublished post "${post.title}"`)
              try {
                const contentProcessor = new ContentProcessor()
                await contentProcessor.cleanupPostImages(post.id)
              } catch (error) {
                console.error(`Error cleaning up images for post ${post.id}:`, error)
              }
            } else {
              console.log(`Incremental sync: Preserving images for unpublished post "${post.title}" (images will be cleaned up during next full sync)`)
            }
            
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
      }

      // Get final count of published posts
      const finalPublishedCount = await prisma.post.count({
        where: { blogId, isPublished: true }
      })
      result.totalPublishedPosts = finalPublishedCount

      // SYNC-DEBUG: Log final results before returning
      console.log(`🚨 SYNC-RESULT: Final sync results:`, {
        newPosts: result.newPosts,
        updatedPosts: result.updatedPosts,
        unpublishedPosts: result.unpublishedPosts,
        republishedPosts: result.republishedPosts || 0,
        republishedUpdatedPosts: result.republishedUpdatedPosts || 0,
        totalRepublished: (result.republishedPosts || 0) + (result.republishedUpdatedPosts || 0),
        totalChanges: result.newPosts + result.updatedPosts + result.unpublishedPosts + (result.republishedPosts || 0) + (result.republishedUpdatedPosts || 0),
        postsDetails: result.posts.map(p => ({ title: p.title, isNew: p.isNew, isUpdated: p.isUpdated, isUnpublished: p.isUnpublished, isRepublished: p.isRepublished, isRepublishedUpdated: p.isRepublishedUpdated }))
      })

      // Update the blog's last synced time, clear attempt time (since sync succeeded), and sync state
      await prisma.blog.update({
        where: { id: blogId },
        data: { 
          lastSyncedAt: new Date(),
          lastSyncAttemptAt: null, // Clear attempt time since sync was successful
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


  private static schedulerStarted = false

  static startSyncScheduler(): void {
    // Prevent multiple scheduler instances
    if (this.schedulerStarted) {
      console.log('Sync scheduler already running, skipping initialization')
      return
    }
    
    this.schedulerStarted = true
    
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