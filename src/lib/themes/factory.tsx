import React from 'react'
import BaseLayout from './base/BaseLayout'
import BasePost from './base/BasePost'
import { BlogThemeProps, PostThemeProps } from './types'
import { themeConfigs } from './configs'

/**
 * Theme factory that creates theme components using base components and configurations
 * This eliminates duplication across individual theme files
 */
export function createBlogTheme(themeId: string) {
  return function BlogTheme(props: BlogThemeProps) {
    const config = themeConfigs[themeId]?.blog
    
    if (!config) {
      throw new Error(`Theme configuration not found for: ${themeId}`)
    }
    
    return <BaseLayout {...props} config={config} />
  }
}

export function createPostTheme(themeId: string) {
  return function PostTheme(props: PostThemeProps) {
    const config = themeConfigs[themeId]?.post
    
    if (!config) {
      throw new Error(`Theme configuration not found for: ${themeId}`)
    }
    
    return <BasePost {...props} config={config} />
  }
}

/**
 * Get both blog and post theme components for a given theme ID
 */
export function getThemeComponents(themeId: string) {
  return {
    BlogLayout: createBlogTheme(themeId),
    PostLayout: createPostTheme(themeId)
  }
}