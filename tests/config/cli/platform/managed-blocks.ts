// Authored marker cases cover every malformed delimiter layout in both supported file formats.
export const BLOCK_FORMATS = [
    {
        path: 'AGENTS.md',
        style: 'markdown',
        start: '<!-- >>> gspot managed >>> -->',
        end: '<!-- <<< gspot managed <<< -->',
    },
    { path: '.gitignore', style: 'hash', start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
] as const;

export const MALFORMED_BLOCKS = [
    { path: 'AGENTS.md', style: 'markdown' as const, source: '<!-- >>> gspot managed >>> -->\nbody\n' },
    { path: 'AGENTS.md', style: 'markdown' as const, source: 'body\n<!-- <<< gspot managed <<< -->\n' },
    {
        path: 'AGENTS.md',
        style: 'markdown' as const,
        source: '<!-- <<< gspot managed <<< -->\nbody\n<!-- >>> gspot managed >>> -->\n',
    },
    {
        path: 'AGENTS.md',
        style: 'markdown' as const,
        source: '<!-- >>> gspot managed >>> -->\n<!-- >>> gspot managed >>> -->\nbody\n<!-- <<< gspot managed <<< -->\n',
    },
    {
        path: 'AGENTS.md',
        style: 'markdown' as const,
        source: '<!-- >>> gspot managed >>> -->\nbody\n<!-- <<< gspot managed <<< -->\n<!-- <<< gspot managed <<< -->\n',
    },
    { path: '.gitignore', style: 'hash' as const, source: '# >>> gspot managed >>>\nbody\n' },
    { path: '.gitignore', style: 'hash' as const, source: 'body\n# <<< gspot managed <<<\n' },
    { path: '.gitignore', style: 'hash' as const, source: '# <<< gspot managed <<<\nbody\n# >>> gspot managed >>>\n' },
    {
        path: '.gitignore',
        style: 'hash' as const,
        source: '# >>> gspot managed >>>\n# >>> gspot managed >>>\nbody\n# <<< gspot managed <<<\n',
    },
    {
        path: '.gitignore',
        style: 'hash' as const,
        source: '# >>> gspot managed >>>\nbody\n# <<< gspot managed <<<\n# <<< gspot managed <<<\n',
    },
];
