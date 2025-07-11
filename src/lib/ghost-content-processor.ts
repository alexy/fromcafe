import { marked } from 'marked'
import { ContentFormat } from '@prisma/client'

// Ghost-compatible post structure
export interface GhostPost {
  id?: string
  title: string
  slug?: string
  html?: string
  lexical?: string
  mobiledoc?: string
  markdown?: string // Ulysses sends Markdown XL content
  excerpt?: string
  status?: 'published' | 'draft' | 'scheduled'
  published_at?: string
  created_at?: string
  updated_at?: string
  tags?: Array<string | { name: string }>
  authors?: Array<string | { email: string }>
  meta_title?: string
  meta_description?: string
  feature_image?: string
}

export interface GhostPostRequest {
  posts: GhostPost[]
}

export interface ContentProcessingResult {
  content: string
  isMarkdownContent: boolean
  contentFormat: ContentFormat
}

/**
 * Create markdown renderer with consistent image handling
 */
export function createMarkdownRenderer() {
  const renderer = new marked.Renderer()
  renderer.image = function({ href, title, text }) {
    return `<img src="${href}" alt="${text || ''}"${title ? ` title="${title}"` : ''} />`
  }
  return renderer
}

/**
 * Process Ghost post content with ?source=html parameter support
 */
export async function processGhostContent(
  ghostPost: GhostPost, 
  source?: string | null
): Promise<ContentProcessingResult> {
  let content = ''
  let isMarkdownContent = false
  
  // Handle ?source=html parameter - forces treating content as HTML
  if (source === 'html') {
    console.log('👻 source=html detected, prioritizing HTML content')
    if (ghostPost.html) {
      content = ghostPost.html
    } else if (ghostPost.markdown) {
      // Convert markdown to HTML when source=html is specified
      console.log('👻 Converting markdown to HTML due to source=html')
      const renderer = createMarkdownRenderer()
      content = await marked(ghostPost.markdown, { renderer })
    } else if (ghostPost.lexical) {
      content = ghostPost.lexical
    } else if (ghostPost.mobiledoc) {
      content = ghostPost.mobiledoc
    }
  } else {
    // Default priority: Markdown > HTML > Lexical > Mobiledoc
    if (ghostPost.markdown) {
      // Ulysses sends Markdown XL - store as-is
      content = ghostPost.markdown
      isMarkdownContent = true
    } else if (ghostPost.html) {
      content = ghostPost.html
    } else if (ghostPost.lexical) {
      // Store lexical as-is for now
      content = ghostPost.lexical
    } else if (ghostPost.mobiledoc) {
      // Store mobiledoc as-is for now
      content = ghostPost.mobiledoc
    }
  }

  // Determine content format
  const contentFormat = determineContentFormat(isMarkdownContent, source)

  return {
    content,
    isMarkdownContent,
    contentFormat
  }
}

/**
 * Determine content format based on content type and source parameter
 */
export function determineContentFormat(
  isMarkdownContent: boolean, 
  source?: string | null
): ContentFormat {
  return (isMarkdownContent && source !== 'html') ? ContentFormat.MARKDOWN : ContentFormat.HTML
}