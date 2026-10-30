import cliPackage from '@gspothq/cli/package.json' with { type: 'json' };

export const SITE_TITLE = 'gspot';

export const REPOSITORY_URL = 'https://github.com/stefanionescu/gspot';

export const DOCS_PATH = '/start/overview/';

export const EDIT_URL = `${REPOSITORY_URL}/edit/main/docs/`;

export const FAVICON = '/favicon.ico';

export const APPLE_TOUCH_ICON = '/apple-touch-icon.png';

export const SOCIAL_IMAGE = '/open-graph.png';

export const SOCIAL_IMAGE_ALT = 'The gspot name and logo.';

export const SOCIAL_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const FONT_PACKAGES = ['geist', 'geist-mono'] as const;

export const THEME_STORAGE_KEY = 'starlight-theme';

export const THEME_SWITCH_LABELS = { dark: 'Switch to light theme', light: 'Switch to dark theme' } as const;

export const NPM_URL = `https://www.npmjs.com/package/${cliPackage.name}`;
