import { NextRequest, NextResponse } from 'next/server'
import { VercelBlobStorageService } from '@/lib/vercel-blob-storage'
import { createHash } from 'crypto'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * POST /ghost/api/v4/admin/images/upload - Upload images (Ghost Admin API compatible)
 */
export async function POST(request: NextRequest) {
  console.log('👻 POST /api/ghost/admin/images/upload handler called')
  console.log('👻 Image upload request headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get blog identifier from query parameters (set by middleware)
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain') 
    const blogSlug = searchParams.get('blogSlug')
    
    console.log('👻 Image upload query params:', { domain, subdomain, blogSlug })

    // Validate authentication and find blog - REQUIRED for Ghost Admin API
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('👻 Image upload authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('👻 Image upload authentication successful, blog ID:', blog.id)
    const formData = await request.formData()
    const file = formData.get('file') as File
    const purpose = formData.get('purpose') as string // Ghost sends purpose for different upload types
    
    if (!file) {
      return NextResponse.json(
        { errors: [{ message: 'No file provided' }] },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { errors: [{ message: 'File must be an image' }] },
        { status: 400 }
      )
    }

    // Validate file size (Vercel has 4.5MB limit for serverless functions)
    const maxSize = 4 * 1024 * 1024 // 4MB to be safe
    if (file.size > maxSize) {
      return NextResponse.json(
        { errors: [{ message: `File too large. Maximum size is ${maxSize / 1024 / 1024}MB` }] },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Use Vercel Blob storage service
    const imageStorage = new VercelBlobStorageService()
    
    // Generate a hash for the file content to avoid duplicates
    const fileHash = createHash('sha256').update(buffer).digest('hex').substring(0, 16)
    
    // Store image with Ghost source prefix and proper categorization
    const postId = purpose === 'image' ? 'ghost-upload' : 'ghost-content'
    const title = file.name.replace(/\.[^/.]+$/, "") // Remove extension for title
    
    const imageInfo = await imageStorage.storeImage(
      buffer,
      fileHash,
      file.type,
      postId,
      title,
      file.name
    )

    // Return Ghost-compatible response - exactly as it was before
    return NextResponse.json({
      images: [{
        url: imageInfo.url,
        ref: imageInfo.filename
      }]
    })

  } catch (error) {
    console.error('Error uploading Ghost image:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to upload image' }] },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/ghost/admin/images/upload - Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  console.log('👻 OPTIONS /api/ghost/admin/images/upload handler called')
  console.log('👻 Image upload OPTIONS request headers:', Object.fromEntries(request.headers.entries()))
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept-Version',
      'Content-Type': 'application/json',
      'X-Ghost-Version': '5.0.0'
    }
  })
}