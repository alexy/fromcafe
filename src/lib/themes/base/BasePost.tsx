import React from 'react'
import { PostThemeProps } from '../types'
import { getBlogUrl } from '../../utils/urls'
import PostImageGallery from '../../../components/PostImageGallery'

export interface PostThemeConfig {
  name: string
  styles: {
    // Container styles
    container: string
    header: string
    nav: string
    main: string
    article: string
    
    // Navigation
    backLink: string
    
    // Typography
    title: string
    author: string
    date: string
    content: string
    
    // Tags
    tagContainer: string
    tagLabel: string
    tagItem: string
    
    // Decorations
    decoration?: string
  }
  layout: {
    showNav: boolean
    showAuthor: boolean
    showDate: boolean
    showTags: boolean
    headerDecoration?: React.ReactNode
    contentDecoration?: React.ReactNode
  }
  imageSelector: string
}

interface BasePostProps extends PostThemeProps {
  config: PostThemeConfig
}

export default function BasePost({ blog, post, hostname, config }: BasePostProps) {
  const { styles, layout } = config

  const renderNavigation = () => {
    if (!layout.showNav) return null

    return (
      <nav className={styles.nav}>
        <a
          href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
          className={styles.backLink}
        >
          ← Back to {blog.title}
        </a>
      </nav>
    )
  }

  const renderPostMeta = () => (
    <div>
      {layout.showDate && post.publishedAt && (
        <time className={styles.date}>
          {new Date(post.publishedAt).toLocaleDateString()}
        </time>
      )}
      
      <h1 className={styles.title}>{post.title}</h1>
      
      {layout.showAuthor && (
        <div className={styles.author}>
          <p>By {blog.author || blog.slug}</p>
        </div>
      )}
    </div>
  )

  const renderContent = () => (
    <div className={styles.main}>
      <article className={styles.article}>
        <div
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: post.content }}
        />
        <PostImageGallery postContentSelector={config.imageSelector} />
        
        {layout.contentDecoration}
        
        {renderTags()}
      </article>
    </div>
  )

  const renderTags = () => {
    if (!layout.showTags || !post.tags || post.tags.length === 0) return null

    return (
      <div className={styles.tagContainer}>
        {styles.tagLabel && (
          <p className={styles.tagLabel}>Categories:</p>
        )}
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <a
              key={tag.id}
              href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=${tag.slug}`}
              className={styles.tagItem}
            >
              #{tag.name}
            </a>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {layout.headerDecoration}
      
      <header className={styles.header}>
        <div className="container mx-auto px-4">
          {renderNavigation()}
          {renderPostMeta()}
        </div>
      </header>

      {renderContent()}
    </div>
  )
}