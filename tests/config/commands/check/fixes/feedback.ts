/** The fix summary for no, one, and two changed files. Each row holds the dry-run text and the fix text. */
export const FIX_SUMMARY_CASES = [
    { name: 'no changes', paths: [], preview: 'No fixer changes anything.', applied: 'No fixer changed anything.' },
    {
        name: 'one changed file',
        paths: ['source.txt'],
        preview: '1 file would change.',
        applied: 'Fixed 1 file: source.txt. The changes are not staged.',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        preview: '2 files would change.',
        applied: 'Fixed 2 files: other.txt, source.txt. The changes are not staged.',
    },
] as const;
