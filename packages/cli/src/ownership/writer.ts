// Write each changed regular file under the writer lock.
import { GspotError } from '#cli/system/errors.ts';
import { WRITER_LOCK_FILE } from '#cli/config/ownership.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { openFiles, removeEmptyFolders } from '#cli/system/files/open.ts';

/**
 * Explain which files need review before gspot replaces them.
 *
 * @param paths the files with content that gspot did not write.
 * @returns the refusal.
 */
function buildPreservedFilesError(paths: string[]): GspotError {
    return new GspotError(
        'writing',
        `These files were not overwritten by gspot: ${paths.join(', ')}. Move them aside, then run the command again.`,
    );
}

function writeBatch(writer: Writer, plans: WritePlan[]): void {
    for (const { path, before, after } of plans) {
        if (after === undefined) {
            if (before !== undefined) {
                writer.files.deleteFile(path, before);
                removeEmptyFolders(writer.files, path);
            }
        } else if (!isSameContents(before, after)) writer.files.write(path, after, before);
    }
}

/**
 * Take the repository writer lock until disposal.
 *
 * @param repositoryRoot the boundary for confined writes and the writer lock.
 * @returns the locked file writer.
 */
export function openWriter(repositoryRoot: string): Writer {
    using resources = new DisposableStack();
    const files = resources.use(openFiles(repositoryRoot));
    files.createLock(WRITER_LOCK_FILE);
    resources.move();
    return { files, [Symbol.dispose]: files[Symbol.dispose] };
}

/**
 * Validate all destinations and write the changed plans under one lock.
 *
 * @param writer the locked repository handle.
 * @param plans one write or removal for each file.
 */
export function writePlans(writer: Writer, plans: WritePlan[]): void {
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (conflicts.length > 0) throw buildPreservedFilesError(conflicts);
    writeBatch(
        writer,
        plans.filter((plan) => plan.status === 'changed'),
    );
}

export { buildPreservedFilesError };
