export const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;

export const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;

export const REFRESH_RULE = 'react-refresh/only-export-components';

export const NEXT_ERROR_HOCS = ['catchError'] as const;

export const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;
