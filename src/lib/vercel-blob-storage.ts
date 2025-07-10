/**
 * Vercel Blob-based image storage service for serverless compatibility
 */

import { put, head, del, copy } from '@vercel/blob'
import { createHash } from 'crypto'
import { getConfig } from './config'
import { prisma } from './prisma'

export type NamingDecisionSource = 'TITLE' | 'EXIF_DATE' | 'POST_DATE' | 'CONTENT_HASH' | 'ORIGINAL_FILENAME'

export interface ExifMetadata {
  dateTimeOriginal?: string
  make?: string
  model?: string
  lensMake?: string
  lensModel?: string
  aperture?: number
  shutterSpeed?: string
  iso?: number
  focalLength?: number
  focalLengthIn35mm?: number
}

export interface ImageInfo {
  originalHash: string
  filename: string
  mimeType: string
  size: number
  url: string
  contentHash: string
  exifMetadata?: ExifMetadata
  namingDecision?: {
    source: NamingDecisionSource
    reason: string
  }
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
      console.log(`🔄 STORE-IMAGE-DEBUG: Post ${postId}, Hash ${originalHash.substring(0, 8)}:`, {
        title,
        originalFilename,
        exifDate,
        postDate
      })
      // Extract comprehensive EXIF metadata
      const exifMetadata = await this.extractExifMetadata(imageData)
      
      // Extract date if not provided
      if (!exifDate) {
        exifDate = exifMetadata.dateTimeOriginal ? 
          this.formatDateForFilename(new Date(exifMetadata.dateTimeOriginal)) :
          await this.extractImageDate(imageData, originalFilename, postDate)
      }
      
      // Check if we can just rename an existing image instead of uploading
      const renameResult = await this.tryRenameExistingImage(originalHash, postId, title, originalFilename, mimeType, exifDate, postDate)
      if (renameResult) {
        // Add EXIF metadata to the renamed image result
        return {
          ...renameResult,
          exifMetadata
        }
      }
      
      // Generate content hash for deduplication
      const contentHash = createHash('sha256').update(imageData).digest('hex').substring(0, 16)
      
      // Generate filename with naming decision tracking
      const extension = this.getExtensionFromMimeType(mimeType)
      const filenameResult = this.generateFilenameWithDecision(title, originalFilename, contentHash, extension, postId, exifDate)
      const filename = filenameResult.filename

      // At this point, we need to upload the image data
      
