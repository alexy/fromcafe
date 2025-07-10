const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // First find the post to get its ID
  const post = await prisma.post.findFirst({
    where: {
      ghostPostId: '306c95d0b8e3acb2ba25a393'
    }
  })
  
  if (!post) {
    console.log('Post not found')
    return
  }
  
  // Add an image to the Basic Ghost Test post
  const updatedPost = await prisma.post.update({
    where: {
      id: post.id
    },
    data: {
      content: `<p>Goat!</p>

<p>Boar!</p>

<p>Moar</p>

<figure>
  <img src="https://blob.vercel-storage.com/images/test-image.jpg" alt="Test Image" width="800" height="600" />
  <figcaption data-exif="{}"></figcaption>
</figure>

<p>This post now contains an image that should trigger Ulysses validation.</p>`,
      excerpt: 'Goat! Boar! Moar - now with images that trigger Ulysses client-side validation'
    }
  })
  
  console.log('Updated post:', updatedPost.title)
  console.log('New content length:', updatedPost.content.length)
  console.log('Contains img tag:', updatedPost.content.includes('<img'))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())