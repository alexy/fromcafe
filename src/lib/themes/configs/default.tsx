import { ThemeConfig } from '../base/BaseLayout'
import { PostThemeConfig } from '../base/BasePost'

export const defaultBlogConfig: ThemeConfig = {
  name: 'default',
  styles: {
    container: 'min-h-screen bg-white',
    header: 'bg-gray-900 text-white py-12',
    main: 'container mx-auto px-4 py-8',
    footer: 'bg-gray-50 border-t border-gray-200 py-8',
    
    title: 'text-4xl font-bold mb-2',
    description: 'text-xl text-white',
    author: 'text-sm text-gray-200 mt-4',
    
    postContainer: 'grid gap-8',
    postItem: 'border-b pb-8',
    postTitle: 'text-2xl font-bold mb-2',
    postDate: 'text-black text-sm',
    postExcerpt: 'prose max-w-none text-black',
    postLink: 'text-black hover:text-blue-600 transition-colors',
    
    tagFilterContainer: 'flex justify-center gap-4',
    tagFilterButton: 'px-4 py-2 rounded-lg font-medium transition-colors bg-white text-gray-600 hover:bg-gray-100',
    tagFilterButtonActive: 'bg-blue-600 text-white'
  },
  layout: {
    showHeader: true,
    showFooter: true,
    showTagFilters: true
  }
}

export const defaultPostConfig: PostThemeConfig = {
  name: 'default',
  styles: {
    container: 'min-h-screen bg-white',
    header: 'bg-gray-900 text-white py-8',
    nav: 'mb-4',
    main: 'container mx-auto px-4 py-8',
    article: 'max-w-4xl mx-auto',
    
    backLink: 'text-blue-400 hover:text-blue-300 transition-colors',
    title: 'text-4xl font-bold mb-2',
    author: 'text-gray-300',
    date: 'text-sm',
    content: 'prose prose-lg max-w-none',
    
    tagContainer: 'mt-8 pt-6 border-t border-gray-200',
    tagLabel: '',
    tagItem: 'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors'
  },
  layout: {
    showNav: true,
    showAuthor: true,
    showDate: true,
    showTags: true
  },
  imageSelector: '.prose'
}