import { NextRequest, NextResponse } from 'next/server'
import { VercelBlobStorageService } from '@/lib/vercel-blob-storage'
import { createHash } from 'crypto'
import { validateGhostAuth } from '@/lib/ghost-auth'

// Configure route
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /ghost/api/v4/admin/images/upload - Upload images (Ghost Admin API compatible)
 * Supports files up to 4.5MB (Vercel platform limit)
 */
export async function POST(request: NextRequest) {
  console.log('👻 POST /api/ghost/admin/images/upload handler called')
  
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
    const purpose = (formData.get('purpose') as string) || 'image' // Default to 'image' if not specified
    const ref = formData.get('ref') as string // Optional reference for original filename
    
    console.log('👻 Image upload details:', { 
      fileName: file?.name, 
      fileType: file?.type, 
      fileSize: file?.size,
      purpose,
      ref 
    })
    
    if (!file) {
      return NextResponse.json(
        { errors: [{ message: 'No file provided' }] },
        { status: 400 }
      )
    }

    // Validate purpose parameter (Ghost Admin API requirement)
    const validPurposes = ['image', 'profile_image', 'icon']
    if (!validPurposes.includes(purpose)) {
      return NextResponse.json(
        { errors: [{ message: `Invalid purpose. Must be one of: ${validPurposes.join(', ')}` }] },
        { status: 400 }
      )
    }

    // Validate file type - Ghost supports WEBP, JPEG, GIF, PNG, SVG (+ ICO for icons)
    const validImageTypes = [
      'image/webp', 'image/jpeg', 'image/jpg', 'image/gif', 
      'image/png', 'image/svg+xml'
    ]
    if (purpose === 'icon') {
      validImageTypes.push('image/x-icon', 'image/vnd.microsoft.icon')
    }
    
    if (!validImageTypes.includes(file.type)) {
      return NextResponse.json(
        { errors: [{ message: `Unsupported file type: ${file.type}. Supported formats: WEBP, JPEG, GIF, PNG, SVG${purpose === 'icon' ? ', ICO' : ''}` }] },
        { status: 400 }
      )
    }

    // Validate file size - Vercel has a hard 4.5MB platform limit for serverless functions
    const maxSize = 4.5 * 1024 * 1024 // 4.5MB
    if (file.size > maxSize) {
      console.log(`🚨 File too large: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      return NextResponse.json(
        { errors: [{ 
          message: `Image too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum size is 4.5MB due to Vercel platform limitations. Please compress the image or use a smaller file.` 
        }] },
        { status: 413 }
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

    console.log('👻 Image upload successful:', { 
      filename: imageInfo.filename,
      url: imageInfo.url,
      size: imageInfo.size 
    })

    // Return Ghost-compatible response with ref parameter support
    return NextResponse.json({
      images: [{
        url: imageInfo.url,
        ref: ref || imageInfo.filename // Use provided ref or fallback to filename
      }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Ghost-Version': '5.120.3',
        'Content-Version': 'v5.120'
      }
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
export async function OPTIONS() {
  console.log('👻 OPTIONS /api/ghost/admin/images/upload handler called')
  
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