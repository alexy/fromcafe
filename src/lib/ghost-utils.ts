import { prisma } from '@/lib/prisma'

/**
 * Normalize post ID from UUID format to Ghost post ID
 * Converts '4beae860-16c9-03d2-08c8-76c1000000000000' to '4beae86016c903d208c876c1'
 */
export function normalizePostId(postId: string): string {
  // If it's already a clean 24-char Ghost ID, return as-is
  if (postId.length === 24 && !postId.includes('-')) {
    return postId
  }
  
  // If it's a UUID format with hyphens, remove them and truncate to 24 chars
  if (postId.includes('-')) {
    return postId.replace(/-/g, '').substring(0, 24)
  }
  
  return postId
}

/**
 * Generate slug from title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/**
 * Ensure unique slug for the blog
 */
export async function ensureUniqueSlug(
  baseSlug: string, 
  blogId: string, 
  excludePostId?: string
): Promise<string> {
  let slug = baseSlug
  let counter = 1

  while (true) {
    const existingPost = await prisma.post.findFirst({
      where: {
        blogId,
        slug,
        ...(excludePostId && { id: { not: excludePostId } })
      }
    })

    if (!existingPost) {
      return slug
    }

    slug = `${baseSlug}-${counter}`
    counter++
  }
}