import { NextRequest, NextResponse } from 'next/server'

// Configure route for debugging
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Simple debug endpoint to test large file handling
 */
export async function POST(request: NextRequest) {
  console.log('🐛 DEBUG: Upload endpoint called')
  console.log('🐛 DEBUG: Headers:', Object.fromEntries(request.headers.entries()))
  
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / (1024 * 1024)
    console.log(`🐛 DEBUG: Content length: ${contentLength} bytes (${sizeInMB.toFixed(2)} MB)`)
    
    if (sizeInMB > 4.5) {
      console.log('🐛 DEBUG: Large file detected - would use streaming')
      return NextResponse.json({
        message: 'Large file detected',
        size: sizeInMB,
        contentLength: contentLength,
        headers: Object.fromEntries(request.headers.entries())
      })
    }
  }
  
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (file) {
      console.log(`🐛 DEBUG: File received: ${file.name}, size: ${file.size} bytes`)
      return NextResponse.json({
        message: 'File received',
        fileName: file.name,
        fileSize: file.size,
        contentLength: contentLength
      })
    }
    
    return NextResponse.json({ message: 'No file received' })
  } catch (error) {
    console.error('🐛 DEBUG: Error processing request:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error },
      { status: 500 }
    )
  }
}