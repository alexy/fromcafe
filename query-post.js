const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const post = await prisma.post.findFirst({
    where: {
      ghostPostId: '306c95d0b8e3acb2ba25a393'
    },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      contentFormat: true,
      ghostPostId: true
    }
  })
  
  if (post) {
    console.log('Post found:')
    console.log('ID:', post.id)
    console.log('Title:', post.title)
    console.log('Ghost ID:', post.ghostPostId)
    console.log('Content Format:', post.contentFormat)
    console.log('Excerpt:', post.excerpt)
    console.log('\nContent:')
    console.log(post.content)
    console.log('\n--- Content Analysis ---')
    const hasImages = post.content?.includes('<img') || post.content?.includes('![') 
    console.log('Contains images:', hasImages)
    if (hasImages) {
      const imgMatches = post.content.match(/<img[^>]*>/g) || []
      console.log('Number of img tags:', imgMatches.length)
      imgMatches.forEach((img, i) => {
        console.log(`Image ${i + 1}:`, img)
      })
    }
  } else {
    console.log('Post not found')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())