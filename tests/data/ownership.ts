/** The two managed block formats. */
export const BLOCK_FORMATS = [
    {
        path: 'AGENTS.md',
        style: 'markdown',
        start: '<!-- >>> gspot managed >>> -->',
        end: '<!-- <<< gspot managed <<< -->',
    },
    { path: '.gitignore', style: 'hash', start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
] as const;

/** Managed block files whose bytes do not decode as UTF-8. */
export const NON_UTF8_BLOCK_CASES = [...BLOCK_FORMATS, { path: '.gitattributes', style: 'hash' as const }] as const;
