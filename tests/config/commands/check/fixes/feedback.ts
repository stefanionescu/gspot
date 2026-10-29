export const FIX_SUMMARY_CASES = [
    {
        name: 'no changes',
        paths: [],
        previewText:
            'No fixer changes anything.\n\nnote     Detected markdown. Run gspot add to enable the new configurations.\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\nDry run: nothing was written.\n',
        appliedText:
            'No fixer changed anything.\nnote     Detected markdown. Run gspot add to enable the new configurations.\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
    {
        name: 'one changed file',
        paths: ['source.txt'],
        previewText:
            '===================================================================\n--- a/source.txt\n+++ b/source.txt\n@@ -1,1 +1,1 @@\n-original\n+corrected\n\n1 file would change.\n\nnote     Detected markdown. Run gspot add to enable the new configurations.\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\nDry run: nothing was written.\n',
        appliedText:
            'Fixed 1 file: source.txt. The changes are not staged.\nnote     Detected markdown. Run gspot add to enable the new configurations.\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
    {
        name: 'two changed files',
        paths: ['source.txt', 'other.txt'],
        previewText:
            '===================================================================\n--- a/other.txt\n+++ b/other.txt\n@@ -1,1 +1,1 @@\n-original\n+corrected\n\n===================================================================\n--- a/source.txt\n+++ b/source.txt\n@@ -1,1 +1,1 @@\n-original\n+corrected\n\n2 files would change.\n\nnote     Detected markdown. Run gspot add to enable the new configurations.\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\nDry run: nothing was written.\n',
        appliedText:
            'Fixed 2 files: other.txt, source.txt. The changes are not staged.\nnote     Detected markdown. Run gspot add to enable the new configurations.\nPassed: 1 check. Skipped: 0 checks.\nTime: 0.0s. Exit code 0.\n',
    },
] as const;
