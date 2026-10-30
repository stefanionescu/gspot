export const FIX_SUMMARY_CASES = [
    {
        name: 'no changes',
        paths: [],
        appliedText:
            'No fixer changed anything.\nnote     Not checked: markdown (1 .md file). Run gspot add <name>, or gspot remove <name> --reason "<why>".\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
    {
        name: 'one changed file',
        paths: ['source.txt'],
        appliedText:
            'Fixed 1 file: source.txt. The changes are not staged.\nnote     Not checked: markdown (1 .md file). Run gspot add <name>, or gspot remove <name> --reason "<why>".\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        appliedText:
            'Fixed 2 files: other.txt, source.txt. The changes are not staged.\nnote     Not checked: markdown (1 .md file). Run gspot add <name>, or gspot remove <name> --reason "<why>".\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
] as const;
