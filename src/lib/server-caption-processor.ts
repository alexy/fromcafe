/**
 * Server-side caption processing utility for dynamic caption rendering
 */

// Extended EXIF metadata that includes migrated data
interface ExtendedExifMetadata {
  make?: string
  model?: string
  lens?: string
  lensModel?: string
  focalLength?: string | number
  shutterSpeed?: string
  iso?: string | number
  dateTimeOriginal?: string
  lensMake?: string
  aperture?: number
  focalLengthIn35mm?: number
}

/**
 * Generate camera caption based on EXIF metadata and settings
 */
function generateCameraCaption(exifMetadata: ExtendedExifMetadata, showMake: boolean = false): string | null {
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
  
  // Add lens information (check both lens property and lensModel)
  const lensInfo = exifMetadata.lens || exifMetadata.lensModel
  if (lensInfo) {
    caption += ` with ${lensInfo}`
  }
  
  return caption
}

/**
 * Generate technical caption from EXIF metadata
 */
function generateTechnicalCaption(exifMetadata: ExtendedExifMetadata): string | null {
  const parts: string[] = []
  
  if (exifMetadata.focalLength) {
    parts.push(String(exifMetadata.focalLength))
  }
  
  if (exifMetadata.shutterSpeed) {
    parts.push(exifMetadata.shutterSpeed)
  }
  
  if (exifMetadata.iso) {
    parts.push(String(exifMetadata.iso))
  }
  
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Generate full caption with camera and technical information
 */
function generateFullCaption(exifMetadata: ExtendedExifMetadata, showMake: boolean = false): string | null {
  const cameraCaption = generateCameraCaption(exifMetadata, showMake)
  const technicalCaption = generateTechnicalCaption(exifMetadata)
  
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
      
      // Generate caption using the current settings
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