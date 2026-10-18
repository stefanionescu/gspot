export const SITE_URL = 'https://generativespotting.com';
/** The site description: the hero lead, the page metadata, and the llms.txt summary. */
export const DESCRIPTION =
    'gspot installs linters in your repository and runs them on every commit. It also writes rules for your AI agent.';
export const REPOSITORY_URL = 'https://github.com/stefanionescu/gspot';
export const EDIT_URL = `${REPOSITORY_URL}/edit/main/docs/`;
export const LOGO = '/logo.svg';
export const SOCIAL_IMAGE = '/open-graph.png';
export const SOCIAL_IMAGE_ALT = 'The gspot name and logo.';
export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const FONT_PACKAGES = ['geist', 'geist-mono'] as const;
/** The render hint waits until the article content has loaded. */
export const FIRST_PAINT_TARGET = '#article-end';
/** The Starlight ThemeProvider reads the stored theme under this key before the page paints. */
export const THEME_STORAGE_KEY = 'starlight-theme';
export const THEME_SWITCH_LABELS = { dark: 'Switch to light theme', light: 'Switch to dark theme' } as const;
