import { join, posix, dirname } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { PERMISSION_BITS } from '#cli/config/system/modes.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import type { CheckInput } from '#cli/types/checks/run/check.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { copyDependencies } from '#cli/checks/run/copy/dependencies.ts';
import { type Files, type ScratchFolder } from '#cli/types/system/files.ts';
import { SYMLINK_MODE, ENTRY_FILE_MODES } from '#cli/config/repository/revisions.ts';
import { SCRATCH_EXTRAS, DEPENDENCY_FILES, FILES_BETWEEN_PAUSES } from '#cli/config/checks/run/copy.ts';
import { statSync, chmodSync, constants, mkdirSync, symlinkSync, copyFileSync, writeFileSync } from 'node:fs';
import type { ScratchFile, DependencyCopy, ScratchCopyPlan, ScratchCopyPaths } from '#cli/types/checks/run/copy.ts';

// Source reads go through the confined reader, so they stay inside the repository.
function writeScratchFile(files: Files, scratch: string, file: ScratchFile): void {
    const target = join(scratch, ...splitSystemPath(typeof file === 'string' ? file : file.entry.path));
    mkdirSync(dirname(target), { recursive: true });
    if (typeof file === 'string') {
        const source = files.readRealPath(file);
        copyFileSync(source, target, constants.COPYFILE_FICLONE);
        chmodSync(target, statSync(source).mode & PERMISSION_BITS);
        return;
    }
    const mode = normalizeFileMode({ mode: ENTRY_FILE_MODES[file.entry.mode] });
    if (file.entry.mode === SYMLINK_MODE) symlinkSync(file.bytes, target);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
}

/**
 * Writes files and Git blobs into a scratch copy.
 * @param input what to write, and where.
 */
export async function writeScratchFiles(input: ScratchCopyPlan): Promise<void> {
    using files = openFiles(input.root);
    let written = 0;
    for await (const file of input.files) {
        if (written % FILES_BETWEEN_PAUSES === 0) await setImmediate();
        written += 1;
        input.cancelSignal?.throwIfAborted();
        const path = typeof file === 'string' ? file : file.entry.path;
        if (!input.dependencies.some((dependency) => isInScope(path, dependency.path)))
            writeScratchFile(files, input.target, file);
    }
}

/**
 * Lists the paths and dependency trees that a scratch copy of the check needs.
 * @param input the check and its files.
 * @param extra more paths to copy.
 * @returns the paths and dependencies to copy.
 */
export function checkCopyInputs(input: CheckInput, extra: string[] = []): ScratchCopyPaths {
    return {
        ...selectScratchCopyPaths(
            input.root,
            [...input.files.map((file) => file.path), ...input.dependencyFiles(), ...extra],
            input.scopes.map((scope) => scope.path),
        ),
        cancelSignal: input.cancelSignal,
    };
}

/**
 * Copies source files and dependency trees into a new scratch copy.
 * @param source the paths and dependency trees to copy.
 * @returns the scratch copy.
 */
export async function copyIntoScratch(source: ScratchCopyPaths): Promise<ScratchFolder> {
    const folder = createScratchFolder();
    try {
        const input = {
            ...source,
            target: folder.path,
            files: new Set(source.paths),
        };
        await writeScratchFiles(input);
        await copyDependencies(input);
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}

/**
 * Selects the paths and installed dependency trees for a scratch copy of the working tree.
 * @param repositoryRoot the repository folder.
 * @param paths the authored files to copy.
 * @param scopes the folders that hold installed dependencies.
 * @returns the paths and dependency trees to copy.
 */
export function selectScratchCopyPaths(repositoryRoot: string, paths: string[], scopes: string[]): ScratchCopyPaths {
    const projects = paths.flatMap((path) =>
        DEPENDENCY_FILES.has(posix.basename(path)) && posix.basename(posix.dirname(path)) !== DOT_GSPOT
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set([DOT_GSPOT, ...scopes, ...projects].map((project) => posix.join(project, NODE_MODULES))),
    ]
        .filter((path) => statSync(join(repositoryRoot, path), { throwIfNoEntry: false }) !== undefined)
        .map(
            (path): DependencyCopy => ({
                path,
                operation: path === posix.join(DOT_GSPOT, NODE_MODULES) ? 'link' : 'clone',
            }),
        );
    return {
        root: repositoryRoot,
        paths: [...new Set([...paths, ...SCRATCH_EXTRAS])].filter(
            (path) => statSync(join(repositoryRoot, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
}
