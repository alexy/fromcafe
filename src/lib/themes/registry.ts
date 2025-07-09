import { Theme, ThemeRegistry } from './types'
import { getThemeComponents } from './factory'
import VintageBlogLayout from './vintage/BlogLayout'
import VintagePostLayout from './vintage/PostLayout'

export const themes: ThemeRegistry = {
  default: {
    id: 'default',
    name: 'Classic',
    description: 'A clean, professional blog design with dark headers',
    preview: '/themes/default-preview.jpg',
    components: getThemeComponents('default'),
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
    components: getThemeComponents('minimal'),
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
    components: getThemeComponents('modern'),
    config: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        background: '#f8fafc',
        text: '#1e293b',
      },
    },
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage Newspaper',
    description: 'Old-fashioned newspaper style with two columns, ornate borders, and classic typography',
    preview: '/themes/vintage-preview.jpg',
    components: {
      BlogLayout: VintageBlogLayout,
      PostLayout: VintagePostLayout,
    },
    config: {
      colors: {
        primary: '#92400e', // amber-800
        secondary: '#d97706', // amber-600
        background: '#fffbeb', // amber-50
        text: '#92400e', // amber-800
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