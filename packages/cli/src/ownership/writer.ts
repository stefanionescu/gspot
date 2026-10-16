// Write each changed regular file under the writer lock.
import { WRITER_LOCK_FILE } from '#cli/config/ownership.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { openFiles, removeEmptyFolders } from '#cli/system/files/open.ts';

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
 * @param writer the locked file writer.
 * @param plans the plans for distinct files.
 */
export function writePlans(writer: Writer, plans: WritePlan[]): void {
    const conflict = plans.find((plan) => plan.status === 'preserved');
    if (conflict !== undefined)
        throw new Error(
            `These files were not overwritten by gspot: ${conflict.path}. Move them aside, then retry the command.`,
        );
    writeBatch(
        writer,
        plans.filter((plan) => plan.status === 'changed'),
    );
}
