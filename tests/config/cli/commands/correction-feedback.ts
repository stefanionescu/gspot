/** Public correction feedback uses a singular noun for one changed file. */
export const FIXER_FEEDBACK_CASES = [
    { name: 'no changes', paths: [], preview: 'no fixer changes anything', applied: 'no fixer changed anything' },
    {
        name: 'one changed file',
        paths: ['source.txt'],
        preview: '1 file would change',
        applied: 'fixers changed 1 file;',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        preview: '2 files would change',
        applied: 'fixers changed 2 files;',
    },
];
