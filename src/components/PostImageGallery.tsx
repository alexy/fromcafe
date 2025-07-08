'use client'

import { useEffect, useState, useCallback } from 'react'
import FsLightbox from 'fslightbox-react'

interface PostImageGalleryProps {
  postContentSelector?: string
}

export default function PostImageGallery({ postContentSelector = '.prose' }: PostImageGalleryProps) {
  const [lightboxController, setLightboxController] = useState({
    toggler: false,
    slide: 1
  })
  const [images, setImages] = useState<string[]>([])

  const handleImageClick = useCallback((index: number) => {
    setLightboxController(prev => ({
      toggler: !prev.toggler,
      slide: index + 1
    }))
  }, [])

  useEffect(() => {
    // Find all images within the post content
    const postContent = document.querySelector(postContentSelector)
    if (!postContent) return

    const imageElements = postContent.querySelectorAll('img')
    const imageSources = Array.from(imageElements).map(img => img.src)
    setImages(imageSources)

    // Add click handlers to images
    imageElements.forEach((img, index) => {
      // Make images clickable
      img.style.cursor = 'pointer'
      img.title = 'Click to view in gallery'
      
      // Add click handler
      const clickHandler = () => handleImageClick(index)
      img.addEventListener('click', clickHandler)
      
      // Store the handler for cleanup
      ;(img as HTMLImageElement & { _lightboxHandler?: () => void })._lightboxHandler = clickHandler
    })

    // Cleanup function
    return () => {
      const currentImages = document.querySelectorAll(`${postContentSelector} img`)
      currentImages.forEach(element => {
        const img = element as HTMLImageElement & { _lightboxHandler?: () => void }
        img.style.cursor = ''
        img.title = ''
        // Remove the specific handler we added
        if (img._lightboxHandler) {
          img.removeEventListener('click', img._lightboxHandler)
          delete img._lightboxHandler
        }
      })
    }
  }, [postContentSelector, handleImageClick])

  // Don't render if no images
  if (images.length === 0) {
    return null
  }

  return (
    <FsLightbox
      toggler={lightboxController.toggler}
      sources={images}
      slide={lightboxController.slide}
      exitFullscreenOnClose={true}
      openOnMount={false}
    />
  )
}