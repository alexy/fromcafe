const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const post = await prisma.post.findFirst({
    where: {
      title: {
        contains: 'Image Update'
      }
    },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      contentFormat: true,
      ghostPostId: true,
      contentSource: true
    }
  })
  
  if (post) {
    console.log('Image Update post found:')
    console.log('ID:', post.id)
    console.log('Title:', post.title)
    console.log('Ghost ID:', post.ghostPostId)
    console.log('Content Format:', post.contentFormat)
    console.log('Content Source:', post.contentSource)
    console.log('Excerpt:', post.excerpt)
    console.log('\nContent:')
    console.log(post.content)
    console.log('\n--- Content Analysis ---')
    const hasImages = post.content?.includes('<img') || post.content?.includes('![') 
    console.log('Contains images:', hasImages)
    if (hasImages) {
      const imgMatches = post.content.match(/<img[^>]*>/g) || []
      const figureMatches = post.content.match(/<figure[^>]*>/g) || []
      const figcaptionMatches = post.content.match(/<figcaption[^>]*>/g) || []
      const exifMatches = post.content.match(/data-exif/g) || []
      
      console.log('Number of img tags:', imgMatches.length)
      console.log('Number of figure tags:', figureMatches.length)
      console.log('Number of figcaption tags:', figcaptionMatches.length)
      console.log('Number of data-exif attributes:', exifMatches.length)
      
      imgMatches.forEach((img, i) => {
        console.log(`\nImage ${i + 1}:`, img)
        // Check if it's a blob URL
        if (img.includes('blob.vercel-storage.com')) {
          console.log('  → Uses Vercel Blob storage')
        }
        if (img.includes('fromcafe.art')) {
          console.log('  → Uses fromcafe.art domain')
        }
      })
      
      // Check for complex structures
      if (post.content.includes('figcaption')) {
        console.log('\nFigcaption content:')
        const figcaptionContent = post.content.match(/<figcaption[^>]*>.*?<\/figcaption>/gs) || []
        figcaptionContent.forEach((figcap, i) => {
          console.log(`Figcaption ${i + 1}:`, figcap)
        })
      }
    }
  } else {
    console.log('Image Update post not found')
    
    // Try to find posts with similar titles
    const similarPosts = await prisma.post.findMany({
      where: {
        title: {
          contains: 'Image'
        }
      },
      select: {
        id: true,
        title: true,
        ghostPostId: true
      },
      take: 5
    })
    
    console.log('\nPosts with "Image" in title:')
    similarPosts.forEach(p => {
      console.log(`- ${p.title} (ID: ${p.ghostPostId})`)
    })
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())