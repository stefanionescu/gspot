import { mkdtempSync, readdirSync, realpathSync, rmdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { COPY_FOLDER_NAME, COPY_IGNORE_TEXT } from '#cli/config/engine.ts';
import { GITIGNORE_FILE } from '#cli/config/repository/files.ts';
import { COPIES_FOLDER } from '#cli/config/repository/git.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { TEMPORARY_REMOVAL_OPTIONS } from '#cli/config/system.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { isProcessRunning } from '#cli/system/processes.ts';
import { printWarning } from '#cli/system/terminal.ts';
import type { Files, TemporaryFolder } from '#cli/types/system.ts';

const heldRoots = new Set<string>();

function writeIgnoreFile(files: Files): void {
    files.write(`${COPIES_FOLDER}/${GITIGNORE_FILE}`, {
        bytes: Buffer.from(COPY_IGNORE_TEXT),
        mode: OWNER_WRITABLE_FILE,
    });
}

function removeCopiesFolder(root: string): void {
    const parent = join(root, COPIES_FOLDER);
    try {
        if (readdirSync(parent).some((name) => name !== GITIGNORE_FILE)) return;
        rmSync(join(parent, GITIGNORE_FILE), { force: true });
        rmdirSync(parent);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return;
        if (hasErrorCode(error, 'ENOTEMPTY')) {
            writeIgnoreFile(openFiles(root));
            return;
        }
        printWarning(`Could not remove check copy folder ${parent}: ${String(error)}`);
    }
}

function deleteCopyFolder(path: string): void {
    try {
        rmSync(path, TEMPORARY_REMOVAL_OPTIONS);
    } catch (error) {
        printWarning(`Could not remove check copy ${path}: ${String(error)}`);
    }
}

function createOwnedCopy(files: Files): string {
    for (;;) {
        try {
            files.createPrivateFolder(COPIES_FOLDER);
            const created = mkdtempSync(join(files.readCanonicalPath(COPIES_FOLDER), `${String(process.pid)}-`));
            return realpathSync.native(created);
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
        }
    }
}

/**
Keep the ignore file of the copies until a run ends, because tools that walk the repository read it.
*/
export function holdCopyFolder(root: string): Disposable {
    heldRoots.add(root);
    return {
        [Symbol.dispose]: () => {
            heldRoots.delete(root);
            removeCopiesFolder(root);
        },
    };
}

/**
Keep copies inside the repository so linked packages share its root. Reclaim only copies whose owner has exited.
*/
export function createCopyFolder(root: string): TemporaryFolder {
    const files = openFiles(root);
    const path = createOwnedCopy(files);
    const parent = dirname(path);
    const copy = {
        path,
        [Symbol.dispose]: () => {
            deleteCopyFolder(path);
            if (!heldRoots.has(root)) removeCopiesFolder(root);
        },
    };
    try {
        writeIgnoreFile(files);
        for (const name of files.list(COPIES_FOLDER)) {
            const pid = COPY_FOLDER_NAME.exec(name)?.groups?.['pid'];
            if (pid !== undefined && !isProcessRunning(Number(pid))) deleteCopyFolder(join(parent, name));
        }
        return copy;
    } catch (error) {
        copy[Symbol.dispose]();
        throw error;
    }
}
