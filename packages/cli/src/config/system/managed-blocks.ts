export const MARKERS = {
    markdown: { start: '<!-- >>> gspot managed >>> -->', end: '<!-- <<< gspot managed <<< -->', gap: '\n\n' },
    hash: { start: '# >>> gspot managed >>>', end: '# <<< gspot managed <<<', gap: '\n' },
} as const;
