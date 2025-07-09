import { prisma } from '@/lib/prisma'

/**
 * Migration script to convert existing prerendered captions to structured data format
 */
async function migrateCaptions() {
  console.log('Starting caption migration...')
  
  // Find all posts with figcaption content
  const posts = await prisma.post.findMany({
    where: {
      content: {
        contains: '<figcaption>'
      }
    },
    include: {
      blog: {
        select: {
          id: true,
          slug: true,
          title: true,
          showCameraMake: true
        }
      }
    }
  })
  
  console.log(`Found ${posts.length} posts with figcaptions`)
  
  let migratedCount = 0
  let errorCount = 0
  
  for (const post of posts) {
    try {
      console.log(`Processing post: ${post.title} (${post.slug})`)
      
      // Convert prerendered captions to structured data
      let updatedContent = post.content
      let hasChanges = false
      
      // Pattern to match figcaptions with camera information
      const figcaptionRegex = /<figcaption>([^<]+(?:<[^>]*>[^<]*)*)<\/figcaption>/g
      
      updatedContent = updatedContent.replace(figcaptionRegex, (match, captionContent) => {
        // Try to parse camera caption and extract EXIF data
        const cameraMatch = captionContent.match(/^(.+?)\s+(.+?)\s+(\([^)]+\))?\s*(with\s+[^<]*)?(?:\s*<small>([^<]*)<\/small>)?$/i)
        
        if (cameraMatch) {
          const [, make, model, , lens, technical] = cameraMatch
          
          // Check if this looks like a camera caption
          const commonMakes = ['Leica Camera AG', 'Canon', 'Nikon', 'Sony', 'Fujifilm', 'Olympus', 'Panasonic']
          const isCameraCaption = commonMakes.some(commonMake => 
            captionContent.includes(commonMake)
          )
          
          if (isCameraCaption) {
            // Extract EXIF data from the caption
            const exifData: Record<string, string> = {}
            
            // Parse make
            if (make && make.trim()) {
              exifData.make = make.trim()
            }
            
            // Parse model
            if (model && model.trim()) {
              exifData.model = model.trim()
            }
            
            // Parse lens from "with ..." part
            if (lens) {
              const lensMatch = lens.match(/with\s+(.+)/i)
              if (lensMatch) {
                exifData.lens = lensMatch[1].trim()
              }
            }
            
            // Parse technical info from <small> tag
            if (technical) {
              const techMatch = technical.match(/([0-9]+mm)?\s*[·•]\s*([0-9/]+s)\s*[·•]\s*(ISO\s*[0-9]+)/i)
              if (techMatch) {
                const [, focalLength, shutterSpeed, iso] = techMatch
                if (focalLength) exifData.focalLength = focalLength
                if (shutterSpeed) exifData.shutterSpeed = shutterSpeed
                if (iso) exifData.iso = iso
              }
            }
            
            // Convert to structured data format
            if (Object.keys(exifData).length > 0) {
              const exifDataJson = JSON.stringify(exifData)
              hasChanges = true
              return `<figcaption data-exif="${exifDataJson.replace(/"/g, '&quot;')}"></figcaption>`
            }
          }
        }
        
        return match
      })
      
      if (hasChanges) {
        await prisma.post.update({
          where: { id: post.id },
          data: { content: updatedContent }
        })
        
        migratedCount++
        console.log(`✅ Migrated post: ${post.title}`)
      } else {
        console.log(`ℹ️  No changes needed for post: ${post.title}`)
      }
      
    } catch (error) {
      console.error(`❌ Error processing post ${post.title}:`, error)
      errorCount++
    }
  }
  
  console.log(`\n📊 Migration completed:`)
  console.log(`   - Posts processed: ${posts.length}`)
  console.log(`   - Posts migrated: ${migratedCount}`)
  console.log(`   - Errors: ${errorCount}`)
}

// Run the migration
migrateCaptions()
  .catch(console.error)
  .finally(() => prisma.$disconnect())