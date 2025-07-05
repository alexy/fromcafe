/**
 * Image storage service for handling Evernote images
 */

import { writeFile, mkdir, access, unlink } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'

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
    title?: string
  ): Promise<ImageInfo> {
    try {
      // Ensure the directory exists
      await this.ensureDirectoryExists()

      // Generate filename based on title (if available) or hash
      const contentHash = createHash('sha256').update(imageData).digest('hex').substring(0, 16)
      const extension = this.getExtensionFromMimeType(mimeType)
      
      let filename: string
      if (title && title.trim()) {
        // Use title as filename with sanitization
        const sanitizedTitle = this.sanitizeFilename(title.trim())
        if (sanitizedTitle) {
          // Include short hash to avoid filename conflicts
          filename = `${postId}_${sanitizedTitle}_${contentHash.substring(0, 8)}.${extension}`
        } else {
          // Fallback to hash if title becomes empty after sanitization
          filename = `${postId}_${contentHash}_${originalHash.substring(0, 8)}.${extension}`
        }
      } else {
        // No title, use hash-based naming
        filename = `${postId}_${contentHash}_${originalHash.substring(0, 8)}.${extension}`
      }
      
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
      
      // Look for files that match the pattern: postId_*_[contentHash|originalHash].ext
      const { readdir } = await import('fs/promises')
      const files = await readdir(this.baseDir)
      
      const hashPrefix = originalHash.substring(0, 8)
      // Updated pattern to handle both title-based and hash-based filenames
      // Pattern: postId_[title|hash]_8-char-hash.ext
      const pattern = new RegExp(`^${postId}_.*_[a-f0-9]{8}\\.(jpg|jpeg|png|gif|webp|bmp|tiff)$`)
      
      // Find files that start with our post ID and check if they contain our hash
      const candidateFiles = files.filter(file => {
        if (!pattern.test(file)) return false
        // Check if the file contains our original hash (for legacy files)
        if (file.includes(hashPrefix)) return true
        // For new files, we'd need to check content hash, but since we're generating
        // content hash from the same data, we'll rely on the more specific search below
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