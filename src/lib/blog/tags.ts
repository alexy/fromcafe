import { prisma } from '@/lib/prisma'
import { ContentSource } from '@prisma/client'

export async function ensureDefaultTags(blogId: string) {
  const defaultTags = [
    { name: 'evernote', slug: 'evernote' },
    { name: 'ghost', slug: 'ghost' }
  ]

  const existingTags = await prisma.tag.findMany({
    where: {
      blogId,
      slug: {
        in: defaultTags.map(tag => tag.slug)
      }
    }
  })

  const existingSlugs = existingTags.map(tag => tag.slug)
  const tagsToCreate = defaultTags.filter(tag => !existingSlugs.includes(tag.slug))

  if (tagsToCreate.length > 0) {
    await prisma.tag.createMany({
      data: tagsToCreate.map(tag => ({
        blogId,
        name: tag.name,
        slug: tag.slug,
        description: `Posts from ${tag.name}`,
        visibility: 'public'
      }))
    })
  }

  return await prisma.tag.findMany({
    where: {
      blogId,
      slug: {
        in: defaultTags.map(tag => tag.slug)
      }
    }
  })
}

export async function tagPostBySource(postId: string, contentSource: ContentSource) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { blog: true }
  })

  if (!post) return

  // Ensure default tags exist
  const tags = await ensureDefaultTags(post.blogId)
  
  // Find the appropriate tag based on content source
  const tagSlug = contentSource === ContentSource.EVERNOTE ? 'evernote' : 'ghost'
  const tag = tags.find(t => t.slug === tagSlug)
  
  if (!tag) return

  // Check if the post already has this tag
  const existingPostTag = await prisma.postTag.findUnique({
    where: {
      postId_tagId: {
        postId,
        tagId: tag.id
      }
    }
  })

  if (!existingPostTag) {
    await prisma.postTag.create({
      data: {
        postId,
        tagId: tag.id
      }
    })
  }
}

export async function getPostsByTag(blogId: string, tagSlug?: string) {
  const whereClause: any = {
    blogId,
    isPublished: true
  }

  if (tagSlug && tagSlug !== 'all') {
    whereClause.postTags = {
      some: {
        tag: {
          slug: tagSlug
        }
      }
    }
  }

  return await prisma.post.findMany({
    where: whereClause,
    orderBy: { publishedAt: 'desc' },
    include: {
      postTags: {
        include: {
          tag: true
        }
      }
    }
  })
}