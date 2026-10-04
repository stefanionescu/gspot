export const BINARY_CHECKS = ['markdown/fences', 'sql/syntax'];
export const BROKEN_MARKDOWN = '# Example\n\n```tsx\nconst view = <div>\n```\n';
export const CORRECTED_MARKDOWN = '# Example\n\n```tsx\nconst view = <div />;\n```\n';
export const BROKEN_SQL = 'SELECT FROM;\n';
export const CORRECTED_SQL = 'SELECT 1;\n';

/** Retired worker outputs must never be shipped alongside the single Node worker. */
export const RETIRED_WORKER_FILES = [
    'configuration',
    'configuration.exe',
    'configuration.js',
    'eslint-worker',
    'eslint-worker.exe',
];
