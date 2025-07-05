/**
 * Image storage service for handling Evernote images
 */

import { writeFile, mkdir, access, unlink, readdir } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'
import { getConfig } from './config'

export interface ImageInfo {
  originalHash: string
  filename: string
  mimeType: string
  size: number
  path: string
  url: string
}

export class ImageStorageService {
  private readonly baseDir: string
  private readonly baseUrl: string

  constructor() {
    this.baseDir = join(process.cwd(), 'public', 'images', 'posts')
    this.baseUrl = '/images/posts'
  }

  /**
   * Store an image with optional title for meaningful filename
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
      // Ensure the directory exists
      await this.ensureDirectoryExists()

      // Generate filename using new sophisticated system
      const extension = this.getExtensionFromMimeType(mimeType)
      const filename = await this.generateImageFilename(
        imageData, 
        title, 
        originalFilename, 
        extension, 
        postId
      )
      
      const filePath = join(this.baseDir, filename)
      const publicUrl = `${this.baseUrl}/${filename}`

      // Write the image file
      await writeFile(filePath, imageData)

      console.log(`Stored image: ${filename} (${imageData.length} bytes)`)

      return {
        originalHash,
        filename,
        mimeType,
        size: imageData.length,
        path: filePath,
        url: publicUrl
      }
    } catch (error) {
      console.error('Error storing image:', error)
      throw new Error(`Failed to store image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if an image already exists for a given hash and post
   */
  async imageExists(originalHash: string, postId: string): Promise<string | null> {
    try {
      await this.ensureDirectoryExists()
      
      const files = await readdir(this.baseDir)
      const hashPrefix = originalHash.substring(0, 8)
      
      // Look for files that match various patterns:
      // 1. Legacy: postId_*_[contentHash|originalHash].ext
      // 2. Title-based: postId_title_contentHash.ext  
      // 3. New structured: PREFIX_YYYYMMDD_SUFFIX.ext
      
      const candidateFiles = files.filter(file => {
        // Pattern 1: Legacy postId-based files
        if (file.startsWith(`${postId}_`) && file.includes(hashPrefix)) {
          return true
        }
        
        // Pattern 2: Check if it's a content hash we generated
        const contentHash = createHash('sha256').update(originalHash).digest('hex').substring(0, 8)
        if (file.includes(contentHash)) {
          return true
        }
        
        return false
      })
      
      // If we found candidate files, return the first one
      if (candidateFiles.length > 0) {
        const existingFile = candidateFiles[0]
        const publicUrl = `${this.baseUrl}/${existingFile}`
        console.log(`Image already exists: ${existingFile}`)
        return publicUrl
      }
      
      return null
    } catch (error) {
      console.error('Error checking if image exists:', error)
      return null
    }
  }

  /**
   * Delete all images for a post
   */
  async deletePostImages(postId: string): Promise<void> {
    try {
      const { readdir } = await import('fs/promises')
      const files = await readdir(this.baseDir)
      
      // Find files that start with the post ID
      const postFiles = files.filter(file => file.startsWith(`${postId}_`))
      
      for (const file of postFiles) {
        const filePath = join(this.baseDir, file)
        await unlink(filePath)
        console.log(`Deleted image: ${file}`)
      }
      
      if (postFiles.length > 0) {
        console.log(`Deleted ${postFiles.length} images for post ${postId}`)
      }
    } catch (error) {
      console.error(`Error deleting images for post ${postId}:`, error)
      // Don't throw - image cleanup is not critical
    }
  }

  /**
   * Generate sophisticated image filename using EXIF data and configuration
   */
  private async generateImageFilename(
    imageData: Buffer,
    title?: string,
    originalFilename?: string,
    extension?: string,
    postId?: string
  ): Promise<string> {
    const config = getConfig()
    
    // If we have a meaningful title/filename, use it
    if (title && title.trim()) {
      const sanitizedTitle = this.sanitizeFilename(title.trim())
      if (sanitizedTitle) {
        const contentHash = createHash('sha256').update(imageData).digest('hex').substring(0, 8)
        return `${postId}_${sanitizedTitle}_${contentHash}.${extension}`
      }
    }
    
    // Generate structured filename: PREFIX_YYYYMMDD_SUFFIX
    const prefix = config.images.defaultPrefix
    const dateStr = await this.extractImageDate(imageData)
    const numericSuffix = this.extractNumericSuffix(originalFilename)
    
    // Build base filename
    let baseFilename = `${prefix}_${dateStr}`
    if (numericSuffix) {
      baseFilename += `_${numericSuffix}`
    }
    
    // Ensure uniqueness by checking for duplicates and incrementing
    const finalFilename = await this.ensureUniqueImageFilename(baseFilename, extension!)
    
    return finalFilename
  }

