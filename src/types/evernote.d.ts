declare module 'evernote' {
  namespace Evernote {
    class Client {
      constructor(options: {
        consumerKey: string
        consumerSecret: string
        sandbox?: boolean
      })
      
      getNoteStore(token: string): NoteStore
      getRequestToken(callbackUrl: string, callback: (error: Error | null, token: string, tokenSecret?: string, results?: unknown) => void): string
      getAuthorizeUrl(token: string): string
    }
    
    interface NoteStore {
      listNotebooks(): Promise<Notebook[]>
      findNotesMetadata(filter: NoteFilter, offset: number, maxNotes: number, spec: NotesMetadataResultSpec): Promise<NotesMetadataList>
      getNote(guid: string, withContent: boolean, withResourcesData: boolean, withResourcesRecognition: boolean, withResourcesAlternateData: boolean): Promise<Note>
      getTag(guid: string): Promise<Tag>
    }
    
    interface Notebook {
      guid: string
      name: string
    }
    
    interface Note {
      guid: string
      title: string
      content: string
      tagGuids?: string[]
      created: number
      updated: number
    }
    
    interface Tag {
      name: string
    }
    
    class NoteFilter {
      notebookGuid?: string
    }
    
    class NotesMetadataResultSpec {
      includeTitle?: boolean
      includeTagGuids?: boolean
      includeCreated?: boolean
      includeUpdated?: boolean
    }
    
    interface NotesMetadataList {
      notes: Array<{
        guid: string
        tagGuids?: string[]
      }>
    }
  }
  
  export = Evernote
}