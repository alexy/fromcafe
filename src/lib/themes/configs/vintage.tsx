import { ThemeConfig } from '../base/BaseLayout'
import { PostThemeConfig } from '../base/BasePost'

export const vintageBlogConfig: ThemeConfig = {
  name: 'vintage',
  styles: {
    container: 'min-h-screen bg-amber-50',
    header: 'bg-amber-100 border-b-4 border-amber-800 py-16',
    main: 'max-w-4xl mx-auto px-8',
    footer: 'mt-16 py-12 bg-amber-900 text-amber-100 border-t-4 border-amber-800',
    
    title: 'text-6xl font-serif font-bold text-amber-900 mb-4 text-center',
    description: 'text-xl text-amber-800 font-serif italic text-center',
    author: 'text-base text-amber-700 mt-6 font-serif text-center',
    
    postContainer: 'space-y-16 mt-16',
    postItem: 'bg-white/80 border-2 border-amber-200 rounded-lg p-8 shadow-lg',
    postTitle: 'text-3xl font-serif font-bold text-amber-900 mb-4 leading-tight',
    postDate: 'text-sm text-amber-700 font-serif italic',
    postExcerpt: 'text-amber-800 leading-relaxed font-serif text-lg mb-6',
    postLink: 'text-amber-700 hover:text-amber-900 font-serif font-semibold border-b border-amber-300 hover:border-amber-700 transition-colors',
    
    tagFilterContainer: 'flex justify-center gap-4 flex-wrap',
    tagFilterButton: 'px-6 py-3 border-2 border-amber-300 rounded font-serif font-semibold transition-all text-amber-100 hover:bg-amber-800 hover:border-amber-800',
    tagFilterButtonActive: 'bg-amber-700 border-amber-700 text-amber-100'
  },
  layout: {
    showHeader: true,
    showFooter: true,
    showTagFilters: true,
    headerDecoration: (
      <div className="absolute inset-0 opacity-10">
        <div className="h-full w-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
    )
  }
}

export const vintagePostConfig: PostThemeConfig = {
  name: 'vintage',
  styles: {
    container: 'min-h-screen bg-amber-50',
    header: 'bg-amber-100 border-b-4 border-amber-800 py-12 relative',
    nav: 'mb-6',
    main: 'max-w-4xl mx-auto px-8 py-12',
    article: 'bg-white/90 border-2 border-amber-200 rounded-lg p-12 shadow-2xl',
    
    backLink: 'inline-flex items-center gap-2 text-amber-700 hover:text-amber-900 font-serif font-semibold border-b border-amber-300 hover:border-amber-700 transition-colors',
    title: 'text-5xl font-serif font-bold text-amber-900 mb-6 leading-tight text-center',
    author: 'text-amber-700 font-serif italic text-center',
    date: 'text-sm text-amber-700 font-serif italic mb-8 text-center',
    content: 'prose prose-lg prose-amber max-w-none leading-relaxed font-serif',
    
    tagContainer: 'mt-12 pt-8 border-t-2 border-amber-200',
    tagLabel: 'text-lg font-serif font-semibold text-amber-800 mb-4',
    tagItem: 'inline-flex items-center px-4 py-2 border-2 border-amber-300 rounded font-serif font-medium text-amber-800 hover:bg-amber-100 hover:border-amber-500 transition-colors'
  },
  layout: {
    showNav: true,
    showAuthor: true,
    showDate: true,
    showTags: true,
    headerDecoration: (
      <div className="absolute inset-0 opacity-10">
        <div className="h-full w-full" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>
    ),
    contentDecoration: (
      <div className="text-center mt-8 pt-8 border-t border-amber-200">
        <div className="text-amber-600 text-4xl">❦</div>
      </div>
    )
  },
  imageSelector: '.prose'
}