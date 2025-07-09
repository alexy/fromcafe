import { ThemeConfig, PostThemeConfig } from '../base/BaseLayout'

export const minimalBlogConfig: ThemeConfig = {
  name: 'minimal',
  styles: {
    container: 'min-h-screen bg-gray-50',
    header: 'text-center mb-16 py-16',
    main: 'max-w-3xl mx-auto px-4',
    footer: 'mt-16 pt-8 border-t border-gray-200',
    
    title: 'text-5xl font-light text-gray-900 mb-4',
    description: 'text-lg text-gray-600 font-light',
    author: 'text-sm text-gray-500 mt-6',
    
    postContainer: 'space-y-12',
    postItem: 'pb-8 border-b border-gray-200 last:border-b-0',
    postTitle: 'text-2xl font-light text-gray-900 mt-2 leading-tight',
    postDate: 'text-xs text-gray-500 uppercase tracking-wide',
    postExcerpt: 'text-gray-700 leading-relaxed mb-4',
    postLink: 'hover:text-gray-600 transition-colors text-sm text-gray-500 hover:text-gray-700 font-medium',
    
    tagFilterContainer: 'flex justify-center gap-3',
    tagFilterButton: 'px-4 py-2 text-sm font-light transition-colors text-gray-500 hover:text-gray-700',
    tagFilterButtonActive: 'text-gray-900 border-b-2 border-gray-900'
  },
  layout: {
    showHeader: true,
    showFooter: true,
    showTagFilters: true
  }
}

export const minimalPostConfig: PostThemeConfig = {
  name: 'minimal',
  styles: {
    container: 'min-h-screen bg-gray-50',
    header: 'mb-12 py-16',
    nav: 'mb-8',
    main: 'max-w-3xl mx-auto px-4',
    article: '',
    
    backLink: 'text-sm text-gray-500 hover:text-gray-700 transition-colors',
    title: 'text-4xl font-light text-gray-900 mt-3 leading-tight',
    author: 'text-sm text-gray-500 mt-6',
    date: 'text-xs text-gray-500 uppercase tracking-wide',
    content: 'prose prose-lg prose-gray max-w-none leading-relaxed',
    
    tagContainer: 'mt-12 pt-8 border-t border-gray-200',
    tagLabel: '',
    tagItem: 'inline-flex items-center px-3 py-1 text-sm font-light text-gray-600 hover:text-gray-900 transition-colors'
  },
  layout: {
    showNav: true,
    showAuthor: true,
    showDate: true,
    showTags: true
  },
  imageSelector: '.prose'
}