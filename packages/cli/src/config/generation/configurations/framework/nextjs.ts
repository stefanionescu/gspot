export const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;

export const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;

export const REFRESH_RULE = 'react-refresh/only-export-components';

/** Next.js higher-order components that react-refresh does not know: catchError from next/error, in Next.js 16.2. */
export const NEXT_EXTRA_HOCS = ['catchError'] as const;

export const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;
