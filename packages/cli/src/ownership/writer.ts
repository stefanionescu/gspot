import { posix } from 'node:path';
import { WRITER_LOCK_FILE } from '#cli/config/ownership.ts';
import { sameEntry } from '#cli/system/safe-folder/reads.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import type { Writer, WritePlan } from '#cli/types/ownership.ts';

// Remove empty folders left by a removed generated file.
function removeEmptyFolders(writer: Writer, path: string): void {
    for (let folder = posix.dirname(path); folder !== '.'; folder = posix.dirname(folder)) {
        if (writer.files.list(folder).length > 0) return;
        writer.files.rmdir(folder);
    }
}

// Publish regular targets before links so each link finds its target.
function writeBatch(writer: Writer, plans: WritePlan[]): void {
    const ordered = plans.toSorted(
        (left, right) => Number(left.after?.isLink === true) - Number(right.after?.isLink === true),
    );
    for (const { path, before, after } of ordered) {
        if (after === undefined) {
            if (before !== undefined) {
                writer.files.remove(path, before);
                removeEmptyFolders(writer, path);
            }
        } else if (!sameEntry(before, after)) writer.files.write(path, after, before);
    }
}

/**
 * Take the repository writer lock until disposal.
 * @param root the repository root.
 * @returns the locked file writer.
 */
export function openWriter(root: string): Writer {
    using resources = new DisposableStack();
    const files = resources.use(openSafeFolder(root));
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
    const plannedFiles = new Map(
        plans.map(({ path, after, before, status }) => [
            path,
            status === 'preserved' || (status === 'unchanged' && after === undefined) ? before : after,
        ]),
    );
    for (const plan of plans) {
        if (plan.after !== undefined) writer.files.validate(plan.path, plan.after, plannedFiles);
    }
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
