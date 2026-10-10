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
    {
        name: 'a truncated list of changed files',
        paths: [
            'file-0.txt',
            'file-1.txt',
            'file-2.txt',
            'file-3.txt',
            'file-4.txt',
            'file-5.txt',
            'file-6.txt',
            'file-7.txt',
            'file-8.txt',
            'file-9.txt',
        ],
        preview: '10 files would change',
        applied:
            'fixers changed 10 files; the changes are in the working tree and are not staged: `file-0.txt`, `file-1.txt`, `file-2.txt`, `file-3.txt`, `file-4.txt`, `file-5.txt`, `file-6.txt`, `file-7.txt` and 2 more',
    },
];

/** New language evidence stays authored until the owner runs apply. */
export const DETECTED_SOURCE = { 'added.py': 'pass\n' };
