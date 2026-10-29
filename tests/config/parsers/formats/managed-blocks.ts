export const MALFORMED_BLOCKS = [
    { path: 'AGENTS.md', source: '<!-- >>> gspot managed >>> -->\nbody\n' },
    { path: 'AGENTS.md', source: 'body\n<!-- <<< gspot managed <<< -->\n' },
    {
        path: 'AGENTS.md',
        source: `<!-- <<< gspot managed <<< -->
body
<!-- >>> gspot managed >>> -->
`,
    },
    {
        path: 'AGENTS.md',
        source: `<!-- >>> gspot managed >>> -->
<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
`,
    },
    {
        path: 'AGENTS.md',
        source: `<!-- >>> gspot managed >>> -->
body
<!-- <<< gspot managed <<< -->
<!-- <<< gspot managed <<< -->
`,
    },
] as const;

export const BLOCK_FORMATS = [
    {
        path: 'AGENTS.md',
        start: '<!-- >>> gspot managed >>> -->',
        end: '<!-- <<< gspot managed <<< -->',
    },
    { path: '.gitignore', start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
] as const;
