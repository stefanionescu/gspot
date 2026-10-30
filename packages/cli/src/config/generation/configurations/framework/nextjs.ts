export const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;

export const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;

export const NEXT_RULE_OPTIONS = { 'react-refresh/only-export-components': { extraHOCs: ['catchError'] } };

export const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;

export const REACT_FILES = ['**/*.{js,jsx,ts,tsx}'] as const;
