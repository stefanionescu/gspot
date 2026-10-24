export const COPY_FAILURES = [
    { operation: 'copy', message: 'copyfile' },
    { operation: 'read', message: 'EISDIR' },
] as const;

/**
Build the diff that a fix preview prints for source.txt, from "original" to new text, both without a final newline.

@param after the text the fixer wrote.
@returns the unified diff.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 3 calls in 1 file share it.
export function buildSourceDiff(after: string): string {
    return `===================================================================\n--- a/source.txt\n+++ b/source.txt\n@@ -1,1 +1,1 @@\n-original\n\\ No newline at end of file\n+${after}\n\\ No newline at end of file\n`;
}
