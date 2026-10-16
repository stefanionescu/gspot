// Write each changed regular file under the writer lock.
import { WRITER_LOCK_FILE } from '#cli/config/ownership.ts';
import { isSameContents } from '#cli/system/files/entries.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';
import { openFiles, removeEmptyFolders } from '#cli/system/files/open.ts';

function writeBatch(writer: Writer, plans: WritePlan[]): void {
    for (const { path, before, after } of plans) {
        if (after === undefined) {
            if (before !== undefined) {
                writer.files.remove(path, before);
                removeEmptyFolders(writer.files, path);
            }
        } else if (!isSameContents(before, after)) writer.files.write(path, after, before);
    }
}

/**
 * Take the repository writer lock until disposal.
 * @param root the repository root.
 * @returns the locked file writer.
 */
export function openWriter(root: string): Writer {
    using resources = new DisposableStack();
    const files = resources.use(openFiles(root));
    files.claim(WRITER_LOCK_FILE);
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
    if (conflict !== undefined) throw notOverwrittenError([conflict.path], 'retry the command');
    writeBatch(
        writer,
        plans.filter((plan) => plan.status === 'changed'),
    );
}

/**
 * Explain which files need review before replacement.
 * @param paths the preserved paths.
 * @param command the command to retry.
 * @returns the refusal with its repair command.
 */
export function notOverwrittenError(paths: string[], command: string): Error {
    return new Error(
        `These files were not overwritten by gspot: ${paths.join(', ')}. Move them aside, then ${command}.`,
    );
}
