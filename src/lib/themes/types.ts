export interface BlogData {
  id: string
  title: string
  description: string | null | undefined
  slug: string
  author?: string
  customDomain: string | null | undefined
  theme: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  userSlug?: string
  posts?: PostData[]
}

export interface PostData {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null | undefined
  publishedAt: Date | null
  isPublished: boolean
  createdAt: Date
  updatedAt: Date
  blogSlug: string
  userSlug?: string
  tags?: Array<{
    id: string
    name: string
    slug: string
  }>
}

export interface ThemeProps {
  blog: BlogData
  posts?: PostData[]
  post?: PostData
}

export interface BlogThemeProps {
  blog: Omit<BlogData, 'posts'>
  posts: PostData[]
  hostname?: string
  currentTag?: string
}

export interface PostThemeProps {
  blog: Omit<BlogData, 'posts'>
  post: PostData
  hostname?: string
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