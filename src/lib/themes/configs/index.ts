import { ThemeConfig } from '../base/BaseLayout'
import { PostThemeConfig } from '../base/BasePost'
import { defaultBlogConfig, defaultPostConfig } from './default'
import { minimalBlogConfig, minimalPostConfig } from './minimal'
import { modernBlogConfig, modernPostConfig } from './modern'
import { vintageBlogConfig, vintagePostConfig } from './vintage'

export interface ThemeConfiguration {
  blog: ThemeConfig
  post: PostThemeConfig
}

export const themeConfigs: Record<string, ThemeConfiguration> = {
  default: {
    blog: defaultBlogConfig,
    post: defaultPostConfig
  },
  minimal: {
    blog: minimalBlogConfig,
    post: minimalPostConfig
  },
  modern: {
    blog: modernBlogConfig,
    post: modernPostConfig
  },
  vintage: {
    blog: vintageBlogConfig,
    post: vintagePostConfig
  }
}

export { defaultBlogConfig, defaultPostConfig }
export { minimalBlogConfig, minimalPostConfig }
export { modernBlogConfig, modernPostConfig }
export { vintageBlogConfig, vintagePostConfig }