  /**
   * Extract creation date from EXIF data or use current date
   */
  private async extractImageDate(imageData: Buffer): Promise<string> {
    const config = getConfig()
    
    if (config.images.useExifDates) {
      try {
        // Dynamic import to avoid issues if exifr is not available
        const exifr = await import('exifr')
        const exifData = await exifr.parse(imageData, { 
          tiff: true, 
          exif: true,
          gps: false,
          interop: false,
          ifd1: false
        })
        
        // Try various EXIF date fields in order of preference
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
          // Handle string dates
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
    
    // Fallback to current date
    return this.formatDateForFilename(new Date())
  }

  /**
   * Format date as YYYYMMDD
   */
  private formatDateForFilename(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}${month}${day}`
  }

  /**
   * Extract numeric suffix from original filename
   */
  private extractNumericSuffix(originalFilename?: string): string | null {
    if (!originalFilename) return null
    
    // Remove file extension first
    const nameWithoutExt = originalFilename.replace(/\.[^.]*$/, '')
    
    // Look for numeric sequence at the end: IMG_123, photo_001, etc.
    const match = nameWithoutExt.match(/_(\d+)$/)
    return match ? match[1] : null
  }

  /**
   * Ensure filename is unique by checking existing files and incrementing suffix
   */
  private async ensureUniqueImageFilename(baseFilename: string, extension: string): Promise<string> {
    await this.ensureDirectoryExists()
    
    try {
      const files = await readdir(this.baseDir)
      let counter = 1
      let candidateFilename = `${baseFilename}.${extension}`
      
      // Check if base filename exists
      while (files.includes(candidateFilename)) {
        // Extract existing numeric suffix if any
        const lastUnderscoreIndex = baseFilename.lastIndexOf('_')
        let baseWithoutSuffix = baseFilename
        let startCounter = counter
        
        if (lastUnderscoreIndex > 0) {
          const possibleSuffix = baseFilename.substring(lastUnderscoreIndex + 1)
          if (/^\d+$/.test(possibleSuffix)) {
            // Already has numeric suffix, increment from there
            baseWithoutSuffix = baseFilename.substring(0, lastUnderscoreIndex)
            startCounter = parseInt(possibleSuffix) + counter
          }
        }
        
        candidateFilename = `${baseWithoutSuffix}_${String(startCounter).padStart(3, '0')}.${extension}`
        counter++
        
        // Safety check to prevent infinite loop
        if (counter > 999) {
          // Fall back to hash-based naming
          const hash = createHash('sha256').update(baseFilename + Date.now()).digest('hex').substring(0, 8)
          candidateFilename = `${baseWithoutSuffix}_${hash}.${extension}`
          break
        }
      }
      
      return candidateFilename
    } catch (error) {
      console.error('Error checking filename uniqueness:', error)
      // Fallback to timestamp-based naming
      const timestamp = Date.now().toString()
      return `${baseFilename}_${timestamp}.${extension}`
    }
  }

  /**
   * Sanitize filename to remove invalid characters and limit length
   */
  private sanitizeFilename(title: string): string {
    let sanitized = title.toLowerCase()
    
    // Remove file extension if present (we'll add our own)
    sanitized = sanitized.replace(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i, '')
    
    return sanitized
      // Replace spaces and special characters with hyphens
      .replace(/[^a-z0-9\-_.]/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading/trailing hyphens
      .replace(/^-+|-+$/g, '')
      // Limit length to reasonable size (50 chars)
      .substring(0, 50)
      // Remove trailing hyphens again after truncation
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
      default:
        // Default to jpg for unknown types
        return 'jpg'
    }
  }

  /**
   * Ensure the storage directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await access(this.baseDir)
    } catch {
      // Directory doesn't exist, create it
      await mkdir(this.baseDir, { recursive: true })
      console.log(`Created image storage directory: ${this.baseDir}`)
    }
  }

  /**
   * Get image info from URL
   */
  getImageInfoFromUrl(url: string): { postId: string; hash: string } | null {
    try {
      const filename = url.split('/').pop()
      if (!filename) return null

      // Parse filename: postId_contentHash_originalHash.ext
      const match = filename.match(/^([^_]+)_[a-f0-9]+_([a-f0-9]+)\.\w+$/)
      if (!match) return null

      return {
        postId: match[1],
        hash: match[2]
      }
    } catch (error) {
      console.error('Error parsing image URL:', error)
      return null
    }
  }
}