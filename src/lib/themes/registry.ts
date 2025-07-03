import { Theme, ThemeRegistry } from './types'

// Import theme components
import DefaultBlogLayout from './default/BlogLayout'
import DefaultPostLayout from './default/PostLayout'
import MinimalBlogLayout from './minimal/BlogLayout'
import MinimalPostLayout from './minimal/PostLayout'
import ModernBlogLayout from './modern/BlogLayout'
import ModernPostLayout from './modern/PostLayout'

export const themes: ThemeRegistry = {
  default: {
    id: 'default',
    name: 'Classic',
    description: 'A clean, professional blog design with dark headers',
    preview: '/themes/default-preview.jpg',
    components: {
      BlogLayout: DefaultBlogLayout,
      PostLayout: DefaultPostLayout,
    },
    config: {
      colors: {
        primary: '#1f2937',
        secondary: '#3b82f6',
        background: '#ffffff',
        text: '#000000',
      },
    },
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean typography and lots of white space for distraction-free reading',
    preview: '/themes/minimal-preview.jpg',
    components: {
      BlogLayout: MinimalBlogLayout,
      PostLayout: MinimalPostLayout,
    },
    config: {
      colors: {
        primary: '#374151',
        secondary: '#6b7280',
        background: '#f9fafb',
        text: '#111827',
      },
    },
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Contemporary design with gradients, cards, and smooth animations',
    preview: '/themes/modern-preview.jpg',
    components: {
      BlogLayout: ModernBlogLayout,
      PostLayout: ModernPostLayout,
    },
    config: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#f8fafc',
        text: '#1e293b',
      },
    },
  },
}

export function getTheme(themeId: string): Theme | null {
  return themes[themeId] || null
}

export function getAvailableThemes(): Theme[] {
  return Object.values(themes)
}

export function getDefaultTheme(): Theme {
  return themes.default
}