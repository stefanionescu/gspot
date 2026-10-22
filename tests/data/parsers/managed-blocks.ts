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
