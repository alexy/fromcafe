export interface BlogData {
  id: string
  title: string
  description: string | null
  slug: string
  customDomain: string | null
  theme: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  tenantSlug?: string
  posts?: PostData[]
}

export interface PostData {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  publishedAt: Date | null
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  blogSlug: string
  tenantSlug?: string
}

export interface ThemeProps {
  blog: BlogData
  posts?: PostData[]
  post?: PostData
}

export interface BlogThemeProps {
  blog: Omit<BlogData, 'posts'>
  posts: PostData[]
}

export interface PostThemeProps {
  blog: Omit<BlogData, 'posts'>
  post: PostData
}

export interface Theme {
  id: string
  name: string
  description: string
  preview: string // URL to preview image
  components: {
    BlogLayout: React.ComponentType<BlogThemeProps>
    PostLayout: React.ComponentType<PostThemeProps>
  }
  config?: {
    colors?: {
      primary?: string
      secondary?: string
      background?: string
      text?: string
    }
    fonts?: {
      heading?: string
      body?: string
    }
    layout?: {
      maxWidth?: string
      spacing?: string
    }
  }
}

export interface ThemeRegistry {
  [key: string]: Theme
}