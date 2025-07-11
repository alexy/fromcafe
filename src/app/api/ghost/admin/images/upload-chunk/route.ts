import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'
import { put } from '@vercel/blob'
import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ChunkUploadState {
  uploadId: string
  filename: string
  contentType: string
  totalSize: number
  totalChunks: number
  uploadedChunks: number[]
  chunks: Buffer[]
}

// In-memory storage for chunk state (in production, use Redis or database)
const uploadStates = new Map<string, ChunkUploadState>()

/**
 * Handle chunked uploads for large files
 */
export async function POST(request: NextRequest) {
  console.log('🧩 POST /api/ghost/admin/images/upload-chunk handler called')
  
  try {
    // Get blog identifier from query parameters
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain') 
    const blogSlug = searchParams.get('blogSlug')
    
    // Validate authentication
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('🧩 Chunk upload authentication failed')
      return authResult.error
    }
    
    const formData = await request.formData()
    const uploadId = formData.get('uploadId') as string
    const chunkIndex = parseInt(formData.get('chunkIndex') as string)
    const totalChunks = parseInt(formData.get('totalChunks') as string)
    const chunk = formData.get('chunk') as File
    const filename = formData.get('filename') as string
    const contentType = formData.get('contentType') as string
    const totalSize = parseInt(formData.get('totalSize') as string)
    
    if (!uploadId || isNaN(chunkIndex) || isNaN(totalChunks) || !chunk) {
      return NextResponse.json(
        { errors: [{ message: 'Missing required chunk parameters' }] },
        { status: 400 }
      )
    }
    
    console.log(`🧩 Receiving chunk ${chunkIndex + 1}/${totalChunks} for upload ${uploadId}`)
    
    // Initialize upload state if this is the first chunk
    if (!uploadStates.has(uploadId)) {
      uploadStates.set(uploadId, {
        uploadId,
        filename,
        contentType,
        totalSize,
        totalChunks,
        uploadedChunks: [],
        chunks: new Array(totalChunks)
      })
    }
    
    const state = uploadStates.get(uploadId)!
    
    // Store the chunk
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer())
    state.chunks[chunkIndex] = chunkBuffer
    state.uploadedChunks.push(chunkIndex)
    
    console.log(`🧩 Stored chunk ${chunkIndex + 1}/${totalChunks} (${chunkBuffer.length} bytes)`)
    
    // Check if all chunks have been uploaded
    if (state.uploadedChunks.length === totalChunks) {
      console.log('🧩 All chunks received, assembling file...')
      
      // Combine all chunks
      const completeFile = Buffer.concat(state.chunks)
      
      // Upload to Vercel Blob
      const timestamp = Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const title = filename.replace(/\.[^/.]+$/, "") // Remove extension
      const extension = contentType.split('/')[1] || 'jpg'
      const blobFilename = `ghost-upload-chunked_${title}_${timestamp}_${randomSuffix}.${extension}`
      
      const blob = await put(blobFilename, completeFile, {
        access: 'public',
        contentType: contentType,
        addRandomSuffix: false
      })
      
      // Record in database
      const fileHash = createHash('sha256').update(completeFile).digest('hex').substring(0, 16)
      
      try {
        await prisma.imageNamingDecision.create({
          data: {
            postId: null,
            originalHash: fileHash,
            blobFilename: blob.pathname.split('/').pop() || filename,
            blobUrl: blob.url,
            namingSource: 'ORIGINAL_FILENAME',
            originalTitle: filename.replace(/\.[^/.]+$/, ""),
            originalFilename: filename,
            decisionReason: `Chunked upload of large file (${(totalSize / 1024 / 1024).toFixed(2)}MB)`,
            prefixCompressed: false
          }
        })
      } catch (dbError) {
        console.error('Error recording chunked upload:', dbError)
        // Continue anyway
      }
      
      // Clean up state
      uploadStates.delete(uploadId)
      
      console.log('🧩 Chunked upload completed successfully')
      
      // Return Ghost-compatible response
      return NextResponse.json({
        images: [{
          url: blob.url,
          ref: filename
        }]
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Ghost-Version': '5.120.3',
          'Content-Version': 'v5.120'
        }
      })
    }
    
    // Return partial completion status
    return NextResponse.json({
      message: 'Chunk received',
      uploadId,
      chunkIndex,
      totalChunks,
      uploadedChunks: state.uploadedChunks.length,
      complete: false
    })
    
  } catch (error) {
    console.error('Error in chunked upload:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to process chunk' }] },
      { status: 500 }
    )
  }
}