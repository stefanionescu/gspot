export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
} as const;

/** The comment styles of managed blocks. */
export const BLOCK_STYLES = ['markdown', 'hash'] as const;
