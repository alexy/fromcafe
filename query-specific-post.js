const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const post = await prisma.post.findFirst({
    where: {
      ghostPostId: '518e8554b6c10d23c5979020'
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
    console.log('Excerpt:', post.excerpt?.substring(0, 100) + '...')
    console.log('\nContent length:', post.content?.length)
    console.log('Content preview:', post.content?.substring(0, 200) + '...')
    
    console.log('\n--- Content Analysis ---')
    const hasImages = post.content?.includes('<img') || post.content?.includes('![') 
    console.log('Contains images:', hasImages)
    
    if (hasImages && post.content) {
      const imgMatches = post.content.match(/<img[^>]*>/g) || []
      const figureMatches = post.content.match(/<figure[^>]*>/g) || []
      const figcaptionMatches = post.content.match(/<figcaption[^>]*>/g) || []
      const exifMatches = post.content.match(/data-exif/g) || []
      const blobMatches = post.content.match(/blob\.vercel-storage\.com/g) || []
      
      console.log('Number of img tags:', imgMatches.length)
      console.log('Number of figure tags:', figureMatches.length)
      console.log('Number of figcaption tags:', figcaptionMatches.length)
      console.log('Number of data-exif attributes:', exifMatches.length)
      console.log('Number of blob URLs:', blobMatches.length)
      
      // Show each image structure
      imgMatches.forEach((img, i) => {
        console.log(`\nImage ${i + 1}:`)
        console.log(img)
        
        // Get surrounding context (figure/figcaption)
        const imgIndex = post.content.indexOf(img)
        const contextStart = Math.max(0, imgIndex - 100)
        const contextEnd = Math.min(post.content.length, imgIndex + img.length + 200)
        const context = post.content.substring(contextStart, contextEnd)
        console.log('Context:')
        console.log(context)
        console.log('---')
      })
    }
  } else {
    console.log('Post not found with Ghost ID: 518e8554b6c10d23c5979020')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())