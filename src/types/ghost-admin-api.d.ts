declare module '@tryghost/admin-api' {
  interface GhostAdminAPIConfig {
    url: string
    key: string
    version?: string
  }

  interface GhostPost {
    id: string
    uuid: string
    title: string
    slug: string
    html: string
    plaintext: string
    excerpt: string
    status: string
    visibility: string
    created_at: string
    updated_at: string
    published_at: string | null
    url: string
    reading_time: number
    authors: Array<{
      id: string
      name: string
      slug: string
    }>
    tags: Array<{
      id: string
      name: string
      slug: string
    }>
  }

  interface GhostSite {
    title: string
    description: string
    url: string
  }

  interface PostsAPI {
    browse(options?: {
      include?: string[]
      filter?: string
      order?: string
      limit?: string | number
    }): Promise<GhostPost[]>
    
    read(identifier: { id: string } | { slug: string }, options?: {
      include?: string[]
    }): Promise<GhostPost>
  }

  interface SiteAPI {
    read(): Promise<GhostSite>
  }

  class GhostAdminAPI {
    constructor(config: GhostAdminAPIConfig)
    posts: PostsAPI
    site: SiteAPI
  }

  export = GhostAdminAPI
}