import { join, dirname } from 'node:path';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { printWarning } from '#cli/system/terminal.ts';
import { isProcessRunning } from '#cli/system/processes.ts';
import { TEMPORARY_REMOVAL_OPTIONS } from '#cli/config/system.ts';
import type { Files, TemporaryFolder } from '#cli/types/system.ts';
import { OWNER_WRITABLE_FILE } from '#cli/config/repository/setup.ts';
import { rmSync, rmdirSync, readdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { COPIES_FOLDER, COPY_FOLDER_NAME, COPY_IGNORE_FILE, COPY_IGNORE_TEXT } from '#cli/config/engine.ts';

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
            const parent = files.readCanonicalPath(COPIES_FOLDER);
            return realpathSync.native(mkdtempSync(join(parent, `${String(process.pid)}-`)));
        } catch (error) {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
        }
    }
}

/**
Keep copies inside the repository so linked packages share its root. Reclaim only copies whose owner has exited.

@param root the repository that owns the copies.
@returns the copy folder, removed on disposal.
*/
export function createCopyFolder(root: string): TemporaryFolder {
    const files = openFiles(root);
    const path = createOwnedCopy(files);
    const parent = dirname(path);
    using cleanup = new DisposableStack();
    const copy = cleanup.use({
        path,
        [Symbol.dispose]: () => {
            deleteCopyFolder(path);
            try {
                if (readdirSync(parent).some((name) => name !== COPY_IGNORE_FILE)) return;
                rmSync(join(parent, COPY_IGNORE_FILE), { force: true });
                rmdirSync(parent);
            } catch (error) {
                if (hasErrorCode(error, 'ENOENT')) return;
                if (hasErrorCode(error, 'ENOTEMPTY')) {
                    files.write(`${COPIES_FOLDER}/${COPY_IGNORE_FILE}`, {
                        bytes: Buffer.from(COPY_IGNORE_TEXT),
                        mode: OWNER_WRITABLE_FILE,
                    });
                    return;
                }
                printWarning(`Could not remove check copy folder ${parent}: ${String(error)}`);
            }
        },
    });
    files.write(`${COPIES_FOLDER}/${COPY_IGNORE_FILE}`, {
        bytes: Buffer.from(COPY_IGNORE_TEXT),
        mode: OWNER_WRITABLE_FILE,
    });
    for (const name of files.list(COPIES_FOLDER)) {
        const pid = COPY_FOLDER_NAME.exec(name)?.groups?.['pid'];
        if (pid !== undefined && !isProcessRunning(Number(pid))) deleteCopyFolder(join(parent, name));
    }
    cleanup.move();
    return copy;
}
