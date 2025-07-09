import { PrismaClient } from '@prisma/client'

// Extract the inner PRISMA_DATABASE_URL from DIRECT_URL by evaluating it
const directUrl = process.env.DIRECT_URL || ''
let extractedUrl = process.env.PRISMA_DATABASE_URL

// If DIRECT_URL exists, eval it to get PRISMA_DATABASE_URL
if (directUrl) {
  try {
    eval(directUrl)
    // After eval, PRISMA_DATABASE_URL should be set in the environment
    extractedUrl = process.env.PRISMA_DATABASE_URL
  } catch (error) {
    console.error('Error evaluating DIRECT_URL:', error)
  }
}

console.log('Using database URL:', extractedUrl)

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlfa2V5IjoiMDFKWVlSUzYzQUM1Rk4wMUtGVlFIWjA4VkciLCJ0ZW5hbnRfaWQiOiIyMmQzZjkxNjQ1ZjdmYTUyMmQ3M2ZhNDgwNmJiYjZkYjk1NzIxMjgxYjcxYjNhODY0MmM4ODgyZGE3ZmMzY2Q5IiwiaW50ZXJuYWxfc2VjcmV0IjoiYThmNmM3OGMtY2E0NS00ZjBkLWE4MjQtZDU0MzRlNzljNjAyIn0.sZzumPnNfz9k6Jrn4pf3uxR1_Xas5LgjEch_xDzQq2o"
    }
  }
})

/**
 * Targeted migration for the road-trip-june-25 post
 */
async function migrateRoadTripPost() {
  console.log('Connecting to remote database...')
  console.log('DIRECT_URL:', process.env.DIRECT_URL ? 'Set' : 'Not set')
  console.log('Extracted URL:', extractedUrl)
  
  // First, let's prove we're connected to the remote database
  const allPosts = await prisma.post.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      blog: {
        select: {
          slug: true,
          title: true,
          showCameraMake: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })
  
  console.log(`Found ${allPosts.length} posts in remote database:`)
  allPosts.forEach((post, index) => {
    console.log(`${index + 1}. "${post.title}" (${post.slug}) - Blog: ${post.blog.title}`)
  })
  
  // Look for the specific post
  const roadTripPost = allPosts.find(p => p.slug.includes('road-trip') || p.slug.includes('june'))
  
  if (!roadTripPost) {
    console.log('❌ Road trip post not found in recent posts')
    
    // Search more broadly
    const searchResults = await prisma.post.findMany({
      where: {
        OR: [
          { slug: { contains: 'road' } },
          { slug: { contains: 'trip' } },
          { slug: { contains: 'june' } },
          { title: { contains: 'road', mode: 'insensitive' } },
          { title: { contains: 'trip', mode: 'insensitive' } },
          { content: { contains: 'Laguna Beach' } },
          { content: { contains: 'Alexandra and Anna-Sophia' } },
          { content: { contains: 'Leica Camera AG' } }
        ]
      },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        blog: {
          select: {
            slug: true,
            title: true,
            showCameraMake: true
          }
        }
      }
    })
    
    console.log(`\nSearch results for road/trip/june/Laguna Beach:`)
    searchResults.forEach((post, index) => {
      console.log(`${index + 1}. "${post.title}" (${post.slug}) - Blog: ${post.blog.title}`)
      if (post.content.includes('Leica')) {
        console.log(`   -> Contains Leica camera info`)
      }
    })
    
    return
  }
  
  console.log(`Found post: ${roadTripPost.title}`)
  console.log(`Blog: ${roadTripPost.blog.title} (showCameraMake: ${roadTripPost.blog.showCameraMake})`)
  console.log(`Current content:`)
  console.log(roadTripPost.content)
  
  // Convert the specific caption to structured data
  const originalContent = roadTripPost.content
  let updatedContent = originalContent
  
  // Replace the specific Leica caption with structured data
  const leicaCaptionRegex = /<figcaption>Leica Camera AG LEICA M \(Typ 240\) with Summicron-M 1:2\/35 ASPH\.\s*<small>35mm · 1\/125s · ISO 200<\/small><\/figcaption>/g
  
  updatedContent = updatedContent.replace(leicaCaptionRegex, () => {
    const exifData = {
      make: 'Leica Camera AG',
      model: 'LEICA M (Typ 240)',
      lens: 'Summicron-M 1:2/35 ASPH.',
      focalLength: '35mm',
      shutterSpeed: '1/125s',
      iso: 'ISO 200'
    }
    
    const exifDataJson = JSON.stringify(exifData)
    return `<figcaption data-exif="${exifDataJson.replace(/"/g, '&quot;')}"></figcaption>`
  })
  
  if (updatedContent !== originalContent) {
    await prisma.post.update({
      where: { id: roadTripPost.id },
      data: { content: updatedContent }
    })
    
    console.log(`✅ Successfully migrated post`)
    console.log(`New content:`)
    console.log(updatedContent)
  } else {
    console.log(`ℹ️  No changes needed`)
  }
}

// Run the migration
migrateRoadTripPost()
  .catch(console.error)
  .finally(() => prisma.$disconnect())