import type { Snapshot } from '#cli/types/platform/root.ts';
import type { GeneratedFile } from '#cli/types/generation/output.ts';

/**
 * Build a prepared lock output with its original ownership snapshot when present.
 * @param path the destination under the repository
 * @param content the successfully prepared lock contents
 * @param original the snapshot read before preparing the lock
 * @returns the read-only lock output
 */
export function buildLockFile(path: string, content: string, original: Snapshot | undefined): GeneratedFile {
    const file: GeneratedFile = { path, content, readOnly: true, kind: 'lock' };
    if (original !== undefined) file.read = original;
    return file;
}
