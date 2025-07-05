/**
 * Application configuration
 */

export interface ImageConfig {
  /** Default prefix for generated image filenames */
  defaultPrefix: string
  /** Whether to extract EXIF data for dates */
  useExifDates: boolean
  /** Maximum filename length */
  maxFilenameLength: number
}

export interface AppConfig {
  images: ImageConfig
}

/**
 * Default application configuration
 */
export const defaultConfig: AppConfig = {
  images: {
    defaultPrefix: 'Alexy',
    useExifDates: true,
    maxFilenameLength: 100
  }
}

/**
 * Get configuration with environment variable overrides
 */
export function getConfig(): AppConfig {
  return {
    images: {
      defaultPrefix: process.env.IMAGE_PREFIX || defaultConfig.images.defaultPrefix,
      useExifDates: process.env.USE_EXIF_DATES !== 'false', // Default true unless explicitly disabled
      maxFilenameLength: parseInt(process.env.MAX_FILENAME_LENGTH || '100') || defaultConfig.images.maxFilenameLength
    }
  }
}