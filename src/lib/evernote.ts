import * as Evernote from 'evernote'
import { storeTokenSecret, getTokenSecret, removeToken } from './evernote-session'
import { prisma } from './prisma'

// Helper function to get the correct base URL (prioritizes custom domain)
function getBaseUrl(): string {
  // Use NEXTAUTH_URL if explicitly set (this should be your custom domain)
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
  }
  
  // For Vercel deployments, use VERCEL_URL as fallback
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Local development fallback
  return 'http://localhost:3000'
}

const client = new Evernote.Client({
  consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
  consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
  sandbox: false,
})

export interface EvernoteNote {
  guid: string
  title: string
  content: string
  tagNames: string[]
  created: number
  updated: number
  resources?: EvernoteResource[]
}

export interface EvernoteResource {
  guid: string
  data: {
    bodyHash: string
    size: number
  }
  mime: string
  width?: number
  height?: number
}

export interface EvernoteNotebook {
  guid: string
  name: string
}

export class EvernoteService {
  constructor(
    private accessToken: string, 
    private noteStoreUrl?: string,
    private userId?: string
  ) {
  }

  async getNotebooks(): Promise<EvernoteNotebook[]> {

    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const tokenizedClient = new (require('evernote')).Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()
      
      // Call listNotebooks with auth token
      const notebooks = await freshNoteStore.listNotebooks(this.accessToken)
      
      if (notebooks && Array.isArray(notebooks)) {
        return notebooks.map((notebook: { guid: string; name: string }) => ({
          guid: notebook.guid,
          name: notebook.name,
        }))
      } else {
        throw new Error('Invalid notebooks response from Evernote')
      }
    } catch (error) {
      console.error('Error fetching notebooks:', error)
      const errorMessage = (error as Error)?.message || 'Unknown error'
      throw new Error(`Failed to fetch notebooks: ${errorMessage}`)
    }
  }

  async getNotesFromNotebook(notebookGuid: string, maxNotes: number = 20, sinceDate?: Date): Promise<EvernoteNote[]> {
    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EvernoteSDK = require('evernote')
      const tokenizedClient = new EvernoteSDK.Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()
      
      // OPTIMIZATION: Find "published" tag first to filter notes efficiently
      let publishedTagGuid: string | null = null
      
      // Try to get cached published tag GUID first
      if (this.userId) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: this.userId },
            select: { 
              evernotePublishedTagGuid: true, 
              evernoteAccountId: true,
              evernoteUserId: true
            }
          })
          
          // Use cached GUID if it's for the same Evernote account
          if (user?.evernotePublishedTagGuid && user.evernoteAccountId === user.evernoteUserId) {
            publishedTagGuid = user.evernotePublishedTagGuid
            console.log(`Using cached "published" tag GUID: ${publishedTagGuid}`)
          }
        } catch (cacheError) {
          console.warn('Failed to load cached published tag GUID:', cacheError)
        }
      }
      
      // Fetch from API if no cached GUID available
      if (!publishedTagGuid) {
        try {
          console.log('Finding "published" tag via API...')
          
          // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
          const listTagsLength = freshNoteStore.listTags.length
          const listTagsSource = freshNoteStore.listTags.toString()
          const isWrappedFunction = listTagsLength === 0 && listTagsSource.includes('arguments.length')
          
          console.log(`listTags detection - length: ${listTagsLength}, isWrapped: ${isWrappedFunction}, source preview: "${listTagsSource.substring(0, 100)}"`)
          
          // SIMPLIFIED LOGIC: Only local wrapped functions are different
          const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
          const isLocalWrappedException = isLocal && isWrappedFunction
          
          const tags = isLocalWrappedException
            ? await freshNoteStore.listTags()                    // Local wrapped: no token
            : await freshNoteStore.listTags(this.accessToken)    // Everything else: use token
          
          console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} listTags logic`)
          const publishedTag = tags.find((tag: { name: string }) => 
            tag.name.toLowerCase() === 'published'
          )
          if (publishedTag) {
            publishedTagGuid = publishedTag.guid
            console.log(`Found "published" tag with GUID: ${publishedTagGuid}`)
            
            // Cache the GUID for future use
            if (this.userId) {
              try {
                await prisma.user.update({
                  where: { id: this.userId },
                  data: { 
                    evernotePublishedTagGuid: publishedTagGuid,
                    evernoteAccountId: await this.getCurrentEvernoteAccountId(freshNoteStore)
                  }
                })
                console.log('Cached published tag GUID for future syncs')
              } catch (updateError) {
                console.warn('Failed to cache published tag GUID:', updateError)
              }
            }
          } else {
            console.log('No "published" tag found - will check all notes')
          }
        } catch (tagError) {
          console.warn('Could not fetch tags, falling back to checking all notes:', tagError)
        }
      }
      
      const filter: { notebookGuid: string; updated?: number; tagGuids?: string[] } = {
        notebookGuid: notebookGuid
      }
      
      // OPTIMIZATION: Filter by "published" tag at API level if we found it
      if (publishedTagGuid) {
        filter.tagGuids = [publishedTagGuid]
        console.log('Filtering notes by "published" tag at API level')
      }
      
      // Add date filter if provided to only get notes modified since last sync
      if (sinceDate) {
        filter.updated = Math.floor(sinceDate.getTime())
        console.log(`Filtering notes updated since: ${sinceDate.toISOString()} (timestamp: ${filter.updated})`)
      }
      
      const spec = {
        includeTitle: true,
        includeTagGuids: true,
        includeCreated: true,
        includeUpdated: true
      }
      
      // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
      const isWrappedFunction = freshNoteStore.findNotesMetadata.length === 0 && 
        freshNoteStore.findNotesMetadata.toString().includes('arguments.length')
      
      // SIMPLIFIED LOGIC: Only local wrapped functions are different
      const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
      const isLocalWrappedException = isLocal && isWrappedFunction
      
      const notesMetadata = isLocalWrappedException
        ? await freshNoteStore.findNotesMetadata(filter, 0, Math.min(maxNotes, 50), spec)                    // Local wrapped: no token
        : await freshNoteStore.findNotesMetadata(this.accessToken, filter, 0, Math.min(maxNotes, 50), spec)  // Everything else: use token
      
      console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} findNotesMetadata logic`)
      console.log(`Found ${notesMetadata.notes.length} notes to process (${publishedTagGuid ? 'pre-filtered by published tag' : 'will filter during processing'})`)
      
      const notes: EvernoteNote[] = []
      
      // Process notes with rate limiting - add delay between requests
      let rateLimitErrors = 0
      const maxRetries = 3
      
      for (let i = 0; i < notesMetadata.notes.length; i++) {
        const metadata = notesMetadata.notes[i]
        
        // Add delay between API calls to avoid rate limits (except for first note)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000)) // Increased to 1 second to avoid rate limits
        }
        
        let retryCount = 0
        let noteProcessed = false
        
        while (!noteProcessed && retryCount < maxRetries) {
          try {
            // OPTIMIZATION: Get tag names first to check if published (avoid expensive getNote call)
            const tagNames = await this.getTagNamesWithStore(freshNoteStore, metadata.tagGuids || [])
            
            // Skip notes without "published" tag (if we couldn't filter at API level)
            if (!publishedTagGuid && !this.isPublished(tagNames)) {
              console.log(`Skipping non-published note: ${metadata.title || 'Untitled'}`)
              noteProcessed = true
              continue
            }
            
            // Only fetch full note content for published notes
            // RACE CONDITION FIX: If this is a recently updated note, add small delay
            // to allow Evernote content changes to propagate after tag changes
            if (metadata.updated && Date.now() - metadata.updated < 30000) {
              console.log(`Note "${metadata.title}" was updated recently (${new Date(metadata.updated).toISOString()}), adding small delay for content propagation`)
              await new Promise(resolve => setTimeout(resolve, 2000)) // 2 second delay
            }
            
            // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
            const isWrappedFunction = freshNoteStore.getNote.length === 0 && 
              freshNoteStore.getNote.toString().includes('arguments.length')
            
            // SIMPLIFIED LOGIC: Only local wrapped functions are different
            const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
            const isLocalWrappedException = isLocal && isWrappedFunction
            
            const fullNote = isLocalWrappedException
              ? await freshNoteStore.getNote(metadata.guid, true, true, false, false)                    // Local wrapped: no token, include resources
              : await freshNoteStore.getNote(this.accessToken, metadata.guid, true, true, false, false)  // Everything else: use token, include resources
            
            console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} getNote logic`)
            
            notes.push({
              guid: fullNote.guid,
              title: fullNote.title,
              content: fullNote.content,
              tagNames,
              created: fullNote.created,
              updated: fullNote.updated,
              resources: fullNote.resources || []
            })
            
            console.log(`Processed published note ${notes.length}: "${fullNote.title}"`)
            noteProcessed = true
            
          } catch (noteError) {
            retryCount++
            
            // Check if it's a rate limit error
            if (noteError && typeof noteError === 'object' && 'errorCode' in noteError && noteError.errorCode === 19) {
              rateLimitErrors++
              const rateLimitDuration = (noteError as { rateLimitDuration?: number }).rateLimitDuration || 60
              console.log(`Rate limit hit for note ${metadata.guid}, duration: ${rateLimitDuration}s`)
              
              // Don't wait for long periods during sync - fail fast instead
              if (rateLimitDuration > 60) {
                console.error(`Rate limit duration too long (${rateLimitDuration}s), failing sync immediately`)
                throw new Error(`Evernote API rate limit exceeded. Please wait ${Math.ceil(rateLimitDuration / 60)} minutes before syncing again.`)
              }
              
              // Only retry with short waits (max 1 minute)
              if (retryCount < maxRetries) {
                const waitTime = Math.min(rateLimitDuration, 60)
                console.log(`Waiting ${waitTime}s before retry ${retryCount}/${maxRetries}`)
                await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
              } else {
                console.error(`Failed to process note ${metadata.guid} after ${maxRetries} retries due to rate limiting`)
                noteProcessed = true // Skip this note and continue
              }
            } else {
              console.error(`Failed to process note ${metadata.guid}:`, noteError)
              noteProcessed = true // Skip this note for non-rate-limit errors
            }
          }
        }
      }
      
      // If too many notes failed due to rate limiting, throw an error
      if (rateLimitErrors > Math.max(1, notesMetadata.notes.length / 3)) {
        throw new Error(`Rate limited by Evernote API (${rateLimitErrors}/${notesMetadata.notes.length} notes failed). Please wait 5-10 minutes before syncing again.`)
      }
      
      console.log(`Found ${notes.length} published notes out of ${notesMetadata.notes.length} total notes`)
      return notes
    } catch (error) {
      console.error('Error fetching notes:', error)
      
      // Handle rate limiting specifically
      if (error && typeof error === 'object' && 'errorCode' in error && error.errorCode === 19) {
        const rateLimitDuration = (error as { rateLimitDuration?: number }).rateLimitDuration || 600 // Default 10 minutes
        const waitMinutes = Math.ceil(rateLimitDuration / 60)
        console.error(`Rate limit hit. Duration: ${rateLimitDuration}s (${waitMinutes} minutes)`)
        throw new Error(`Evernote API rate limit exceeded. Please wait ${waitMinutes} minutes before syncing again.`)
      }
      
      // Handle other Evernote errors with more context
      if (error && typeof error === 'object' && 'message' in error) {
        throw new Error(`Evernote API error: ${(error as Error).message || 'Unknown error'}`)
      }
      
      throw new Error('Failed to fetch notes')
    }
  }

  async getNote(noteGuid: string): Promise<EvernoteNote> {
    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EvernoteSDK = require('evernote')
      const tokenizedClient = new EvernoteSDK.Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()
      // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
      const isWrappedFunction = freshNoteStore.getNote.length === 0 && 
        freshNoteStore.getNote.toString().includes('arguments.length')
      
      // SIMPLIFIED LOGIC: Only local wrapped functions are different
      const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
      const isLocalWrappedException = isLocal && isWrappedFunction
      
      const fullNote = isLocalWrappedException
        ? await freshNoteStore.getNote(noteGuid, true, true, false, false)                    // Local wrapped: no token, include resources
        : await freshNoteStore.getNote(this.accessToken, noteGuid, true, true, false, false)  // Everything else: use token, include resources
      
      console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} getNote logic`)
      const tagNames = await this.getTagNamesWithStore(freshNoteStore, fullNote.tagGuids || [])
      
      return {
        guid: fullNote.guid,
        title: fullNote.title,
        content: fullNote.content,
        tagNames,
        created: fullNote.created,
        updated: fullNote.updated,
        resources: fullNote.resources || []
      }
    } catch (error) {
      console.error('Error fetching note:', error)
      throw new Error('Failed to fetch note')
    }
  }

  private tagCache = new Map<string, string>()

  private async getTagNamesWithStore(noteStore: unknown, tagGuids: string[]): Promise<string[]> {
    if (!tagGuids || tagGuids.length === 0) return []
    
    try {
      const tagNames: string[] = []
      const uncachedGuids: string[] = []
      
      // Check cache first
      for (const guid of tagGuids) {
        const cachedName = this.tagCache.get(guid)
        if (cachedName) {
          tagNames.push(cachedName)
        } else {
          uncachedGuids.push(guid)
        }
      }
      
      // Fetch uncached tags with delay between requests
      for (let i = 0; i < uncachedGuids.length; i++) {
        const guid = uncachedGuids[i]
        
        // Add small delay between tag requests
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        try {
          // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
          const getTagFunc = (noteStore as { getTag: (...args: unknown[]) => unknown }).getTag
          const isWrappedFunction = getTagFunc.length === 0 && 
            getTagFunc.toString().includes('arguments.length')
          
          // SIMPLIFIED LOGIC: Only local wrapped functions are different
          const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
          const isLocalWrappedException = isLocal && isWrappedFunction
          
          const tag = isLocalWrappedException
            ? await (noteStore as { getTag: (guid: string) => Promise<{ name: string }> }).getTag(guid)                                // Local wrapped: no token
            : await (noteStore as { getTag: (token: string, guid: string) => Promise<{ name: string }> }).getTag(this.accessToken, guid)  // Everything else: use token
          
          console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} getTag logic`)
          this.tagCache.set(guid, tag.name)
          tagNames.push(tag.name)
        } catch (error) {
          console.error(`Failed to fetch tag ${guid}:`, error)
          // Continue with other tags
        }
      }
      
      return tagNames
    } catch (error) {
      console.error('Error fetching tags:', error)
      return []
    }
  }

  async getSyncState(): Promise<{ updateCount: number }> {
    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EvernoteSDK = require('evernote')
      const tokenizedClient = new EvernoteSDK.Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()
      // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
      const funcLength = freshNoteStore.getSyncState.length
      const funcSource = freshNoteStore.getSyncState.toString()
      const isWrappedFunction = funcLength === 0 && funcSource.includes('arguments.length')
      
      console.log(`getSyncState detection - length: ${funcLength}, isWrapped: ${isWrappedFunction}, source preview: "${funcSource.substring(0, 100)}"`)
      
      // SIMPLIFIED LOGIC: Only local wrapped functions are different
      const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
      const isLocalWrappedException = isLocal && isWrappedFunction
      
      const syncState = isLocalWrappedException
        ? await freshNoteStore.getSyncState()                    // Local wrapped: no token
        : await freshNoteStore.getSyncState(this.accessToken)    // Everything else: use token
      
      console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} logic`)
      
      return {
        updateCount: syncState.updateCount
      }
    } catch (error) {
      console.error('Error getting sync state:', error)
      // If we can't get sync state, assume we need to sync
      return { updateCount: -1 }
    }
  }

  async registerWebhook(notebookGuid: string): Promise<string | null> {
    // Webhook functionality is not supported in Evernote SDK v2.0.5
    // TODO: Implement direct API calls or upgrade SDK version
    console.log(`Webhook registration skipped for notebook ${notebookGuid} - not supported in current SDK`)
    return null
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
    // Webhook functionality is not supported in Evernote SDK v2.0.5
    console.log(`Webhook unregistration skipped for ${webhookId} - not supported in current SDK`)
    return true
  }

  async listWebhooks(): Promise<unknown[]> {
    // Webhook functionality is not supported in Evernote SDK v2.0.5
    console.log('Webhook listing skipped - not supported in current SDK')
    return []
  }

  async getAllNotesMetadata(notebookGuid: string, sinceDate?: Date): Promise<{ guid: string; tagGuids?: string[] }[]> {
    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EvernoteSDK = require('evernote')
      const tokenizedClient = new EvernoteSDK.Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()
      
      const filter: { notebookGuid: string; updated?: number } = {
        notebookGuid: notebookGuid
      }
      
      // Add date filter if provided to only get notes modified since last sync
      if (sinceDate) {
        filter.updated = Math.floor(sinceDate.getTime())
        console.log(`Filtering all notes metadata updated since: ${sinceDate.toISOString()}`)
      }
      
      const spec = {
        includeTitle: false,
        includeTagGuids: true,
        includeCreated: false,
        includeUpdated: false
      }
      
      // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
      const isWrappedFunction = freshNoteStore.findNotesMetadata.length === 0 && 
        freshNoteStore.findNotesMetadata.toString().includes('arguments.length')
      
      // SIMPLIFIED LOGIC: Only local wrapped functions are different
      const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
      const isLocalWrappedException = isLocal && isWrappedFunction
      
      const notesMetadata = isLocalWrappedException
        ? await freshNoteStore.findNotesMetadata(filter, 0, 250, spec)                    // Local wrapped: no token
        : await freshNoteStore.findNotesMetadata(this.accessToken, filter, 0, 250, spec)  // Everything else: use token
      
      console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} findNotesMetadata logic`)
      console.log(`Retrieved ${notesMetadata.notes.length} notes metadata for unpublish detection`)
      
      return notesMetadata.notes.map((note: { guid: string; tagGuids?: string[] }) => ({
        guid: note.guid,
        tagGuids: note.tagGuids || []
      }))
    } catch (error) {
      console.error('Error fetching all notes metadata:', error)
      throw new Error('Failed to fetch notes metadata for unpublish detection')
    }
  }

  async getTagNames(tagGuids: string[]): Promise<string[]> {
    if (!tagGuids || tagGuids.length === 0) return []
    
    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EvernoteSDK = require('evernote')
      const tokenizedClient = new EvernoteSDK.Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()
      return await this.getTagNamesWithStore(freshNoteStore, tagGuids)
    } catch (error) {
      console.error('Error fetching tag names:', error)
      return []
    }
  }

  isPublished(tagNames: string[]): boolean {
    return tagNames.some(tag => tag.toLowerCase() === 'published')
  }

  /**
   * Download resource data (image) from Evernote
   */
  async getResourceData(resourceGuid: string): Promise<Buffer | null> {
    try {
      // Create a fresh client with the access token
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const EvernoteSDK = require('evernote')
      const tokenizedClient = new EvernoteSDK.Client({
        consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
        consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
        sandbox: false,
        token: this.accessToken
      })
      
      // Use stored noteStoreUrl if available to avoid getUserUrls() call
      const freshNoteStore = this.noteStoreUrl 
        ? tokenizedClient.getNoteStore(this.noteStoreUrl)
        : tokenizedClient.getNoteStore()

      // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
      const getResourceDataFunc = (freshNoteStore as { getResourceData: (...args: unknown[]) => unknown }).getResourceData
      const isWrappedFunction = getResourceDataFunc.length === 0 && 
        getResourceDataFunc.toString().includes('arguments.length')
      
      // SIMPLIFIED LOGIC: Only local wrapped functions are different
      const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
      const isLocalWrappedException = isLocal && isWrappedFunction
      
      const resourceData = isLocalWrappedException
        ? await (freshNoteStore as { getResourceData: (guid: string) => Promise<Buffer> }).getResourceData(resourceGuid)                                // Local wrapped: no token
        : await (freshNoteStore as { getResourceData: (token: string, guid: string) => Promise<Buffer> }).getResourceData(this.accessToken, resourceGuid)  // Everything else: use token
      
      console.log(`Downloaded resource ${resourceGuid} (${resourceData.length} bytes)`)
      return resourceData
    } catch (error) {
      console.error(`Error downloading resource ${resourceGuid}:`, error)
      return null
    }
  }

  private async getCurrentEvernoteAccountId(noteStore: unknown): Promise<string | null> {
    try {
      // Get current user info to identify the Evernote account
      // Detect if we're dealing with wrapped functions (local dev) vs normal functions (production)
      const getUserFunc = (noteStore as { getUser: (...args: unknown[]) => unknown }).getUser
      
      if (!getUserFunc) {
        console.error('getCurrentEvernoteAccountId: getUser method not found on noteStore')
        return null
      }
      
      const isWrappedFunction = getUserFunc.length === 0 && 
        getUserFunc.toString().includes('arguments.length')
      
      // SIMPLIFIED LOGIC: Only local wrapped functions are different
      const isLocal = !process.env.VERCEL && !process.env.VERCEL_ENV
      const isLocalWrappedException = isLocal && isWrappedFunction
      
      const user = isLocalWrappedException
        ? await (noteStore as { getUser: () => Promise<{ id: number }> }).getUser()                      // Local wrapped: no token
        : await (noteStore as { getUser: (token: string) => Promise<{ id: number }> }).getUser(this.accessToken)  // Everything else: use token
      
      console.log(`Using ${isLocalWrappedException ? 'local wrapped (no token)' : 'standard (with token)'} getUser logic`)
      return user.id.toString()
    } catch (error) {
      console.error('Failed to get Evernote account ID:', error)
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
      return null
    }
  }
}

export function getEvernoteAuthUrl(userToken?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.env.EVERNOTE_CONSUMER_KEY || !process.env.EVERNOTE_CONSUMER_SECRET) {
      reject(new Error('Evernote API credentials not configured'))
      return
    }

    if (process.env.EVERNOTE_CONSUMER_KEY === 'your-evernote-consumer-key') {
      reject(new Error('Please configure valid Evernote API credentials'))
      return
    }

    try {
      // Build callback URL using the same logic as the auth system
      const baseUrl = getBaseUrl()
      
      const callbackUrl = `${baseUrl}/api/evernote/oauth-callback${userToken ? `?token=${encodeURIComponent(userToken)}` : ''}`
      console.log('Using Evernote callback URL:', callbackUrl)
      
      client.getRequestToken(
        callbackUrl,
        (error: Error | null, oauthToken: string, oauthTokenSecret?: string) => {
          if (error) {
            console.error('Error getting request token:', error)
            const errorMessage = error.message || error.toString() || 'Unknown error'
            const errorCode = (error as { code?: string }).code
            const statusCode = (error as { statusCode?: number; status?: number }).statusCode || (error as { statusCode?: number; status?: number }).status
            
            if (errorMessage.includes('ENOTFOUND') || errorCode === 'ENOTFOUND') {
              reject(new Error('Unable to connect to Evernote. Please check your internet connection.'))
            } else if (errorMessage.includes('unauthorized') || statusCode === 401) {
              reject(new Error('Invalid Evernote API credentials. Please check your consumer key and secret.'))
            } else if (statusCode === 404) {
              reject(new Error('Evernote API endpoint not found. Please check your API configuration.'))
            } else {
              reject(new Error(`Failed to connect to Evernote: ${errorMessage} (Code: ${errorCode || statusCode || 'unknown'})`))
            }
            return
          }
          
          if (!oauthTokenSecret) {
            reject(new Error('Missing token secret from Evernote'))
            return
          }
          
          storeTokenSecret(oauthToken, oauthTokenSecret).then(() => {
            const authUrl = client.getAuthorizeUrl(oauthToken)
            resolve(authUrl)
          }).catch(error => {
            console.error('Error storing token secret:', error)
            reject(new Error('Failed to store OAuth token'))
          })
        }
      )
    } catch (error) {
      console.error('Error in getEvernoteAuthUrl:', error)
      reject(new Error('Failed to generate Evernote auth URL'))
    }
  })
}

export function getEvernoteAccessToken(oauthToken: string, oauthVerifier: string): Promise<{ token: string; secret: string; noteStoreUrl?: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const tokenSecret = await getTokenSecret(oauthToken)
      if (!tokenSecret) {
        reject(new Error('Token secret not found. Please restart the authentication process.'))
        return
      }

      client.getAccessToken(
        oauthToken,
        tokenSecret,
        oauthVerifier,
        (error: Error | null, accessToken: string, accessTokenSecret: string, results?: { edam_noteStoreUrl?: string }) => {
          if (error) {
            console.error('Error getting access token:', error)
            reject(error)
            return
          }
          
          removeToken().catch(error => {
            console.error('Error removing token:', error)
          })
          
          let noteStoreUrl: string | undefined
          if (results && results.edam_noteStoreUrl) {
            noteStoreUrl = results.edam_noteStoreUrl
          }
          
          resolve({
            token: accessToken,
            secret: accessTokenSecret,
            noteStoreUrl
          })
        }
      )
    } catch (error) {
      console.error('Error in getEvernoteAccessToken:', error)
      reject(new Error('Failed to get access token'))
    }
  })
}