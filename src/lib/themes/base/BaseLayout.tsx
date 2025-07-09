import React from 'react'
import { BlogThemeProps } from '../types'
import { getPostUrl, getBlogUrl } from '../../utils/urls'

export interface ThemeConfig {
  name: string
  styles: {
    // Container styles
    container: string
    header: string
    main: string
    footer: string
    
    // Typography
    title: string
    description: string
    author: string
    
    // Post list
    postContainer: string
    postItem: string
    postTitle: string
    postDate: string
    postExcerpt: string
    postLink: string
    
    // Tag filters
    tagFilterContainer: string
    tagFilterButton: string
    tagFilterButtonActive: string
  }
  layout: {
    showHeader: boolean
    showFooter: boolean
    showTagFilters: boolean
    headerDecoration?: React.ReactNode
    footerDecoration?: React.ReactNode
  }
}

interface BaseLayoutProps extends BlogThemeProps {
  config: ThemeConfig
}

export default function BaseLayout({ blog, posts, hostname, currentTag, config }: BaseLayoutProps) {
  const { styles, layout } = config

  const renderHeader = () => {
    if (!layout.showHeader) return null

    return (
      <header className={styles.header}>
        {layout.headerDecoration}
        <div className="container mx-auto px-4">
          <h1 className={styles.title}>{blog.title}</h1>
          {blog.description && (
            <p className={styles.description}>{blog.description}</p>
          )}
          <p className={styles.author}>
            {blog.title} by {blog.author || blog.slug}
          </p>
        </div>
      </header>
    )
  }

  const renderEmptyState = () => (
    <div className="text-center py-16">
      <div className={styles.postContainer}>
        <p className={styles.postExcerpt}>No posts published yet.</p>
      </div>
    </div>
  )

  const renderPosts = () => (
    <div className={styles.postContainer}>
      {posts.map((post) => (
        <article key={post.id} className={styles.postItem}>
          <header>
            <time className={styles.postDate}>
              {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}
            </time>
            <h2 className={styles.postTitle}>
              <a
                href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
                className={styles.postLink}
              >
                {post.title}
              </a>
            </h2>
          </header>
          {post.excerpt && (
            <div className={styles.postExcerpt}>
              <p>{post.excerpt}</p>
            </div>
          )}
          <footer>
            <a
              href={getPostUrl(blog.userSlug, blog.slug, post.slug, hostname)}
              className={styles.postLink}
            >
              Continue reading →
            </a>
          </footer>
        </article>
      ))}
    </div>
  )

  const renderTagFilters = () => {
    if (!layout.showTagFilters) return null

    return (
      <footer className={styles.footer}>
        {layout.footerDecoration}
        <div className="container mx-auto px-4">
          <div className="text-center">
            <p className="mb-4">Filter by tag:</p>
            <div className={styles.tagFilterContainer}>
              <a
                href={getBlogUrl(blog.userSlug, blog.slug, hostname)}
                className={`${styles.tagFilterButton} ${
                  !currentTag || currentTag === 'all' 
                    ? styles.tagFilterButtonActive 
                    : ''
                }`}
              >
                all
              </a>
              <a
                href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=evernote`}
                className={`${styles.tagFilterButton} ${
                  currentTag === 'evernote' 
                    ? styles.tagFilterButtonActive 
                    : ''
                }`}
              >
                evernote
              </a>
              <a
                href={`${getBlogUrl(blog.userSlug, blog.slug, hostname)}?tag=ghost`}
                className={`${styles.tagFilterButton} ${
                  currentTag === 'ghost' 
                    ? styles.tagFilterButtonActive 
                    : ''
                }`}
              >
                ghost
              </a>
            </div>
          </div>
        </div>
      </footer>
    )
  }

  return (
    <div className={styles.container}>
      {renderHeader()}
      
      <main className={styles.main}>
        <div className="container mx-auto px-4 py-8">
          {posts.length === 0 ? renderEmptyState() : renderPosts()}
        </div>
      </main>

      {renderTagFilters()}
    </div>
  )
}