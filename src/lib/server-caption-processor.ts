/**
 * Server-side caption processing utility for dynamic caption rendering
 */

import { 
  generateFullCaption, 
  type CaptionExifMetadata 
} from '@/lib/caption-utils'

// Type alias for backward compatibility
type ExtendedExifMetadata = CaptionExifMetadata

/**
 * Process HTML content server-side to replace empty figcaptions with actual captions
 */
export function processCaptionsServerSide(htmlContent: string, showCameraMake: boolean = false): string {
  if (!htmlContent) {
    return ''
  }

  // Find all figcaption tags with data-exif attributes and replace them with actual captions
  return htmlContent.replace(/<figcaption\s+data-exif="([^"]*)"[^>]*><\/figcaption>/g, (match, exifData) => {
    try {
      // Decode HTML entities in the JSON data
      const decodedData = exifData.replace(/&quot;/g, '"')
      const metadata: ExtendedExifMetadata = JSON.parse(decodedData)
      
      // Generate caption using the shared utility
      const caption = generateFullCaption(metadata, showCameraMake)
      
      if (caption) {
        return `<figcaption data-exif="${exifData}">${caption}</figcaption>`
      }
    } catch (err) {
      console.error('Error processing EXIF data in figcaption:', err)
    }
    
    // Return empty figcaption if processing fails
    return `<figcaption data-exif="${exifData}"></figcaption>`
  })
}