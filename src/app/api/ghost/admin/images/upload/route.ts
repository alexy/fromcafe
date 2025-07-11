import { NextRequest, NextResponse } from 'next/server'
import { VercelBlobStorageService } from '@/lib/vercel-blob-storage'
import { createHash } from 'crypto'
import { validateGhostAuth } from '@/lib/ghost-auth'
import Busboy from 'busboy'
import { put } from '@vercel/blob'
import { Readable } from 'stream'
import { prisma } from '@/lib/prisma'

// Configure route for streaming uploads
export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds for large uploads
export const dynamic = 'force-dynamic' // Required for streaming in App Router

/**
 * Handle streaming uploads for large files (> 4.5MB)
 * Uses Busboy to stream multipart data directly to Vercel Blob
 */
async function handleStreamingUpload(request: NextRequest): Promise<NextResponse> {
  console.log('🚀 Starting streaming upload handler')
  
  return new Promise((resolve) => {
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain') 
    const blogSlug = searchParams.get('blogSlug')
    
    console.log('👻 Streaming upload query params:', { domain, subdomain, blogSlug })
    
    if (!request.body) {
      return resolve(NextResponse.json(
        { errors: [{ message: 'No request body' }] },
        { status: 400 }
      ))
    }
    
    // Convert request to Node.js readable stream
    const readable = Readable.fromWeb(request.body as import("stream/web").ReadableStream)
    
    // Parse multipart data with Busboy
    const contentType = request.headers.get('content-type') || ''
    const busboy = Busboy({ headers: { 'content-type': contentType } })
    
    let fileInfo: {
      filename: string
      mimeType: string
      size: number
      purpose: string
      ref?: string
    } | null = null
    
    let uploadPromise: Promise<{url: string, pathname: string}> | null = null
    let authValidated = false
    let blog: {id: string} | null = null
    
    // Handle form fields (purpose, ref, etc.)
    busboy.on('field', (fieldname, val) => {
      console.log(`👻 Streaming upload field: ${fieldname} = ${val}`)
      if (!fileInfo) {
        fileInfo = {
          filename: '',
          mimeType: '',
          size: 0,
          purpose: 'image',
          ref: undefined
        }
      }
      
      if (fieldname === 'purpose') {
        fileInfo.purpose = val
      } else if (fieldname === 'ref') {
        fileInfo.ref = val
      }
    })
    
    // Handle file upload
    busboy.on('file', async (fieldname, file, info) => {
      console.log(`👻 Streaming upload file: ${fieldname}, filename: ${info.filename}, mimeType: ${info.mimeType}`)
      
      if (!fileInfo) {
        fileInfo = {
          filename: info.filename,
          mimeType: info.mimeType,
          size: 0,
          purpose: 'image',
          ref: undefined
        }
      } else {
        fileInfo.filename = info.filename
        fileInfo.mimeType = info.mimeType
      }
      
      // Validate authentication first
      if (!authValidated) {
        try {
          const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
          if ('error' in authResult) {
            console.log('👻 Streaming upload authentication failed')
            return resolve(authResult.error as NextResponse)
          }
          blog = authResult.blog
          authValidated = true
          console.log('👻 Streaming upload authentication successful, blog ID:', blog.id)
        } catch (error) {
          console.error('👻 Streaming upload auth error:', error)
          return resolve(NextResponse.json(
            { errors: [{ message: 'Authentication failed' }] },
            { status: 401 }
          ))
        }
      }
      
      // Validate file type
      const validImageTypes = [
        'image/webp', 'image/jpeg', 'image/jpg', 'image/gif', 
        'image/png', 'image/svg+xml'
      ]
      if (fileInfo.purpose === 'icon') {
        validImageTypes.push('image/x-icon', 'image/vnd.microsoft.icon')
      }
      
      if (!validImageTypes.includes(fileInfo.mimeType)) {
        return resolve(NextResponse.json(
          { errors: [{ message: `Unsupported file type: ${fileInfo.mimeType}. Supported formats: WEBP, JPEG, GIF, PNG, SVG${fileInfo.purpose === 'icon' ? ', ICO' : ''}` }] },
          { status: 400 }
        ))
      }
      
      // Generate filename for blob storage
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const title = fileInfo.filename.replace(/\.[^/.]+$/, "") // Remove extension
      const extension = fileInfo.mimeType.split('/')[1] || 'jpg'
      const postId = fileInfo.purpose === 'image' ? 'ghost-upload-large' : 'ghost-content-large'
      const blobFilename = `${postId}_${title}_${timestamp}_${randomSuffix}.${extension}`
      
      console.log('👻 Streaming upload to blob:', blobFilename)
      
      // Stream directly to Vercel Blob
      uploadPromise = put(blobFilename, file, {
        access: 'public',
        contentType: fileInfo.mimeType,
        addRandomSuffix: false
      })
      
      // Track file size as it streams
      let totalSize = 0
      file.on('data', (chunk) => {
        totalSize += chunk.length
      })
      
      file.on('end', () => {
        if (fileInfo) {
          fileInfo.size = totalSize
        }
        console.log(`👻 Streaming upload completed, total size: ${totalSize} bytes`)
      })
    })
    
    // Handle completion
    busboy.on('finish', async () => {
      console.log('👻 Streaming upload busboy finished')
      
      if (!uploadPromise || !fileInfo) {
        return resolve(NextResponse.json(
          { errors: [{ message: 'No file uploaded' }] },
          { status: 400 }
        ))
      }
      
      try {
        // Wait for upload to complete
        const blob = await uploadPromise
        console.log('👻 Streaming upload blob result:', blob)
        
        // Record the upload in our system
        const fileHash = createHash('sha256').update(blob.url).digest('hex').substring(0, 16)
        
        try {
          await prisma.imageNamingDecision.create({
            data: {
              postId: null, // No associated post for direct uploads
              originalHash: fileHash,
              blobFilename: blob.pathname.split('/').pop() || fileInfo.filename,
              blobUrl: blob.url,
              namingSource: 'ORIGINAL_FILENAME',
              originalTitle: fileInfo.filename.replace(/\.[^/.]+$/, ""),
              originalFilename: fileInfo.filename,
              decisionReason: `Streaming upload of large file (${(fileInfo.size / 1024 / 1024).toFixed(2)}MB)`,
              prefixCompressed: false
            }
          })
          console.log('👻 Successfully recorded streaming upload')
        } catch (dbError) {
          console.error('Error recording streaming upload:', dbError)
          // Continue anyway - upload was successful
        }
        
        // Return Ghost-compatible response
        return resolve(NextResponse.json({
          images: [{
            url: blob.url,
            ref: fileInfo.ref || fileInfo.filename
          }]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-Ghost-Version': '5.120.3',
            'Content-Version': 'v5.120'
          }
        }))
        
      } catch (error) {
        console.error('👻 Streaming upload error:', error)
        return resolve(NextResponse.json(
          { errors: [{ message: 'Failed to upload large file' }] },
          { status: 500 }
        ))
      }
    })
    
    // Handle errors
    busboy.on('error', (error) => {
      console.error('👻 Streaming upload busboy error:', error)
      resolve(NextResponse.json(
        { errors: [{ message: 'Upload parsing failed' }] },
        { status: 400 }
      ))
    })
    
    // Handle stream errors
    readable.on('error', (error) => {
      console.error('👻 Streaming upload readable error:', error)
      resolve(NextResponse.json(
        { errors: [{ message: 'Stream parsing failed' }] },
        { status: 400 }
      ))
    })
    
    // Pipe the request to busboy
    readable.pipe(busboy)
  })
}

