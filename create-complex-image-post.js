const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Create a post with the complex image structure our system generates
  const complexImageContent = `<p>This post contains complex image structures that might trigger Ulysses validation:</p>

<figure>
  <img src="https://blob.vercel-storage.com/images/cmcwv7ii80001x50voeroo14q_test-image_2024-07-10.jpg" alt="Test Image with EXIF" width="800" height="600" />
  <figcaption data-exif="{&quot;dateTimeOriginal&quot;:&quot;2024-07-10T10:30:00.000Z&quot;,&quot;make&quot;:&quot;Canon&quot;,&quot;model&quot;:&quot;EOS R5&quot;,&quot;aperture&quot;:2.8,&quot;shutterSpeed&quot;:&quot;1/125s&quot;,&quot;iso&quot;:400,&quot;focalLength&quot;:85}"></figcaption>
</figure>

<p>Multiple images test:</p>

<figure>
  <img src="https://blob.vercel-storage.com/images/cmcwv7ii80001x50voeroo14q_another-image_2024-07-10.png" alt="Image 2" />
  <figcaption data-exif="{&quot;dateTimeOriginal&quot;:&quot;2024-07-10T11:15:00.000Z&quot;,&quot;make&quot;:&quot;Sony&quot;,&quot;model&quot;:&quot;A7R IV&quot;}"></figcaption>
</figure>

<p>This structure mimics what our actual image processing creates.</p>`

  const post = await prisma.post.create({
    data: {
      blogId: 'cmclikssp00011s0zza0p1906', // Same blog as Basic Ghost Test
      title: 'Complex Image Test for Ulysses',
      content: complexImageContent,
      excerpt: 'Post with complex image structures to test Ulysses validation',
      slug: 'complex-image-test-for-ulysses',
      isPublished: true,
      publishedAt: new Date(),
      contentSource: 'GHOST',
      contentFormat: 'HTML',
      ghostPostId: 'complex123456789012345678901234',
      sourceUrl: '/api/ghost/admin/posts',
      sourceUpdatedAt: new Date()
    }
  })
  
  console.log('Created complex image test post:')
  console.log('ID:', post.id)
  console.log('Ghost ID:', post.ghostPostId)
  console.log('Title:', post.title)
  console.log('Content length:', post.content.length)
  console.log('Image count:', (post.content.match(/<img/g) || []).length)
  console.log('Figure count:', (post.content.match(/<figure>/g) || []).length)
  console.log('EXIF data count:', (post.content.match(/data-exif/g) || []).length)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())