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
      getAccessToken(token: string, tokenSecret: string, verifier: string, callback: (error: Error | null, accessToken: string, accessTokenSecret: string) => void): void
      getAuthorizeUrl(token: string): string
    }
    
    interface NoteStore {
      listNotebooks(): Promise<Notebook[]>
      findNotesMetadata(filter: NoteFilter, offset: number, maxNotes: number, spec: NotesMetadataResultSpec): Promise<NotesMetadataList>
      getNote(guid: string, withContent: boolean, withResourcesData: boolean, withResourcesRecognition: boolean, withResourcesAlternateData: boolean): Promise<Note>
      getNote(token: string, guid: string, withContent: boolean, withResourcesData: boolean, withResourcesRecognition: boolean, withResourcesAlternateData: boolean): Promise<Note>
      getResource(guid: string, withData: boolean, withRecognition: boolean, withAttributes: boolean, withAlternateData: boolean): Promise<Resource>
      getResource(token: string, guid: string, withData: boolean, withRecognition: boolean, withAttributes: boolean, withAlternateData: boolean): Promise<Resource>
      getTag(guid: string): Promise<Tag>
      getSyncState(): Promise<{ updateCount: number }>
      getSyncState(token: string): Promise<{ updateCount: number }>
      listTags(): Promise<Tag[]>
      listTags(token: string): Promise<Tag[]>
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
      resources?: Resource[]
    }
    
    interface Resource {
      guid: string
      data: {
        bodyHash: string
        size: number
        body?: Buffer
      }
      mime: string
      width?: number
      height?: number
      attributes?: {
        filename?: string
        attachment?: boolean
      }
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