/**
 * POST /ghost/api/v4/admin/images/upload - Upload images (Ghost Admin API compatible)
 * Hybrid approach: standard processing for small files, streaming for large files
 */
export async function POST(request: NextRequest) {
  console.log('👻 POST /api/ghost/admin/images/upload handler called')
  console.log('👻 Image upload request headers:', Object.fromEntries(request.headers.entries()))
  
  // Log content length to debug size issues
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / (1024 * 1024)
    console.log(`👻 Image upload content length: ${contentLength} bytes (${sizeInMB.toFixed(2)} MB)`)
    
    // Use streaming upload for large files
    if (sizeInMB > 4.5) {
      console.log('🚀 Large file detected - using streaming upload')
      return handleStreamingUpload(request)
    }
  }
  
  // Continue with existing logic for files ≤ 4.5MB
  console.log('📦 Standard file size - using existing upload logic')
  
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

    // Validate file size - large files should use streaming upload
    const maxSize = 4.5 * 1024 * 1024 // 4.5MB (Vercel limit)
    if (file.size > maxSize) {
      console.log(`🚨 File too large for standard processing: ${file.size} bytes (${(file.size / 1024 / 1024).toFixed(2)} MB)`)
      console.log('🚀 Should have used streaming upload - redirecting')
      // This shouldn't happen if content-length detection works, but fallback to streaming
      return handleStreamingUpload(request)
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