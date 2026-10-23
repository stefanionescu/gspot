export const MALFORMED_BLOCKS = [
    { path: 'AGENTS.md', style: 'markdown', source: '<!-- >>> gspot managed >>> -->\nbody\n' },
    { path: 'AGENTS.md', style: 'markdown', source: 'body\n<!-- <<< gspot managed <<< -->\n' },
    {
        path: 'AGENTS.md',
        style: 'markdown',
        source: `<!-- <<< gspot managed <<< -->
body
<!-- >>> gspot managed >>> -->
`,
    },
    {
        path: 'AGENTS.md',
        style: 'markdown',
        source: `<!-- >>> gspot managed >>> -->
<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
`,
    },
    {
        path: 'AGENTS.md',
        style: 'markdown',
        source: `<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
<!-- <<< gspot managed <<< -->
`,
    },
] as const;

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
