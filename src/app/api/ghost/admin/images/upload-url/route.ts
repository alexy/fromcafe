import { NextRequest, NextResponse } from 'next/server'
import { validateGhostAuth } from '@/lib/ghost-auth'

/**
 * Generate a pre-signed URL for direct upload to Vercel Blob
 * This bypasses the serverless function for large files
 */
export async function POST(request: NextRequest) {
  console.log('🔗 POST /api/ghost/admin/images/upload-url handler called')
  
  try {
    // Get blog identifier from query parameters
    const { searchParams } = new URL(request.url)
    const domain = searchParams.get('domain')
    const subdomain = searchParams.get('subdomain') 
    const blogSlug = searchParams.get('blogSlug')
    
    // Validate authentication
    const authResult = await validateGhostAuth(request, domain || undefined, subdomain || undefined, blogSlug || undefined)
    if ('error' in authResult) {
      console.log('🔗 Upload URL authentication failed')
      return authResult.error
    }
    
    const { blog } = authResult
    console.log('🔗 Upload URL authentication successful, blog ID:', blog.id)
    
    // Parse request body
    const body = await request.json()
    const { filename, contentType } = body
    
    if (!filename || !contentType) {
      return NextResponse.json(
        { errors: [{ message: 'filename and contentType are required' }] },
        { status: 400 }
      )
    }
    
    // Generate a unique filename
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substring(2, 8)
    const title = filename.replace(/\.[^/.]+$/, "") // Remove extension
    const extension = contentType.split('/')[1] || 'jpg'
    const blobFilename = `ghost-upload-direct_${title}_${timestamp}_${randomSuffix}.${extension}`
    
    // For now, return the standard upload URL with instructions
    // In the future, we could implement actual pre-signed URLs
    const uploadUrl = '/api/ghost/admin/images/upload'
    
    return NextResponse.json({
      uploadUrl,
      filename: blobFilename,
      message: 'Use standard upload endpoint for now'
    })
    
  } catch (error) {
    console.error('Error generating upload URL:', error)
    return NextResponse.json(
      { errors: [{ message: 'Failed to generate upload URL' }] },
      { status: 500 }
    )
  }
}