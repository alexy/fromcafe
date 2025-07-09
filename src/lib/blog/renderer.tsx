import { prisma } from '@/lib/prisma'
import { Metadata } from 'next'
import { themes } from '@/lib/themes/registry'
import { processCaptionsServerSide } from '@/lib/server-caption-processor'

// Shared blog query types
export interface BlogQuery {
  // For path-based blogs
  userSlug?: string
  blogSlug?: string
  // For subdomain blogs
  subdomain?: string
  // For custom domain blogs
  customDomain?: string
}

export interface PostQuery extends BlogQuery {
  postSlug: string
}

// Shared blog data fetching
export async function fetchBlogData(query: BlogQuery, tagSlug?: string) {
  const whereClause: {
    isPublic: boolean
    subdomain?: string
    urlFormat?: string
    customDomain?: string
    slug?: string
    user?: { slug: string }
  } = {
    isPublic: true
  }

  if (query.subdomain) {
    // Subdomain blog
    whereClause.subdomain = query.subdomain
    whereClause.urlFormat = 'subdomain'
  } else if (query.customDomain) {
    // Custom domain blog
    whereClause.customDomain = query.customDomain
    whereClause.urlFormat = 'custom'
  } else if (query.userSlug && query.blogSlug) {
    // Path-based blog
    whereClause.slug = query.blogSlug
    whereClause.user = { slug: query.userSlug }
  } else {
    return null
  }

  const blog = await prisma.blog.findFirst({
    where: whereClause,
    include: {
      user: true,
      posts: {
        where: {
          isPublished: true,
          ...(tagSlug && tagSlug !== 'all' ? {
            postTags: {
              some: {
                tag: {
                  slug: tagSlug
                }
              }
            }
          } : {})
        },
        orderBy: { publishedAt: 'desc' },
        include: {
          postTags: {
            include: {
              tag: true
            }
          }
        }
      }
    }
  })

  if (!blog || !blog.user.isActive) {
    return null
  }

  return blog
}

export async function fetchPostData(query: PostQuery) {
  const whereClause: {
    slug: string
    isPublished: boolean
    blog?: {
      subdomain?: string
      urlFormat?: string
      isPublic?: boolean
      customDomain?: string
      slug?: string
      user?: { slug: string }
    }
  } = {
    slug: query.postSlug,
    isPublished: true
  }

  if (query.subdomain) {
    // Subdomain blog
    whereClause.blog = {
      subdomain: query.subdomain,
      urlFormat: 'subdomain',
      isPublic: true
    }
  } else if (query.customDomain) {
    // Custom domain blog
    whereClause.blog = {
      customDomain: query.customDomain,
      urlFormat: 'custom',
      isPublic: true
    }
  } else if (query.userSlug && query.blogSlug) {
    // Path-based blog
    whereClause.blog = {
      slug: query.blogSlug,
      user: { slug: query.userSlug },
      isPublic: true
    }
  } else {
    return null
  }

  const post = await prisma.post.findFirst({
    where: whereClause,
    include: { 
      blog: { 
        include: { user: true } 
      },
      postTags: {
        include: {
          tag: true
        }
      }
    }
  })

  if (!post || !post.blog.user.isActive) {
    return null
  }

  return post
}

// Type definitions for blog and post data
interface BlogData {
  title: string
  description?: string | null
  user: {
    displayName?: string | null
  }
}

interface PostData {
  title: string
  excerpt?: string | null
  blog: {
    title: string
  }
}

// Shared metadata generation
export function generateBlogMetadata(blog: BlogData): Metadata {
  return {
    title: `${blog.title} - ${blog.user.displayName || 'FromCafe'}`,
    description: blog.description || `${blog.title} blog`
  }
}

export function generatePostMetadata(post: PostData): Metadata {
  return {
    title: `${post.title} - ${post.blog.title}`,
    description: post.excerpt || `${post.title} from ${post.blog.title}`
  }
}

