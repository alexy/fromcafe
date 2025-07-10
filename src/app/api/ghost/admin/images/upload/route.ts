import { NextRequest, NextResponse } from 'next/server'
import { VercelBlobStorageService } from '@/lib/vercel-blob-storage'
import { createHash } from 'crypto'

/**
 * POST /ghost/api/v4/admin/images/upload - Upload images (Ghost Admin API compatible)
 */
export async function POST(request: NextRequest) {
  console.log(`🚀 UPLOAD START: ${Date.now()} - ${Math.random().toString(36).substr(2, 9)}`)
  try {
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

    console.log(`📤 STORE-IMAGE COMPLETED: ${imageInfo.url}`)

    // Return Ghost-compatible response
    console.log(`✅ UPLOAD SUCCESS: Returning URL ${imageInfo.url}`)
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