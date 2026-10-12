export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<' },
} as const;

/** Comment syntax supported by managed instruction blocks. */
export const BLOCK_STYLES = ['markdown', 'hash'] as const;
