/**
 * Unified content processor for handling images from multiple sources (Evernote, Ghost)
 */

import { createHash } from 'crypto'
import { VercelBlobStorageService, ExifMetadata } from '@/lib/vercel-blob-storage'
import { EvernoteService, EvernoteNote } from '@/lib/evernote'
import { prisma } from '@/lib/prisma'

export interface ImageProcessingResult {
  processedContent: string
  imageCount: number
  errors: string[]
}

// Extended resource interface to include EXIF metadata and attributes
interface ResourceWithExif {
  guid: string
  data: {
    bodyHash: string | Buffer
    size: number
    body?: Buffer
  }
  mime: string
  width?: number
  height?: number
  attributes?: {
    filename?: string
    attachment?: boolean
  }
  exifMetadata?: ExifMetadata
}

export class ContentProcessor {
  private imageStorage: VercelBlobStorageService
  private currentGhostImageExif?: ExifMetadata

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
    evernoteService: EvernoteService,
    showCameraMake: boolean = false // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<ImageProcessingResult> {
    console.log(`🖼️ Processing Evernote content for post ${postId}, note: "${note.title}"`)
    console.log(`📄 ENML content length: ${enmlContent.length}`)
    console.log(`📄 ENML preview: ${enmlContent.substring(0, 200)}...`)
    console.log(`🔗 Note resources count: ${note.resources?.length || 0}`)
    
    // CRITICAL DEBUG: Force logging of resources information
    if (note.resources && note.resources.length > 0) {
      console.log(`🔗 CRITICAL: Available resources in note:`)
      note.resources.forEach((r, i) => {
        console.log(`  Resource ${i + 1}: GUID=${r.guid}, hash=${r.data.bodyHash}, mime=${r.mime}, size=${r.data.size}`)
      })
    } else {
      console.log(`🚨 CRITICAL: NO RESOURCES FOUND IN NOTE - this explains missing images!`)
    }
    
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
    
    // First, find all en-media tags in the content
    const allMatches = [...html.matchAll(mediaTagRegex)]
    console.log(`🔍 Found ${allMatches.length} en-media tags in ENML`)
    allMatches.forEach((m, i) => {
      console.log(`  📎 Media tag ${i + 1}: hash="${m[1]}", full tag: ${m[0]}`)
    })
    
    // Reset regex for processing
    mediaTagRegex.lastIndex = 0
    
    while ((match = mediaTagRegex.exec(html)) !== null) {
      const fullTag = match[0]
      const hash = match[1]
      console.log(`🔄 CRITICAL: Processing en-media tag with hash: ${hash}`)
      
      // Find the corresponding resource - convert Buffer hash to hex string for comparison
      const resource = note.resources?.find(r => {
        const resourceHash = Buffer.isBuffer(r.data.bodyHash) 
          ? r.data.bodyHash.toString('hex')
          : r.data.bodyHash
        return resourceHash === hash
      })
      
      if (!resource) {
        console.log(`🚨 CRITICAL: Resource not found for hash: ${hash}`)
        console.log(`📋 CRITICAL: Searching through ${note.resources?.length || 0} available resources:`)
        if (note.resources && note.resources.length > 0) {
          note.resources.forEach((r, i) => {
            const resourceHash = Buffer.isBuffer(r.data.bodyHash) 
              ? r.data.bodyHash.toString('hex')
              : r.data.bodyHash
            console.log(`  Resource ${i + 1}: hash=${resourceHash} (looking for ${hash})`)
          })
        } else {
          console.log(`  NO RESOURCES AVAILABLE IN NOTE!`)
        }
        
        // Create a placeholder for missing images instead of removing them completely
        const placeholderText = `[Missing Image: ${hash.substring(0, 8)}...]`
        const placeholderHtml = `<div class="missing-image" style="border: 2px dashed #ccc; padding: 20px; margin: 10px 0; text-align: center; color: #666; background: #f9f9f9;">
          <p>📷 ${placeholderText}</p>
          <small>Image resource not found in Evernote. Hash: ${hash}</small>
        </div>`
        
        errors.push(`Image resource not found: ${hash} - showing placeholder`)
        mediaReplacements.push({ tag: fullTag, replacement: placeholderHtml })
        console.log(`🔄 CRITICAL: Replaced missing image with placeholder: ${placeholderText}`)
        continue
      }
      
      console.log(`✅ CRITICAL: Found matching resource for hash ${hash}: GUID=${resource.guid}, mime=${resource.mime}, size=${resource.data.size}`)
      
      try {
        // Extract title from en-media tag attributes
        const titleMatch = fullTag.match(/title="([^"]+)"/)
        const altMatch = fullTag.match(/alt="([^"]+)"/)
        const title = titleMatch?.[1] || altMatch?.[1] || undefined
        
        // Get the original filename from resource attributes FIRST (fetch once and cache)
        let resourceWithAttributes: { data: Buffer; attributes?: { filename?: string; attachment?: boolean } } | null = null
        
        // Always fetch resource with attributes to get the filename - this is the reliable way
        resourceWithAttributes = await evernoteService.getResourceWithAttributes(resource.guid)
        
        // Extract filename from the fetched resource
        const originalFilename = resourceWithAttributes?.attributes?.filename?.trim() || undefined
        console.log(`🔍 FILENAME-CAPTURE: originalFilename="${originalFilename}" from resource ${resource.guid}`)
        
        // Check if image already exists AFTER we have the filename
        const existingImage = await this.imageStorage.imageExists(hash, postId)
        let imageUrl = existingImage?.url
        
