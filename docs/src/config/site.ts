export const SITE_URL = 'https://generativespotting.com';
/** The site description: the hero lead and the page metadata. */
export const DESCRIPTION =
    'gspot is a command-line tool that lints AI-generated code and installs rules for AI coding agents.';
export const REPOSITORY_URL = 'https://github.com/stefanionescu/gspot';
export const EDIT_URL = `${REPOSITORY_URL}/edit/main/docs/`;
export const FAVICON = '/favicon.ico';
export const APPLE_TOUCH_ICON = '/apple-touch-icon.png';
export const SOCIAL_IMAGE = '/open-graph.png';
export const SOCIAL_IMAGE_ALT = 'The gspot name and logo.';
export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const FONT_PACKAGES = ['geist', 'geist-mono'] as const;
/** The render hint waits until the article content has loaded. */
export const FIRST_PAINT_TARGET = '#article-end';
/** The Starlight ThemeProvider reads the stored theme under this key before the page paints. */
export const THEME_STORAGE_KEY = 'starlight-theme';
export const THEME_SWITCH_LABELS = { dark: 'Switch to light theme', light: 'Switch to dark theme' } as const;