      // Check if new filename already exists (edge case)
      try {
        const existingBlob = await head(`images/${filename}`)
        if (existingBlob) {
          // Verify the existing blob is the same size to ensure it's the same file
          if (existingBlob.size === imageData.length) {
            console.log(`Image already exists in Vercel Blob: ${filename} (${existingBlob.size} bytes) - reusing existing`)
            
            return await this.recordNamingDecisionAndCreateResult(
              postId,
              originalHash,
              filename,
              existingBlob.url,
              filenameResult.decision,
              mimeType,
              existingBlob.size,
              contentHash,
              exifMetadata,
              title,
              exifDate,
              originalFilename
            )
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

      return await this.recordNamingDecisionAndCreateResult(
        postId,
        originalHash,
        filename,
        blob.url,
        filenameResult.decision,
        mimeType,
        imageData.length,
        contentHash,
        exifMetadata,
        title,
        exifDate,
        originalFilename
      )
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
   * Generate filename with decision tracking
   */
  private generateFilenameWithDecision(
    title?: string,
    originalFilename?: string,
    contentHash?: string,
    extension?: string,
    postId?: string,
    exifDate?: string
  ): { filename: string; decision: { source: NamingDecisionSource; reason: string } } {
    // Use the extracted date (already in YYYY-MM-DD format)
    const dateStr = exifDate
    
    // Use title if available and meaningful
    if (title && title.trim() && title.trim().length > 2) {
      const sanitized = this.sanitizeFilename(title.trim())
      if (sanitized) {
        const filename = dateStr ? `${postId}_${sanitized}_${dateStr}.${extension}` : `${postId}_${sanitized}.${extension}`
        return {
          filename,
          decision: {
            source: 'TITLE',
            reason: `Used post title "${title.trim()}" as primary naming source${dateStr ? ` with EXIF date ${dateStr}` : ''}`
          }
        }
      }
    }

    // Use original filename if available
    if (originalFilename) {
      const sanitized = this.sanitizeFilename(originalFilename.replace(/\.[^.]*$/, ''))
      if (sanitized) {
        const filename = dateStr ? `${postId}_${sanitized}_${dateStr}.${extension}` : `${postId}_${sanitized}.${extension}`
        return {
          filename,
          decision: {
            source: 'ORIGINAL_FILENAME',
            reason: `Used original filename "${originalFilename}" as title was not suitable${dateStr ? ` with EXIF date ${dateStr}` : ''}`
          }
        }
      }
    }

    // Fallback to structured naming with date if available
    if (dateStr) {
      return {
        filename: `${postId}_image_${dateStr}.${extension}`,
        decision: {
          source: 'EXIF_DATE',
          reason: `Used EXIF date ${dateStr} as neither title nor filename were suitable`
        }
      }
    } else {
      return {
        filename: `${postId}_image_${contentHash}.${extension}`,
        decision: {
          source: 'CONTENT_HASH',
          reason: 'Used content hash as fallback - no title, filename, or EXIF date available'
        }
      }
    }
  }

  /**
   * Record naming decision and create standardized return value
   */
  private async recordNamingDecisionAndCreateResult(
    postId: string,
    originalHash: string,
    filename: string,
    blobUrl: string,
    decision: { source: NamingDecisionSource; reason: string },
    mimeType: string,
    size: number,
    contentHash: string,
    exifMetadata?: ExifMetadata,
    originalTitle?: string,
    extractedDate?: string,
    originalFilename?: string
  ): Promise<ImageInfo> {
    // Record naming decision in database
    console.log(`📝 ABOUT TO RECORD naming decision for ${originalHash} in post ${postId}`)
    await this.recordNamingDecision(
      postId,
      originalHash,
      filename,
      blobUrl,
      decision,
      originalTitle,
      extractedDate,
      exifMetadata,
      originalFilename
    )

    return {
      originalHash,
      filename,
      mimeType,
      size,
      url: blobUrl,
      contentHash,
      exifMetadata,
      namingDecision: decision
    }
  }

  /**
   * Record naming decision in database
   */
  private async recordNamingDecision(
    postId: string,
    originalHash: string,
    blobFilename: string,
    blobUrl: string,
    decision: { source: NamingDecisionSource; reason: string },
    originalTitle?: string,
    extractedDate?: string,
    exifMetadata?: ExifMetadata,
    originalFilename?: string
  ): Promise<void> {
    try {
      // For Ghost upload pseudo-postIds, use null postId to avoid foreign key constraint
      const actualPostId = postId.startsWith('ghost-') ? null : postId
      
      await prisma.imageNamingDecision.upsert({
        where: { originalHash },
        create: {
          postId: actualPostId,
          originalHash,
          blobFilename,
          blobUrl,
          namingSource: decision.source,
          originalTitle,
          extractedDate,
          exifMetadata: exifMetadata ? JSON.parse(JSON.stringify(exifMetadata)) : null,
          originalFilename,
          decisionReason: decision.reason
        },
        update: {
          postId: actualPostId,
          blobFilename,
          blobUrl,
          namingSource: decision.source,
          originalTitle,
          extractedDate,
          exifMetadata: exifMetadata ? JSON.parse(JSON.stringify(exifMetadata)) : null,
          originalFilename,
          decisionReason: decision.reason,
          updatedAt: new Date()
        }
      })
      console.log(`Recorded naming decision for ${originalHash}: ${decision.source} - ${decision.reason}`)
    } catch (error) {
      console.error('Failed to record naming decision:', error)
      // Don't throw - this is for tracking only
    }
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
   * Extract comprehensive EXIF metadata from image
   */
  private async extractExifMetadata(imageData: Buffer): Promise<ExifMetadata> {
    const config = getConfig()
    
    if (!config.images.useExifDates) {
      return {}
    }
    
    try {
      const exifr = await import('exifr')
      const exifData = await exifr.parse(imageData, {
        tiff: true,
        exif: true,
        gps: false,
        interop: false,
        ifd1: false,
        pick: [
          'DateTimeOriginal', 'CreateDate', 'DateTime', 'DateTimeDigitized',
          'Make', 'Model', 'LensMake', 'LensModel', 'LensInfo',
          'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat'
        ]
      })
      
      if (!exifData) {
        return {}
      }
      
      // Extract date
      let dateTimeOriginal: string | undefined
      const dateFields = ['DateTimeOriginal', 'CreateDate', 'DateTime', 'DateTimeDigitized']
      for (const field of dateFields) {
        const date = exifData[field]
        if (date) {
          if (date instanceof Date) {
            dateTimeOriginal = date.toISOString()
            break
          }
          if (typeof date === 'string') {
            const parsedDate = new Date(date)
            if (!isNaN(parsedDate.getTime())) {
              dateTimeOriginal = parsedDate.toISOString()
              break
            }
          }
        }
      }
      
      // Extract lens information
      let lensModel = exifData.LensModel
      if (!lensModel && exifData.LensInfo) {
        // Try to construct lens model from LensInfo array
        const lensInfo = exifData.LensInfo
        if (Array.isArray(lensInfo) && lensInfo.length >= 4) {
          const [minFocal, maxFocal, minAperture, maxAperture] = lensInfo
          if (minFocal === maxFocal) {
            lensModel = `${minFocal}mm f/${minAperture}`
          } else {
            lensModel = `${minFocal}-${maxFocal}mm f/${minAperture}-${maxAperture}`
          }
        }
      }
      
      // Format shutter speed
      let shutterSpeed: string | undefined
      if (exifData.ExposureTime) {
        const exposureTime = exifData.ExposureTime
        if (exposureTime >= 1) {
          shutterSpeed = `${exposureTime}s`
        } else {
          shutterSpeed = `1/${Math.round(1 / exposureTime)}s`
        }
      }
      
      return {
        dateTimeOriginal,
        make: exifData.Make,
        model: exifData.Model,
        lensMake: exifData.LensMake,
        lensModel,
        aperture: exifData.FNumber,
        shutterSpeed,
        iso: exifData.ISO,
        focalLength: exifData.FocalLength,
        focalLengthIn35mm: exifData.FocalLengthIn35mmFormat
      }
    } catch (error) {
      console.warn('Failed to extract EXIF metadata:', error)
      return {}
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
    
    // Final fallback: use a clearly placeholder date instead of today's date
    // Using current date is misleading for old images
    console.warn(`No valid date found for image, using placeholder date 2000-01-01. Original filename: ${originalFilename}`)
    return '2000-01-01'
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

  /**
   * Generate camera/lens caption from EXIF metadata
   * Example: "Leica M10-R with Summicron-M 35/2.0"
   */
  static generateCameraCaption(exifMetadata: ExifMetadata, showMake: boolean = false): string | null {
    if (!exifMetadata.make && !exifMetadata.model) {
      return null
    }
    
    let caption = ''
    
    // Add camera make and/or model based on setting
    if (showMake) {
      // Show make and model
      if (exifMetadata.make && exifMetadata.model) {
        // Remove redundant make from model if present
        const model = exifMetadata.model.replace(new RegExp(`^${exifMetadata.make}\\s*`, 'i'), '')
        caption = `${exifMetadata.make} ${model}`
      } else if (exifMetadata.make) {
        caption = exifMetadata.make
      } else if (exifMetadata.model) {
        caption = exifMetadata.model
      }
    } else {
      // Show only model (current behavior)
      if (exifMetadata.model) {
        // Remove redundant make from model if present
        const model = exifMetadata.make 
          ? exifMetadata.model.replace(new RegExp(`^${exifMetadata.make}\\s*`, 'i'), '')
          : exifMetadata.model
        caption = model
      } else if (exifMetadata.make) {
        caption = exifMetadata.make
      }
    }
    
    // Add lens information
    if (exifMetadata.lensModel) {
      caption += ` with ${exifMetadata.lensModel}`
    } else if (exifMetadata.lensMake) {
      caption += ` with ${exifMetadata.lensMake}`
    }
    
    return caption || null
  }

  /**
   * Generate technical details caption from EXIF metadata
   * Example: "35mm · f/2.0 · 1/125s · ISO 400"
   */
  static generateTechnicalCaption(exifMetadata: ExifMetadata): string | null {
    const details: string[] = []
    
    // Add focal length
    if (exifMetadata.focalLength) {
      details.push(`${exifMetadata.focalLength}mm`)
    }
    
    // Add aperture
    if (exifMetadata.aperture) {
      details.push(`f/${exifMetadata.aperture}`)
    }
    
    // Add shutter speed
    if (exifMetadata.shutterSpeed) {
      details.push(exifMetadata.shutterSpeed)
    }
    
    // Add ISO
    if (exifMetadata.iso) {
      details.push(`ISO ${exifMetadata.iso}`)
    }
    
    return details.length > 0 ? details.join(' · ') : null
  }

  /**
   * Generate full caption combining camera and technical details
   */
  static generateFullCaption(exifMetadata: ExifMetadata, showMake: boolean = false): string | null {
    const cameraCaption = this.generateCameraCaption(exifMetadata, showMake)
    const technicalCaption = this.generateTechnicalCaption(exifMetadata)
    
    if (cameraCaption && technicalCaption) {
      return `${cameraCaption}\n<small>${technicalCaption}</small>`
    } else if (cameraCaption) {
      return cameraCaption
    } else if (technicalCaption) {
      return `<small>${technicalCaption}</small>`
    }
    
    return null
  }

  /**
   * Try to rename an existing image instead of re-uploading
   * Returns ImageInfo if successful, null if upload is needed
   */
  private async tryRenameExistingImage(
    originalHash: string,
    postId: string,
    title?: string,
    originalFilename?: string,
    mimeType?: string,
    exifDate?: string,
    postDate?: string
  ): Promise<ImageInfo | null> {
    console.log(`🔄 RENAME-DEBUG: Post ${postId}, Hash ${originalHash.substring(0, 8)}:`, {
      title,
      originalFilename,
      exifDate,
      postDate
    })
    // Extract date if not provided
    if (!exifDate) {
      // For rename operations, we need to get the date without image data
      // Use post date or current date as fallback
      if (postDate) {
        try {
          const parsedDate = new Date(postDate)
          if (!isNaN(parsedDate.getTime())) {
            exifDate = this.formatDateForFilename(parsedDate)
          }
        } catch {
          // Fall through to current date
        }
      }
      exifDate = exifDate || this.formatDateForFilename(new Date())
    }
    
    const existingImage = await this.imageExists(originalHash, postId)
    if (!existingImage) {
      return null // No existing image to rename
    }
    
    // Generate what the filename should be with current title
    const contentHash = createHash('sha256').update(originalHash).digest('hex').substring(0, 16)
    const extension = this.getExtensionFromMimeType(mimeType || 'image/jpeg')
    const filenameResult = this.generateFilenameWithDecision(title, originalFilename, contentHash, extension, postId, exifDate)
    const expectedFilename = filenameResult.filename
    
    console.log(`🔄 RENAME-FILENAME-DEBUG: Expected vs Existing:`, {
      expectedFilename,
      existingFilename: existingImage.filename,
      filenameMatch: existingImage.filename === expectedFilename,
      decision: filenameResult.decision
    })
    
    if (existingImage.filename === expectedFilename) {
      // No change needed, return existing image info
      try {
        const existingBlob = await head(`images/${existingImage.filename}`)
        
        return await this.recordNamingDecisionAndCreateResult(
          postId,
          originalHash,
          existingImage.filename,
          existingImage.url,
          filenameResult.decision,
          mimeType || 'image/jpeg',
          existingBlob?.size || 0,
          contentHash,
          undefined, // No EXIF metadata available in rename operations
          title,
          exifDate,
          originalFilename
        )
      } catch {
        return null // Blob doesn't exist, need to upload
      }
    }
    
    // Title has changed, rename the existing blob
    console.log(`Image title changed: ${existingImage.filename} -> ${expectedFilename} - renaming existing blob`)
    
    try {
      // Copy existing blob to new filename
      const copiedBlob = await copy(`images/${existingImage.filename}`, `images/${expectedFilename}`, {
        access: 'public'
      })
      
      // Delete old blob after successful copy
      await del(`images/${existingImage.filename}`)
      
      console.log(`Successfully renamed image: ${existingImage.filename} -> ${expectedFilename}`)
      
      // Get size from the copied blob
      const renamedBlob = await head(`images/${expectedFilename}`)
      
      return await this.recordNamingDecisionAndCreateResult(
        postId,
        originalHash,
        expectedFilename,
        copiedBlob.url,
        filenameResult.decision,
        mimeType || 'image/jpeg',
        renamedBlob?.size || 0,
        contentHash,
        undefined, // No EXIF metadata available in rename operations
        title,
        exifDate,
        originalFilename
      )
    } catch (error) {
      console.warn(`Failed to rename blob, will need to re-upload:`, error)
      return null // Fall back to upload
    }
  }
}