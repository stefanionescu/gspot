export const LEADING_NEWLINE = /^\r?\n/u;

export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->', gap: '\n\n' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<', gap: '\n' },
} as const;

export const BLOCK_STYLES = { 'AGENTS.md': 'markdown', '.gitattributes': 'hash' } as const;
