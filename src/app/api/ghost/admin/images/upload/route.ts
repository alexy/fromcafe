import { NextRequest, NextResponse } from 'next/server'
import { ImageStorageService } from '@/lib/image-storage'
import { createHash } from 'crypto'

/**
 * POST /ghost/api/v4/admin/images/upload - Upload images (Ghost Admin API compatible)
 */
export async function POST(request: NextRequest) {
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

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Use our unified image storage service
    const imageStorage = new ImageStorageService()
    
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

    // Return Ghost-compatible response
    return NextResponse.json({
      images: [{
        url: imageInfo.url,
        ref: imageInfo.filename.split('/').pop() // Just the filename for ref
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