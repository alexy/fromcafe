/**
 * Vercel Blob-based image storage service for serverless compatibility
 */

import { put, head } from '@vercel/blob'
import { createHash } from 'crypto'

export interface ImageInfo {
  originalHash: string
  filename: string
  mimeType: string
  size: number
  url: string
  contentHash: string
}

export class VercelBlobStorageService {
  /**
   * Store an image using Vercel Blob
   */
  async storeImage(
    imageData: Buffer,
    originalHash: string,
    mimeType: string,
    postId: string,
    title?: string,
    originalFilename?: string
  ): Promise<ImageInfo> {
    try {
      // Generate content hash for deduplication
      const contentHash = createHash('sha256').update(imageData).digest('hex').substring(0, 16)
      
      // Generate filename
      const extension = this.getExtensionFromMimeType(mimeType)
      const filename = this.generateFilename(title, originalFilename, contentHash, extension, postId)

      // Check if blob already exists by content hash (more robust deduplication)
      try {
        const existingBlob = await head(`images/${filename}`)
        if (existingBlob) {
          // Verify the existing blob is the same size to ensure it's the same file
          if (existingBlob.size === imageData.length) {
            console.log(`Image already exists in Vercel Blob: ${filename} (${existingBlob.size} bytes) - reusing existing`)
            return {
              originalHash,
              filename,
              mimeType,
              size: existingBlob.size,
              url: existingBlob.url,
              contentHash
            }
          } else {
            console.log(`Image exists but size mismatch: expected ${imageData.length}, found ${existingBlob.size} - uploading new version`)
          }
        }
      } catch {
        // Blob doesn't exist, continue with upload
        console.log(`Image not found in blob storage: ${filename} - uploading new`)
      }

      // Upload to Vercel Blob (new upload or replacing mismatched file)
      const blob = await put(`images/${filename}`, imageData, {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: false, // We're handling uniqueness ourselves
      })

      console.log(`Stored image in Vercel Blob: ${filename} (${imageData.length} bytes)`)

      return {
        originalHash,
        filename,
        mimeType,
        size: imageData.length,
        url: blob.url,
        contentHash
      }
    } catch (error) {
      console.error('Error storing image in Vercel Blob:', error)
      throw new Error(`Failed to store image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if an image already exists (simplified for Vercel Blob)
   * Note: Vercel Blob doesn't have a great way to search, so we'll rely on our naming convention
   */
  async imageExists(originalHash: string, postId: string): Promise<string | null> {
    // For Vercel Blob, we'll generate the expected filename and check if it exists
    // This is a simplified approach - in practice, you might want to track this in your database
    const hashPrefix = originalHash.substring(0, 8)
    const potentialFilenames = [
      `images/${postId}_${hashPrefix}.jpg`,
      `images/${postId}_${hashPrefix}.png`,
      `images/${postId}_${hashPrefix}.gif`,
      `images/${postId}_${hashPrefix}.webp`
    ]

    for (const filename of potentialFilenames) {
      try {
        const blob = await head(filename)
        if (blob) {
          console.log(`Image already exists in Vercel Blob: ${filename}`)
          return blob.url
        }
      } catch {
        // Blob doesn't exist, continue checking
      }
    }

    return null
  }

  /**
   * Delete all images for a post (simplified for Vercel Blob)
   * Note: Vercel Blob doesn't have bulk delete or search, so this is basic
   */
  async deletePostImages(postId: string): Promise<void> {
    try {
      // This is a simplified implementation
      // In practice, you'd want to track image URLs in your database for easier cleanup
      console.log(`Image cleanup for post ${postId} - implement database tracking for better cleanup`)
    } catch (error) {
      console.error(`Error deleting images for post ${postId}:`, error)
      // Don't throw - image cleanup is not critical
    }
  }

  /**
   * Generate filename with proper structure
   */
  private generateFilename(
    title?: string,
    originalFilename?: string,
    contentHash?: string,
    extension?: string,
    postId?: string
  ): string {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    
    // Use title if available and meaningful
    if (title && title.trim() && title.trim().length > 2) {
      const sanitized = this.sanitizeFilename(title.trim())
      if (sanitized) {
        return `${postId}_${sanitized}_${contentHash}.${extension}`
      }
    }

    // Use original filename if available
    if (originalFilename) {
      const sanitized = this.sanitizeFilename(originalFilename.replace(/\.[^.]*$/, ''))
      if (sanitized) {
        return `${postId}_${sanitized}_${contentHash}.${extension}`
      }
    }

    // Fallback to structured naming
    return `${postId}_image_${timestamp}_${contentHash}.${extension}`
  }

  /**
   * Sanitize filename for web safety
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\-_.]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50)
      .replace(/-+$/, '')
  }

  /**
   * Get extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
      case 'image/jpeg':
      case 'image/jpg':
        return 'jpg'
      case 'image/png':
        return 'png'
      case 'image/gif':
        return 'gif'
      case 'image/webp':
        return 'webp'
      case 'image/bmp':
        return 'bmp'
      case 'image/tiff':
        return 'tiff'
      case 'image/svg+xml':
        return 'svg'
      default:
        return 'jpg'
    }
  }
}