        // Always re-process if title or filename has changed or image doesn't exist
        const shouldReprocess = !existingImage || 
          (title && !existingImage.filename.includes(this.sanitizeFilename(title))) ||
          (originalFilename && !existingImage.filename.includes(this.sanitizeFilename(originalFilename.replace(/\.[^.]*$/, '')))) ||
          // Force reprocess if we have a meaningful filename but current filename suggests fallback naming
          (originalFilename && originalFilename.length > 3 && existingImage?.filename.includes('_image_'))
        
        // Always log for debugging
        console.log(`🔄 REPROCESS-DEBUG: Post ${postId}, Hash ${hash.substring(0, 8)}:`, {
          existingFilename: existingImage?.filename,
          title,
          originalFilename,
          shouldReprocess,
          hasExistingImage: !!existingImage
        })
        
        // Additional debug: Check if we have the resourceWithAttributes
        console.log(`🔄 RESOURCE-DEBUG: resourceWithAttributes exists: ${!!resourceWithAttributes}, filename: "${resourceWithAttributes?.attributes?.filename}", originalFilename: "${originalFilename}"`)
        
        if (shouldReprocess) {
          // Convert Evernote timestamp to date string
          const postDate = new Date(note.created).toISOString()
          
          // Try to handle renaming without downloading image data first
          let imageData: Buffer | null = null
          
          // Use cached resource data (we already fetched it above)
          if (resourceWithAttributes) {
            imageData = resourceWithAttributes.data
          } else {
            // Fallback to basic resource data fetch
            imageData = await evernoteService.getResourceData(resource.guid)
          }
          
          if (imageData) {
            // The storage service will handle renaming vs uploading efficiently
            console.log(`🔍 FILENAME-FLOW-4: About to call storeImage with title="${title}", originalFilename="${originalFilename}"`)
            const imageInfo = await this.imageStorage.storeImage(imageData, hash, resource.mime, postId, title, originalFilename, undefined, postDate)
            imageUrl = imageInfo.url
            
            // Store EXIF metadata for caption generation
            if (imageInfo.exifMetadata) {
              (resource as ResourceWithExif).exifMetadata = imageInfo.exifMetadata
            }
            
            const action = existingImage ? 'Updated' : 'Stored'
            console.log(`${action} Evernote image: ${imageInfo.filename} for post ${postId}${title ? ` (title: "${title}")` : ''}${originalFilename ? ` (filename: "${originalFilename}")` : ''}`)
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
          
          // Generate figure with EXIF data for dynamic caption rendering
          let imgHtml = `<img ${imgAttributes} />`
          
          const exifMetadata = (resource as ResourceWithExif).exifMetadata
          if (exifMetadata) {
            // Store EXIF data in data-exif attribute for dynamic caption rendering
            const exifDataJson = JSON.stringify(exifMetadata)
            imgHtml = `<figure>
              ${imgHtml}
              <figcaption data-exif="${exifDataJson.replace(/"/g, '&quot;')}"></figcaption>
            </figure>`
          }
          
          mediaReplacements.push({ tag: fullTag, replacement: imgHtml })
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
    postId: string,
    showCameraMake: boolean = false // eslint-disable-line @typescript-eslint/no-unused-vars
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

      // Skip if image is already local (starts with / or our domain or blob URLs)
      if (imageUrl.startsWith('/') || 
          imageUrl.includes('/images/') || 
          imageUrl.includes('blob.vercel-storage.com') ||
          imageUrl.includes('fromcafe.art') ||
          imageUrl.includes('alexy.fromcafe.art')) {
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
        const existingImage = await this.imageStorage.imageExists(urlHash, postId)
        let localImageUrl = existingImage?.url
        
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
            // For Ghost posts, query the database to get the post creation date
            let postDate: string | undefined
            try {
              const post = await prisma.post.findUnique({
                where: { id: postId },
                select: { createdAt: true }
              })
              postDate = post?.createdAt.toISOString()
            } catch (error) {
              console.warn('Failed to fetch post creation date:', error)
            }
            
            const imageInfo = await this.imageStorage.storeImage(imageData, urlHash, mimeType, postId, title, originalFilename, undefined, postDate)
            localImageUrl = imageInfo.url
            
            // Store EXIF metadata for caption generation
            if (imageInfo.exifMetadata) {
              this.currentGhostImageExif = imageInfo.exifMetadata
            }
            
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
          let newTag = fullTag.replace(imageUrl, localImageUrl)
          
          // Add EXIF data for dynamic caption rendering
          const exifMetadata = this.currentGhostImageExif
          if (exifMetadata) {
            // Store EXIF data in data-exif attribute for dynamic caption rendering
            const exifDataJson = JSON.stringify(exifMetadata)
            
            // Check if image is already wrapped in a figure tag
            const imgMatch = newTag.match(/<img[^>]*>/i)
            if (imgMatch && !newTag.includes('<figure>')) {
              // Only wrap if not already in a figure
              const imgTag = imgMatch[0]
              newTag = `<figure>
                ${imgTag}
                <figcaption data-exif="${exifDataJson.replace(/"/g, '&quot;')}"></figcaption>
              </figure>`
            } else if (imgMatch && newTag.includes('<figure>')) {
              // If already in figure, just add/update the figcaption
              if (newTag.includes('<figcaption>')) {
                // Replace existing figcaption with EXIF data
                newTag = newTag.replace(/<figcaption[^>]*>[\s\S]*?<\/figcaption>/g, `<figcaption data-exif="${exifDataJson.replace(/"/g, '&quot;')}"></figcaption>`)
              } else {
                // Add figcaption before closing figure
                newTag = newTag.replace('</figure>', `  <figcaption data-exif="${exifDataJson.replace(/"/g, '&quot;')}"></figcaption>\n</figure>`)
              }
            }
            // Clear the temporary EXIF metadata
            this.currentGhostImageExif = undefined
          }
          
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

  /**
   * Sanitize filename for web safety (same as VercelBlobStorageService)
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
}