import { ThemeConfig, PostThemeConfig } from '../base/BaseLayout'

export const modernBlogConfig: ThemeConfig = {
  name: 'modern',
  styles: {
    container: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50',
    header: 'bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10 py-16',
    main: 'max-w-4xl mx-auto px-6',
    footer: 'mt-20 py-12 bg-slate-900 text-white',
    
    title: 'text-5xl font-black text-slate-900 mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent',
    description: 'text-xl text-slate-600 font-medium',
    author: 'text-sm text-slate-500 mt-6 font-medium',
    
    postContainer: 'grid gap-12 mt-12',
    postItem: 'bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 p-8 border border-slate-100',
    postTitle: 'text-2xl font-bold text-slate-900 mb-3 leading-tight',
    postDate: 'text-xs text-blue-600 uppercase tracking-widest font-semibold',
    postExcerpt: 'text-slate-600 leading-relaxed mb-6',
    postLink: 'inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors',
    
    tagFilterContainer: 'flex justify-center gap-3 flex-wrap',
    tagFilterButton: 'px-6 py-3 rounded-full font-medium transition-all duration-200 text-slate-300 hover:text-white hover:bg-slate-700',
    tagFilterButtonActive: 'bg-blue-600 text-white shadow-lg'
  },
  layout: {
    showHeader: true,
    showFooter: true,
    showTagFilters: true
  }
}

export const modernPostConfig: PostThemeConfig = {
  name: 'modern',
  styles: {
    container: 'min-h-screen bg-gradient-to-br from-slate-50 to-blue-50',
    header: 'bg-white/90 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10 py-12',
    nav: 'mb-6',
    main: 'max-w-4xl mx-auto px-6 py-12',
    article: 'bg-white rounded-2xl shadow-sm p-10 border border-slate-100',
    
    backLink: 'inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold transition-colors',
    title: 'text-4xl font-black text-slate-900 mb-4 leading-tight',
    author: 'text-slate-600 font-medium',
    date: 'text-xs text-blue-600 uppercase tracking-widest font-semibold mb-6',
    content: 'prose prose-lg prose-slate max-w-none leading-relaxed',
    
    tagContainer: 'mt-12 pt-8 border-t border-slate-200',
    tagLabel: 'text-sm font-semibold text-slate-700 mb-3',
    tagItem: 'inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
  },
  layout: {
    showNav: true,
    showAuthor: true,
    showDate: true,
    showTags: true
  },
  imageSelector: '.prose'
}