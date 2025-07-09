/**
 * Vercel Blob-based image storage service for serverless compatibility
 */

import { put, head, del } from '@vercel/blob'
import { createHash } from 'crypto'
import { getConfig } from './config'

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
    originalFilename?: string,
    exifDate?: string,
    postDate?: string
  ): Promise<ImageInfo> {
    try {
      // Extract date if not provided
      if (!exifDate) {
        exifDate = await this.extractImageDate(imageData, originalFilename, postDate)
      }
      
      // Generate content hash for deduplication
      const contentHash = createHash('sha256').update(imageData).digest('hex').substring(0, 16)
      
      // Generate filename
      const extension = this.getExtensionFromMimeType(mimeType)
      const filename = this.generateFilename(title, originalFilename, contentHash, extension, postId, exifDate)

      // Check if image already exists with potentially different filename
      const existingImage = await this.imageExists(originalHash, postId)
      
      if (existingImage) {
        // Check if the current title would generate a different filename
        const currentExpectedFilename = this.generateFilename(title, undefined, contentHash, extension, postId, exifDate)
        
        if (existingImage.filename === currentExpectedFilename) {
          // Same filename, verify size and reuse
          try {
            const existingBlob = await head(`images/${existingImage.filename}`)
            if (existingBlob && existingBlob.size === imageData.length) {
              console.log(`Image already exists with same title: ${existingImage.filename} (${existingBlob.size} bytes) - reusing existing`)
              return {
                originalHash,
                filename: existingImage.filename,
                mimeType,
                size: existingBlob.size,
                url: existingBlob.url,
                contentHash
              }
            }
          } catch {
            // Blob doesn't exist anymore, continue with upload
          }
        } else {
          // Title has changed, need to upload with new filename
          console.log(`Image title changed: ${existingImage.filename} -> ${currentExpectedFilename} - uploading with new filename`)
          
          // Delete old file after successful upload (will be done after upload)
          // Store old filename for cleanup
          const oldFilename = existingImage.filename
          
          // Mark for cleanup after successful upload
          setTimeout(async () => {
            try {
              await del(`images/${oldFilename}`)
              console.log(`Cleaned up old image file: ${oldFilename}`)
            } catch (error) {
              console.warn(`Failed to delete old image file ${oldFilename}:`, error)
            }
          }, 1000) // Small delay to ensure new file is uploaded first
        }
      }
      
      // Check if new filename already exists (edge case)
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
   * Check if an image already exists and return detailed information
   * Returns both URL and filename for comparison
   */
  async imageExists(originalHash: string, postId: string): Promise<{ url: string; filename: string } | null> {
    // Generate content hash for fallback naming
    const contentHash = createHash('sha256').update(originalHash).digest('hex').substring(0, 16)
    const hashPrefix = originalHash.substring(0, 8)
    
    // We can't predict the exact filename with title and date without that information
    // So we'll check for the most likely patterns based on our naming strategy
    
    // Check for current date-based naming (most likely for new images)
    const today = new Date().toISOString().split('T')[0]
    const currentPatternFilenames = [
      `images/${postId}_image_${today}.jpg`,
      `images/${postId}_image_${today}.png`,
      `images/${postId}_image_${today}.gif`,
      `images/${postId}_image_${today}.webp`
    ]

    for (const filename of currentPatternFilenames) {
      try {
        const blob = await head(filename)
        if (blob) {
          console.log(`Image already exists in Vercel Blob (current date): ${filename}`)
          return { url: blob.url, filename: filename.replace('images/', '') }
        }
      } catch {
        // Blob doesn't exist, continue checking
      }
    }

    // Check for content hash fallback naming
    const hashPatternFilenames = [
      `images/${postId}_image_${contentHash}.jpg`,
      `images/${postId}_image_${contentHash}.png`,
      `images/${postId}_image_${contentHash}.gif`,
      `images/${postId}_image_${contentHash}.webp`
    ]

    for (const filename of hashPatternFilenames) {
      try {
        const blob = await head(filename)
        if (blob) {
          console.log(`Image already exists in Vercel Blob (hash pattern): ${filename}`)
          return { url: blob.url, filename: filename.replace('images/', '') }
        }
      } catch {
        // Blob doesn't exist, continue checking
      }
    }

    // Check for legacy simple naming pattern
    const simplePatternFilenames = [
      `images/${postId}_${hashPrefix}.jpg`,
      `images/${postId}_${hashPrefix}.png`,
      `images/${postId}_${hashPrefix}.gif`,
      `images/${postId}_${hashPrefix}.webp`
    ]

    for (const filename of simplePatternFilenames) {
      try {
        const blob = await head(filename)
        if (blob) {
          console.log(`Image already exists in Vercel Blob (simple pattern): ${filename}`)
          return { url: blob.url, filename: filename.replace('images/', '') }
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
   * Generate filename using title and EXIF date when available
   */
  private generateFilename(
    title?: string,
    originalFilename?: string,
    contentHash?: string,
    extension?: string,
    postId?: string,
    exifDate?: string
  ): string {
    // Use the extracted date (already in YYYY-MM-DD format)
    const dateStr = exifDate
    
    // Use title if available and meaningful
    if (title && title.trim() && title.trim().length > 2) {
      const sanitized = this.sanitizeFilename(title.trim())
      if (sanitized) {
        return dateStr ? `${postId}_${sanitized}_${dateStr}.${extension}` : `${postId}_${sanitized}.${extension}`
      }
    }

    // Use original filename if available
    if (originalFilename) {
      const sanitized = this.sanitizeFilename(originalFilename.replace(/\.[^.]*$/, ''))
      if (sanitized) {
        return dateStr ? `${postId}_${sanitized}_${dateStr}.${extension}` : `${postId}_${sanitized}.${extension}`
      }
    }

    // Fallback to structured naming with date if available
    return dateStr ? `${postId}_image_${dateStr}.${extension}` : `${postId}_image_${contentHash}.${extension}`
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

  /**
   * Extract date from EXIF, filename, file stats, or post date
   */
  private async extractImageDate(imageData: Buffer, originalFilename?: string, postDate?: string): Promise<string> {
    const config = getConfig()
    
    // Try EXIF data first if enabled
    if (config.images.useExifDates) {
      try {
        const exifr = await import('exifr')
        const exifData = await exifr.parse(imageData, { 
          tiff: true, 
          exif: true,
          gps: false,
          interop: false,
          ifd1: false
        })
        
        const dateFields = [
          'DateTimeOriginal',     // Camera capture time
          'CreateDate',           // File creation time
          'DateTime',             // File modification time
          'DateTimeDigitized'     // Digitization time
        ]
        
        for (const field of dateFields) {
          const date = exifData?.[field]
          if (date && date instanceof Date) {
            return this.formatDateForFilename(date)
          }
          if (typeof date === 'string') {
            const parsedDate = new Date(date)
            if (!isNaN(parsedDate.getTime())) {
              return this.formatDateForFilename(parsedDate)
            }
          }
        }
      } catch (error) {
        console.warn('Failed to extract EXIF date:', error)
      }
    }
    
    // Fallback 1: Parse date from filename
    if (originalFilename) {
      const filenameDate = this.extractDateFromFilename(originalFilename)
      if (filenameDate) {
        return filenameDate
      }
    }
    
    // Fallback 2: Use file system timestamps (not applicable for Buffer data)
    // This would require the original file path, which we don't have
    
    // Fallback 3: Use post date if available
    if (postDate) {
      try {
        const parsedDate = new Date(postDate)
        if (!isNaN(parsedDate.getTime())) {
          return this.formatDateForFilename(parsedDate)
        }
      } catch (error) {
        console.warn('Failed to parse post date:', error)
      }
    }
    
    // Final fallback: current date
    return this.formatDateForFilename(new Date())
  }

  /**
   * Extract date from filename patterns
   */
  private extractDateFromFilename(filename: string): string | null {
    // Common date patterns in filenames
    const patterns = [
      // IMG_20240315_123456.jpg, IMG_20240315.jpg
      /IMG_?(\d{4})(\d{2})(\d{2})/,
      // 2024-03-15, 2024_03_15
      /(\d{4})[-_](\d{2})[-_](\d{2})/,
      // 20240315
      /(\d{4})(\d{2})(\d{2})/,
      // Screenshot 2024-03-15 at 12.34.56
      /Screenshot\s+(\d{4})[-_](\d{2})[-_](\d{2})/,
      // Photo 2024-03-15
      /Photo\s+(\d{4})[-_](\d{2})[-_](\d{2})/
    ]
    
    for (const pattern of patterns) {
      const match = filename.match(pattern)
      if (match) {
        const [, year, month, day] = match
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        if (!isNaN(date.getTime())) {
          return this.formatDateForFilename(date)
        }
      }
    }
    
    return null
  }

  /**
   * Format date for use in filename
   */
  private formatDateForFilename(date: Date): string {
    return date.toISOString().split('T')[0] // YYYY-MM-DD format
  }
}