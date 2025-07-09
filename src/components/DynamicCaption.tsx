'use client'

import { useEffect, useState } from 'react'

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
 * Client-side caption generation function
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

interface DynamicCaptionProps {
  exifData?: string | ExtendedExifMetadata
  showCameraMake?: boolean
  className?: string
}

/**
 * Component that renders image captions dynamically based on EXIF data and settings
 */
export default function DynamicCaption({ 
  exifData, 
  showCameraMake = false, 
  className = '' 
}: DynamicCaptionProps) {
  const [caption, setCaption] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!exifData) {
      setCaption(null)
      return
    }

    try {
      let metadata: ExtendedExifMetadata
      
      if (typeof exifData === 'string') {
        // Parse JSON string from data-exif attribute
        metadata = JSON.parse(exifData)
      } else {
        // Use object directly
        metadata = exifData
      }

      // Generate caption using the client-side function
      const generatedCaption = generateFullCaption(metadata, showCameraMake)
      setCaption(generatedCaption)
      setError(null)
    } catch (err) {
      console.error('Error parsing EXIF data:', err)
      setError('Failed to parse image metadata')
      setCaption(null)
    }
  }, [exifData, showCameraMake])

  // Don't render anything if no caption or error
  if (!caption) {
    return error ? <span className="text-red-500 text-xs">Error: {error}</span> : null
  }

  return (
    <span className={className} dangerouslySetInnerHTML={{ __html: caption }} />
  )
}

/**
 * Hook to process all figcaptions in HTML content and add dynamic captions
 */
export function useDynamicCaptions(htmlContent: string, showCameraMake: boolean = false) {
  const [processedContent, setProcessedContent] = useState<string>(htmlContent)

  useEffect(() => {
    if (!htmlContent) {
      setProcessedContent('')
      return
    }

    // Process HTML to add dynamic captions
    const processHTML = (html: string) => {
      console.log('🔍 Processing HTML for figcaptions...')
      console.log('📄 HTML content:', html.substring(0, 500) + '...')
      
      // Find all figcaption tags with data-exif attributes
      const figcaptionMatches = html.match(/<figcaption\s+data-exif="([^"]*)"[^>]*><\/figcaption>/g)
      console.log('🎯 Found figcaption matches:', figcaptionMatches)
      
      return html.replace(/<figcaption\s+data-exif="([^"]*)"[^>]*><\/figcaption>/g, (match, exifData) => {
        console.log('🔄 Processing figcaption match:', match)
        console.log('📊 Raw EXIF data:', exifData)
        
        try {
          // Decode HTML entities in the JSON data
          const decodedData = exifData.replace(/&quot;/g, '"')
          console.log('📊 Decoded EXIF data:', decodedData)
          
          const metadata: ExtendedExifMetadata = JSON.parse(decodedData)
          console.log('📊 Parsed metadata:', metadata)
          
          // Generate caption using the current settings
          const caption = generateFullCaption(metadata, showCameraMake)
          console.log('📝 Generated caption:', caption)
          
          if (caption) {
            const result = `<figcaption data-exif="${exifData}">${caption}</figcaption>`
            console.log('✅ Final figcaption result:', result)
            return result
          }
        } catch (err) {
          console.error('❌ Error processing EXIF data in figcaption:', err)
          console.error('Failed to process:', { exifData, decodedData: exifData.replace(/&quot;/g, '"') })
        }
        
        // Return empty figcaption if processing fails
        console.log('⚠️ Returning empty figcaption')
        return `<figcaption data-exif="${exifData}"></figcaption>`
      })
    }

    console.log('🚀 useDynamicCaptions called with:')
    console.log('📄 HTML content length:', htmlContent.length)
    console.log('🎚️ showCameraMake:', showCameraMake)
    console.log('📄 HTML preview:', htmlContent.substring(0, 300) + '...')
    
    const processed = processHTML(htmlContent)
    console.log('✅ Final processed content:', processed.substring(0, 300) + '...')
    
    setProcessedContent(processed)
  }, [htmlContent, showCameraMake])

  return processedContent
}