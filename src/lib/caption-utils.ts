/**
 * Shared caption generation utilities
 * Consolidates caption logic to avoid duplication between storage and server processing
 */

// Unified EXIF metadata interface
export interface CaptionExifMetadata {
  make?: string
  model?: string
  lensMake?: string
  lensModel?: string
  lens?: string // Legacy field from migrations
  aperture?: number
  shutterSpeed?: string
  iso?: number | string
  focalLength?: number | string
  focalLengthIn35mm?: number
  dateTimeOriginal?: string
}

/**
 * Generate camera/lens caption from EXIF metadata
 * Example: "Leica M10-R with Summicron-M 35/2.0"
 * Handles iPhone repetition: "iPhone 15 Pro Max back triple camera 15.66mm f/2.8"
 */
export function generateCameraCaption(exifMetadata: CaptionExifMetadata, showMake: boolean = false): string | null {
  return generateCameraCaptionWithDetails(exifMetadata, showMake).caption
}

/**
 * Generate camera/lens caption with detailed information about processing decisions
 * Used for tracking prefix compression and other caption generation decisions
 */
export function generateCameraCaptionWithDetails(exifMetadata: CaptionExifMetadata, showMake: boolean = false): {
  caption: string | null
  prefixCompressed: boolean
  originalCamera: string | null
  originalLens: string | null
} {
  if (!exifMetadata.make && !exifMetadata.model) {
    return {
      caption: null,
      prefixCompressed: false,
      originalCamera: null,
      originalLens: null
    }
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
  
  // Track original values for decision recording
  const originalCamera = caption
  const lensInfo = exifMetadata.lensModel || exifMetadata.lens
  let prefixCompressed = false
  
  // Add lens information (check both lensModel and legacy lens field)
  if (lensInfo) {
    // Check if the camera model is fully repeated in the lens model
    // If so, omit the camera model and "with" - just show the lens model
    if (caption && lensInfo.includes(caption)) {
      // Camera model is repeated in lens model, use just the lens model
      caption = lensInfo
      prefixCompressed = true
    } else {
      // Normal case: camera model with lens model
      caption += ` with ${lensInfo}`
    }
  } else if (exifMetadata.lensMake) {
    caption += ` with ${exifMetadata.lensMake}`
  }
  
  return {
    caption: caption || null,
    prefixCompressed,
    originalCamera,
    originalLens: lensInfo || null
  }
}

/**
 * Generate technical details caption from EXIF metadata
 * Example: "35mm · f/2.0 · 1/125s · ISO 400"
 */
export function generateTechnicalCaption(exifMetadata: CaptionExifMetadata): string | null {
  const details: string[] = []
  
  // Add focal length
  if (exifMetadata.focalLength) {
    const focal = typeof exifMetadata.focalLength === 'string' 
      ? exifMetadata.focalLength 
      : `${exifMetadata.focalLength}mm`
    details.push(focal)
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
    const iso = typeof exifMetadata.iso === 'string' 
      ? exifMetadata.iso 
      : `ISO ${exifMetadata.iso}`
    details.push(iso)
  }
  
  return details.length > 0 ? details.join(' · ') : null
}

/**
 * Generate full caption combining camera and technical details
 */
export function generateFullCaption(exifMetadata: CaptionExifMetadata, showMake: boolean = false): string | null {
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