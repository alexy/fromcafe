/**
 * Unified content processor for handling images from multiple sources (Evernote, Ghost)
 */

import { createHash } from 'crypto'
import { VercelBlobStorageService } from '@/lib/vercel-blob-storage'
import { EvernoteService, EvernoteNote } from '@/lib/evernote'

export interface ImageProcessingResult {
  processedContent: string
  imageCount: number
  errors: string[]
}

export class ContentProcessor {
  private imageStorage: VercelBlobStorageService

  constructor() {
    this.imageStorage = new VercelBlobStorageService()
  }

  /**
   * Process Evernote ENML content with image handling
   */
  async processEvernoteContent(
    enmlContent: string, 
    note: EvernoteNote, 
    postId: string, 
    evernoteService: EvernoteService
  ): Promise<ImageProcessingResult> {
    const errors: string[] = []
    let imageCount = 0

    let html = enmlContent
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!DOCTYPE[^>]*>/g, '')
      .replace(/<en-note[^>]*>/g, '<div>')
      .replace(/<\/en-note>/g, '</div>')
    
    // Handle <en-media> tags - convert to <img> tags
    const mediaTagRegex = /<en-media[^>]*hash="([^"]+)"[^>]*\/>/g
    let match
    const mediaReplacements: Array<{ tag: string; replacement: string }> = []
    
    while ((match = mediaTagRegex.exec(html)) !== null) {
      const fullTag = match[0]
      const hash = match[1]
      
      // Find the corresponding resource
      const resource = note.resources?.find(r => r.data.bodyHash === hash)
      if (!resource) {
        console.warn(`Resource not found for hash: ${hash}`)
        errors.push(`Image resource not found: ${hash}`)
        mediaReplacements.push({ tag: fullTag, replacement: '' })
        continue
      }
      
      try {
        // Check if image already exists
        let imageUrl = await this.imageStorage.imageExists(hash, postId)
        
        if (!imageUrl) {
          // Download and store the image
          const imageData = await evernoteService.getResourceData(resource.guid)
          if (imageData) {
            // Extract title from en-media tag attributes
            const titleMatch = fullTag.match(/title="([^"]+)"/)
            const altMatch = fullTag.match(/alt="([^"]+)"/)
            const title = titleMatch?.[1] || altMatch?.[1] || undefined
            
            const imageInfo = await this.imageStorage.storeImage(imageData, hash, resource.mime, postId, title)
            imageUrl = imageInfo.url
            console.log(`Stored Evernote image: ${imageInfo.filename} for post ${postId}${title ? ` (title: "${title}")` : ''}`)
          }
        } else {
          console.log(`Using existing Evernote image: ${imageUrl} for post ${postId}`)
        }
        
        if (imageUrl) {
          // Extract width and height from the en-media tag if available
          const widthMatch = fullTag.match(/width="([^"]+)"/)
          const heightMatch = fullTag.match(/height="([^"]+)"/)
          
          let imgAttributes = `src="${imageUrl}" alt="Image"`
          
          if (widthMatch && heightMatch) {
            imgAttributes += ` width="${widthMatch[1]}" height="${heightMatch[1]}"`
          } else if (resource.width && resource.height) {
            imgAttributes += ` width="${resource.width}" height="${resource.height}"`
          }
          
          const imgTag = `<img ${imgAttributes} />`
          mediaReplacements.push({ tag: fullTag, replacement: imgTag })
          imageCount++
        } else {
          errors.push(`Failed to process image: ${hash}`)
          mediaReplacements.push({ tag: fullTag, replacement: '' })
        }
      } catch (error) {
        const errorMsg = `Error processing Evernote image with hash ${hash}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
        mediaReplacements.push({ tag: fullTag, replacement: '' })
      }
    }
    
    // Apply all replacements
    for (const { tag, replacement } of mediaReplacements) {
      html = html.replace(tag, replacement)
    }
    
    return {
      processedContent: html,
      imageCount,
      errors
    }
  }

  /**
   * Process Ghost HTML content with image handling
   */
  async processGhostContent(
    htmlContent: string,
    postId: string
  ): Promise<ImageProcessingResult> {
    const errors: string[] = []
    let imageCount = 0
    let processedContent = htmlContent

    // Find all <img> tags with external URLs
    const imgTagRegex = /<img[^>]+src="([^"]+)"[^>]*>/g
    let match
    const imageReplacements: Array<{ tag: string; replacement: string }> = []

    while ((match = imgTagRegex.exec(htmlContent)) !== null) {
      const fullTag = match[0]
      const imageUrl = match[1]

      // Skip if image is already local (starts with / or our domain)
      if (imageUrl.startsWith('/') || imageUrl.includes('/images/posts/')) {
        continue
      }

      // Skip data URLs
      if (imageUrl.startsWith('data:')) {
        continue
      }

      try {
        // Generate a hash for the external URL to check if we've already downloaded it
        const urlHash = this.generateUrlHash(imageUrl)
        
        // Check if we already have this image
        let localImageUrl = await this.imageStorage.imageExists(urlHash, postId)
        
        if (!localImageUrl) {
          // Download and store the external image
          const imageData = await this.downloadExternalImage(imageUrl)
          if (imageData) {
            // Extract filename/title/alt from img tag
            // Ghost's "Export As" field can be stored in various data attributes
            const exportAsMatch = fullTag.match(/data-export-as="([^"]+)"/)
            const filenameMatch = fullTag.match(/data-filename="([^"]+)"/)
            const titleMatch = fullTag.match(/title="([^"]+)"/)
            const altMatch = fullTag.match(/alt="([^"]+)"/)
            
            // Priority: export-as > filename > title > alt
            const title = exportAsMatch?.[1] || filenameMatch?.[1] || titleMatch?.[1] || altMatch?.[1] || undefined
            
            // Extract original filename from URL
            const originalFilename = this.extractFilenameFromUrl(imageUrl)
            
            // Determine MIME type from image data or URL
            const mimeType = this.detectMimeType(imageData, imageUrl)
            const imageInfo = await this.imageStorage.storeImage(imageData, urlHash, mimeType, postId, title, originalFilename)
            localImageUrl = imageInfo.url
            
            // Log which attribute was used for the filename
            let sourceAttribute = ''
            if (exportAsMatch?.[1]) sourceAttribute = ' (from export-as)'
            else if (filenameMatch?.[1]) sourceAttribute = ' (from filename)'
            else if (titleMatch?.[1]) sourceAttribute = ' (from title)'
            else if (altMatch?.[1]) sourceAttribute = ' (from alt)'
            
            console.log(`Downloaded and stored Ghost image: ${imageInfo.filename} for post ${postId}${title ? ` (title: "${title}"${sourceAttribute})` : ''}`)
          }
        } else {
          console.log(`Using existing Ghost image: ${localImageUrl} for post ${postId}`)
        }

        if (localImageUrl) {
          // Replace the external URL with the local URL
          const newTag = fullTag.replace(imageUrl, localImageUrl)
          imageReplacements.push({ tag: fullTag, replacement: newTag })
          imageCount++
        } else {
          errors.push(`Failed to download image: ${imageUrl}`)
        }
      } catch (error) {
        const errorMsg = `Error processing Ghost image ${imageUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        errors.push(errorMsg)
      }
    }

    // Apply all replacements
    for (const { tag, replacement } of imageReplacements) {
      processedContent = processedContent.replace(tag, replacement)
    }

    return {
      processedContent,
      imageCount,
      errors
    }
  }

  /**
   * Download an external image
   */
  private async downloadExternalImage(imageUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FromCafe/1.0)'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error(`Invalid content type: ${contentType}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      console.error(`Failed to download image ${imageUrl}:`, error)
      return null
    }
  }

  /**
   * Extract filename from URL
   */
  private extractFilenameFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop()
      
      // Only return if it looks like a real filename (has extension)
      if (filename && filename.includes('.')) {
        return filename
      }
    } catch {
      // Invalid URL, ignore
    }
    return undefined
  }

  /**
   * Generate a hash for a URL to use as a unique identifier
   */
  private generateUrlHash(url: string): string {
    return createHash('sha256').update(url).digest('hex').substring(0, 16)
  }

  /**
   * Detect MIME type from image data or URL
   */
  private detectMimeType(imageData: Buffer, url: string): string {
    // Check magic bytes
    if (imageData.length >= 4) {
      const header = imageData.subarray(0, 4)
      
      // PNG: 89 50 4E 47
      if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
        return 'image/png'
      }
      
      // JPEG: FF D8 FF
      if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
        return 'image/jpeg'
      }
      
      // GIF: 47 49 46 38
      if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
        return 'image/gif'
      }
      
      // WebP: starts with RIFF and contains WEBP
      if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
        const webpCheck = imageData.subarray(8, 12)
        if (webpCheck[0] === 0x57 && webpCheck[1] === 0x45 && webpCheck[2] === 0x42 && webpCheck[3] === 0x50) {
          return 'image/webp'
        }
      }
    }

    // Fallback to URL extension
    const urlLower = url.toLowerCase()
    if (urlLower.endsWith('.png')) return 'image/png'
    if (urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg')) return 'image/jpeg'
    if (urlLower.endsWith('.gif')) return 'image/gif'
    if (urlLower.endsWith('.webp')) return 'image/webp'
    if (urlLower.endsWith('.bmp')) return 'image/bmp'
    if (urlLower.endsWith('.tiff') || urlLower.endsWith('.tif')) return 'image/tiff'

    // Default fallback
    return 'image/jpeg'
  }

  /**
   * Clean up images for a deleted post
   */
  async cleanupPostImages(postId: string): Promise<void> {
    await this.imageStorage.deletePostImages(postId)
  }

  /**
   * Generate excerpt from content (removing images)
   */
  generateExcerpt(content: string, maxLength: number = 200): string {
    // Remove XML/HTML tags and clean up text
    const text = content
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/<!DOCTYPE[^>]*>/g, '')
      .replace(/<en-note[^>]*>/g, '')
      .replace(/<\/en-note>/g, '')
      .replace(/<en-media[^>]*\/>/g, '') // Remove Evernote media tags
      .replace(/<img[^>]*>/g, '') // Remove HTML img tags
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
    
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
  }
}