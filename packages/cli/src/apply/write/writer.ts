import { GspotError } from '#cli/system/errors.ts';
import type { Writer, WritePlan } from '#cli/types/apply.ts';
import { isSameContents } from '#cli/system/files/bounded.ts';
import { WRITER_LOCK_FILE } from '#cli/config/apply/write/writer.ts';
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
Take the repository writer lock until disposal.

@param repositoryRoot the boundary for confined writes and the writer lock.
@returns the locked file writer.
*/
export function openWriter(repositoryRoot: string): Writer {
    using resources = new DisposableStack();
    const files = resources.use(openFiles(repositoryRoot));
    files.createLock(WRITER_LOCK_FILE);
    resources.move();
    return { files, [Symbol.dispose]: files[Symbol.dispose] };
}

/**
Refuse the plans when they overwrite a file that gspot did not write; otherwise write or delete each changed file.

@param writer the locked repository handle.
@param plans one write or removal for each file.
*/
export function writePlans(writer: Writer, plans: WritePlan[]): void {
    const conflicts = plans.filter((plan) => plan.status === 'preserved').map((plan) => plan.path);
    if (conflicts.length > 0)
        throw new GspotError(
            'writing',
            `gspot did not overwrite these files: ${conflicts.join(', ')}. Move them aside, then run the command again.`,
        );
    writeBatch(
        writer,
        plans.filter((plan) => plan.status === 'changed'),
    );
}