// Type definitions for rendering components
interface BlogWithPosts {
  id: string
  title: string
  description?: string | null
  slug: string
  author?: string | null
  customDomain?: string | null
  theme: string
  isPublic: boolean
  showCameraMake?: boolean
  createdAt: Date
  updatedAt: Date
  user: {
    slug?: string | null
  }
  posts: Array<{
    id: string
    title: string
    content: string
    excerpt?: string | null
    slug: string
    isPublished: boolean
    publishedAt: Date | null
    createdAt: Date
    updatedAt: Date
    postTags: Array<{
      tag: {
        id: string
        name: string
        slug: string
      }
    }>
  }>
}

interface PostWithBlog {
  id: string
  title: string
  content: string
  excerpt?: string | null
  slug: string
  isPublished: boolean
  publishedAt: Date | null
  createdAt: Date
  updatedAt: Date
  postTags: Array<{
    tag: {
      id: string
      name: string
      slug: string
    }
  }>
  blog: {
    id: string
    title: string
    description?: string | null
    slug: string
    author?: string | null
    customDomain?: string | null
    theme: string
    isPublic: boolean
    showCameraMake?: boolean
    createdAt: Date
    updatedAt: Date
    user: {
      slug?: string | null
    }
  }
}

// Shared rendering components
interface BlogRendererProps {
  blog: BlogWithPosts
  hostname: string
  currentTag?: string
}

interface PostRendererProps {
  post: PostWithBlog
  hostname: string
}

export function BlogRenderer({ blog, hostname, currentTag }: BlogRendererProps) {
  // Get theme component
  const ThemeComponent = themes[blog.theme as keyof typeof themes]?.components.BlogLayout || themes.default.components.BlogLayout

  // Type-safe props with null to undefined conversion
  const blogProps = {
    id: blog.id,
    title: blog.title,
    description: blog.description ?? undefined,
    slug: blog.slug,
    author: blog.author ?? undefined,
    customDomain: blog.customDomain ?? undefined,
    theme: blog.theme,
    isPublic: blog.isPublic,
    showCameraMake: blog.showCameraMake ?? false,
    createdAt: blog.createdAt,
    updatedAt: blog.updatedAt,
    userSlug: blog.user.slug ?? undefined
  }

  const postsProps = blog.posts.map((post) => ({
    id: post.id,
    title: post.title,
    content: post.content,
    excerpt: post.excerpt ?? undefined,
    slug: post.slug,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    blogSlug: blog.slug,
    userSlug: blog.user.slug ?? undefined,
    tags: post.postTags.map(pt => ({
      id: pt.tag.id,
      name: pt.tag.name,
      slug: pt.tag.slug
    }))
  }))

  return (
    <ThemeComponent
      blog={blogProps}
      posts={postsProps}
      hostname={hostname}
      currentTag={currentTag}
    />
  )
}

export function PostRenderer({ post, hostname }: PostRendererProps) {
  // Get theme component
  const ThemeComponent = themes[post.blog.theme as keyof typeof themes]?.components.PostLayout || themes.default.components.PostLayout

  // Process captions server-side based on blog settings
  const processedContent = processCaptionsServerSide(post.content, post.blog.showCameraMake ?? false)

  // Type-safe props with null to undefined conversion
  const postProps = {
    id: post.id,
    title: post.title,
    content: processedContent,
    excerpt: post.excerpt ?? undefined,
    slug: post.slug,
    isPublished: post.isPublished,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    blogSlug: post.blog.slug,
    userSlug: post.blog.user.slug ?? undefined,
    tags: post.postTags.map(pt => ({
      id: pt.tag.id,
      name: pt.tag.name,
      slug: pt.tag.slug
    }))
  }

  const blogProps = {
    id: post.blog.id,
    title: post.blog.title,
    description: post.blog.description ?? undefined,
    slug: post.blog.slug,
    author: post.blog.author ?? undefined,
    customDomain: post.blog.customDomain ?? undefined,
    theme: post.blog.theme,
    isPublic: post.blog.isPublic,
    showCameraMake: post.blog.showCameraMake ?? false,
    createdAt: post.blog.createdAt,
    updatedAt: post.blog.updatedAt,
    userSlug: post.blog.user.slug ?? undefined
  }

  return (
    <ThemeComponent
      post={postProps}
      blog={blogProps}
      hostname={hostname}
    />
  )
}