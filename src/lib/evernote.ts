import * as Evernote from 'evernote'
import { storeTokenSecret, getTokenSecret, removeToken } from './evernote-session'

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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      
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

  async getNotesFromNotebook(notebookGuid: string): Promise<EvernoteNote[]> {
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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      
      const filter = {
        notebookGuid: notebookGuid
      }
      
      const spec = {
        includeTitle: true,
        includeTagGuids: true,
        includeCreated: true,
        includeUpdated: true
      }
      
      const notesMetadata = await freshNoteStore.findNotesMetadata(filter, 0, 100, spec)
      
      const notes: EvernoteNote[] = []
      
      for (const metadata of notesMetadata.notes) {
        const fullNote = await freshNoteStore.getNote(metadata.guid, true, false, false, false)
        const tagNames = await this.getTagNamesWithStore(freshNoteStore, metadata.tagGuids || [])
        
        notes.push({
          guid: fullNote.guid,
          title: fullNote.title,
          content: fullNote.content,
          tagNames,
          created: fullNote.created,
          updated: fullNote.updated,
        })
      }
      
      return notes
    } catch (error) {
      console.error('Error fetching notes:', error)
      
      // Handle rate limiting specifically
      if (error && typeof error === 'object' && 'errorCode' in error && error.errorCode === 19) {
        const rateLimitDuration = (error as { rateLimitDuration?: number }).rateLimitDuration || 0
        const waitMinutes = Math.ceil(rateLimitDuration / 60)
        throw new Error(`Evernote API rate limit exceeded. Please wait ${waitMinutes} minutes before trying again.`)
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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      const fullNote = await freshNoteStore.getNote(noteGuid, true, false, false, false)
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

  private async getTagNamesWithStore(noteStore: unknown, tagGuids: string[]): Promise<string[]> {
    if (!tagGuids || tagGuids.length === 0) return []
    
    try {
      const tags = await Promise.all(
        tagGuids.map(guid => (noteStore as { getTag: (guid: string) => Promise<{ name: string }> }).getTag(guid))
      )
      return tags.map(tag => tag.name)
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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      const syncState = await freshNoteStore.getSyncState()
      
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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      
      const webhookUrl = `${process.env.APP_URL}/api/evernote/webhook`
      
      // Register webhook for this specific notebook
      const webhook = await freshNoteStore.createWebhook({
        url: webhookUrl,
        filter: {
          notebookGuid: notebookGuid
        }
      })
      
      console.log(`Webhook registered for notebook ${notebookGuid}: ${webhook.id}`)
      return webhook.id
      
    } catch (error) {
      console.error('Error registering webhook:', error)
      return null
    }
  }

  async unregisterWebhook(webhookId: string): Promise<boolean> {
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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      
      await freshNoteStore.expungeWebhook(webhookId)
      console.log(`Webhook unregistered: ${webhookId}`)
      return true
      
    } catch (error) {
      console.error('Error unregistering webhook:', error)
      return false
    }
  }

  async listWebhooks(): Promise<unknown[]> {
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
      
      const freshNoteStore = tokenizedClient.getNoteStore()
      
      const webhooks = await freshNoteStore.listWebhooks()
      return webhooks || []
      
    } catch (error) {
      console.error('Error listing webhooks:', error)
      return []
    }
  }

  isPublished(tagNames: string[]): boolean {
    return tagNames.some(tag => tag.toLowerCase() === 'published')
  }
}

export function getEvernoteAuthUrl(): Promise<string> {
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
      client.getRequestToken(
        `${process.env.APP_URL}/api/evernote/callback`,
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
          
          storeTokenSecret(oauthToken, oauthTokenSecret)
          const authUrl = client.getAuthorizeUrl(oauthToken)
          resolve(authUrl)
        }
      )
    } catch (error) {
      console.error('Error in getEvernoteAuthUrl:', error)
      reject(new Error('Failed to generate Evernote auth URL'))
    }
  })
}

export function getEvernoteAccessToken(oauthToken: string, oauthVerifier: string): Promise<{ token: string; secret: string; noteStoreUrl?: string }> {
  return new Promise((resolve, reject) => {
    try {
      const tokenSecret = getTokenSecret(oauthToken)
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
          
          removeToken(oauthToken)
          
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