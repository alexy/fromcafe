import * as Evernote from 'evernote'
import { storeTokenSecret, getTokenSecret, removeToken } from './evernote-session'

// Helper function to get the correct base URL (prioritizes actual deployment URL)
function getBaseUrl(): string {
  // For Vercel deployments, always use the actual VERCEL_URL (preview or production)
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  
  // Use NEXTAUTH_URL if explicitly set and not on Vercel
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL
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
}

export interface EvernoteNotebook {
  guid: string
  name: string
}

export class EvernoteService {
  constructor(private accessToken: string, private noteStoreUrl?: string) {
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
      
      // Try both approaches: with and without the auth token parameter
      let notebooks
      try {
        // Approach 1: Pass auth token as parameter
        notebooks = await freshNoteStore.listNotebooks(this.accessToken)
      } catch {
        // Approach 2: Use client's built-in token
        notebooks = await freshNoteStore.listNotebooks()
      }
      
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
      try {
        console.log('Finding "published" tag...')
        const tags = await freshNoteStore.listTags(this.accessToken)
        const publishedTag = tags.find((tag: { name: string }) => 
          tag.name.toLowerCase() === 'published'
        )
        if (publishedTag) {
          publishedTagGuid = publishedTag.guid
          console.log(`Found "published" tag with GUID: ${publishedTagGuid}`)
        } else {
          console.log('No "published" tag found - will check all notes')
        }
      } catch (tagError) {
        console.warn('Could not fetch tags, falling back to checking all notes:', tagError)
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
      
      const notesMetadata = await freshNoteStore.findNotesMetadata(this.accessToken, filter, 0, Math.min(maxNotes, 50), spec)
      console.log(`Found ${notesMetadata.notes.length} notes to process (${publishedTagGuid ? 'pre-filtered by published tag' : 'will filter during processing'})`)
      
      const notes: EvernoteNote[] = []
      
      // Process notes with rate limiting - add delay between requests
      for (let i = 0; i < notesMetadata.notes.length; i++) {
        const metadata = notesMetadata.notes[i]
        
        // Add delay between API calls to avoid rate limits (except for first note)
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 200)) // Reduced to 200ms since we're processing fewer notes
        }
        
        try {
          // OPTIMIZATION: Get tag names first to check if published (avoid expensive getNote call)
          const tagNames = await this.getTagNamesWithStore(freshNoteStore, metadata.tagGuids || [])
          
          // Skip notes without "published" tag (if we couldn't filter at API level)
          if (!publishedTagGuid && !this.isPublished(tagNames)) {
            console.log(`Skipping non-published note: ${metadata.title || 'Untitled'}`)
            continue
          }
          
          // Only fetch full note content for published notes
          const fullNote = await freshNoteStore.getNote(this.accessToken, metadata.guid, true, false, false, false)
          
          notes.push({
            guid: fullNote.guid,
            title: fullNote.title,
            content: fullNote.content,
            tagNames,
            created: fullNote.created,
            updated: fullNote.updated,
          })
          
          console.log(`Processed published note ${notes.length}: "${fullNote.title}"`)
        } catch (noteError) {
          console.error(`Failed to process note ${metadata.guid}:`, noteError)
          // Continue with next note instead of failing entire sync
        }
      }
      
      console.log(`Found ${notes.length} published notes out of ${notesMetadata.notes.length} total notes`)
      return notes
    } catch (error) {
      console.error('Error fetching notes:', error)
      
      // Handle rate limiting specifically
      if (error && typeof error === 'object' && 'errorCode' in error && error.errorCode === 19) {
        const rateLimitDuration = (error as { rateLimitDuration?: number }).rateLimitDuration || 3600 // Default 1 hour
        const waitMinutes = Math.ceil(rateLimitDuration / 60)
        console.error(`Rate limit hit. Duration: ${rateLimitDuration}s (${waitMinutes} minutes)`)
        throw new Error(`Evernote API rate limit exceeded. The sync will automatically retry in ${waitMinutes} minutes. This is normal for first-time syncs with many notes.`)
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
      const fullNote = await freshNoteStore.getNote(this.accessToken, noteGuid, true, false, false, false)
      const tagNames = await this.getTagNamesWithStore(freshNoteStore, fullNote.tagGuids || [])
      
      return {
        guid: fullNote.guid,
        title: fullNote.title,
        content: fullNote.content,
        tagNames,
        created: fullNote.created,
        updated: fullNote.updated,
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
          const tag = await (noteStore as { getTag: (token: string, guid: string) => Promise<{ name: string }> }).getTag(this.accessToken, guid)
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
      const syncState = await freshNoteStore.getSyncState(this.accessToken)
      
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
      
      const notesMetadata = await freshNoteStore.findNotesMetadata(this.accessToken, filter, 0, 250, spec)
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