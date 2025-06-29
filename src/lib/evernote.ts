import { Evernote } from 'evernote'

const client = new Evernote.Client({
  consumerKey: process.env.EVERNOTE_CONSUMER_KEY!,
  consumerSecret: process.env.EVERNOTE_CONSUMER_SECRET!,
  sandbox: process.env.EVERNOTE_SANDBOX === 'true',
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
  private noteStore: any

  constructor(private accessToken: string) {
    this.noteStore = client.getNoteStore(accessToken)
  }

  async getNotebooks(): Promise<EvernoteNotebook[]> {
    try {
      const notebooks = await this.noteStore.listNotebooks()
      return notebooks.map((notebook: any) => ({
        guid: notebook.guid,
        name: notebook.name,
      }))
    } catch (error) {
      console.error('Error fetching notebooks:', error)
      throw new Error('Failed to fetch notebooks')
    }
  }

  async getNotesFromNotebook(notebookGuid: string): Promise<EvernoteNote[]> {
    try {
      const filter = new Evernote.NoteFilter()
      filter.notebookGuid = notebookGuid
      
      const spec = new Evernote.NotesMetadataResultSpec()
      spec.includeTitle = true
      spec.includeTagGuids = true
      spec.includeCreated = true
      spec.includeUpdated = true
      
      const notesMetadata = await this.noteStore.findNotesMetadata(filter, 0, 100, spec)
      
      const notes: EvernoteNote[] = []
      
      for (const metadata of notesMetadata.notes) {
        const fullNote = await this.noteStore.getNote(metadata.guid, true, false, false, false)
        const tagNames = await this.getTagNames(metadata.tagGuids || [])
        
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
      throw new Error('Failed to fetch notes')
    }
  }

  async getNote(noteGuid: string): Promise<EvernoteNote> {
    try {
      const fullNote = await this.noteStore.getNote(noteGuid, true, false, false, false)
      const tagNames = await this.getTagNames(fullNote.tagGuids || [])
      
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

  private async getTagNames(tagGuids: string[]): Promise<string[]> {
    if (!tagGuids || tagGuids.length === 0) return []
    
    try {
      const tags = await Promise.all(
        tagGuids.map(guid => this.noteStore.getTag(guid))
      )
      return tags.map(tag => tag.name)
    } catch (error) {
      console.error('Error fetching tags:', error)
      return []
    }
  }

  isPublished(tagNames: string[]): boolean {
    return tagNames.some(tag => tag.toLowerCase() === 'published')
  }
}

export function getEvernoteAuthUrl(): string {
  return client.getRequestToken(
    `${process.env.APP_URL}/api/evernote/callback`,
    (error: any, oauthToken: string, oauthTokenSecret: string, results: any) => {
      if (error) {
        console.error('Error getting request token:', error)
        throw error
      }
      return client.getAuthorizeUrl(oauthToken)
    }
  )
}