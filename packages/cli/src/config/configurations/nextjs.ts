// checks
export const CAUSE_MARKS = ['Please install', 'FATAL', 'Error:', '⨯'] as const;
export const CI_ENVIRONMENT = { CI: '1' } as const;
export const MARKED_LINES = 2;
export const NEXT_TYPEGEN_COMMAND = ['next', 'typegen'] as const;
export const SHOWN_LINES = 3;

// generated config
export const NEXT_PACKAGE = 'next';
export const NEXT_PAGES_FOLDERS = ['pages/', 'src/pages/'] as const;
export const NEXT_RULES = {
    '@next/next/no-html-link-for-pages': 'error',
    '@next/next/no-async-client-component': 'error',
    'gspot/require-server-only': 'error',
} as const;
export const NEXT_RULE_OPTIONS = { 'react-refresh/only-export-components': { extraHOCs: ['catchError'] } };
export const NEXT_SERVER_FILES = ['**/server/**', '**/*.server.*'] as const;
