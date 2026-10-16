import { join, posix, dirname } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { isInScope } from '#cli/repository/scopes.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { DOT_GSPOT } from '#cli/config/system/locations.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { PERMISSION_BITS } from '#cli/config/system/modes.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { NODE_MODULES } from '#cli/config/repository/tracked.ts';
import { normalizeFileMode } from '#cli/system/files/entries.ts';
import { createScratchFolder } from '#cli/system/files/folders.ts';
import { copyDependencies } from '#cli/checks/run/copy/dependencies.ts';
import { type Files, type ScratchFolder } from '#cli/types/system/files.ts';
import { ENTRY_MODES, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';
import { SCRATCH_EXTRAS, DEPENDENCY_FILES, FILES_BETWEEN_PAUSES } from '#cli/config/execution/copy.ts';
import { statSync, chmodSync, constants, mkdirSync, symlinkSync, copyFileSync, writeFileSync } from 'node:fs';
import type { ScratchFile, DependencyCopy, ScratchCopyPlan, ScratchCopyPaths } from '#cli/types/execution/copy.ts';

// All scratch destinations share writes; source reads retain the repository boundary.
function writeScratchFile(files: Files, scratch: string, file: ScratchFile): void {
    const target = join(scratch, ...splitSystemPath(typeof file === 'string' ? file : file.entry.path));
    mkdirSync(dirname(target), { recursive: true });
    if (typeof file === 'string') {
        const source = files.realPath(file);
        copyFileSync(source, target, constants.COPYFILE_FICLONE);
        chmodSync(target, statSync(source).mode & PERMISSION_BITS);
        return;
    }
    const mode = normalizeFileMode({ mode: ENTRY_MODES[file.entry.mode] });
    if (file.entry.mode === SYMLINK_MODE) symlinkSync(file.bytes, target);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
}

/**
 * Copy files and Git blobs into an owned scratch root.
 *
 * @param input source root, destination, and files.
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
 * Own a scratch folder containing only the supplied files and dependency trees.
 *
 * @param input exact source paths and dependency operations.
 * @param extra the authored additional tool options.
 *
 * @returns the private folder and its disposal.
 */
export function checkCopyInputs(input: CheckInput, extra: string[] = []): ScratchCopyPaths {
    return {
        ...projectCopyInputs(
            input.root,
            [...input.files.map((file) => file.path), ...input.dependencyFiles(), ...extra],
            input.scopeEntries.map((scope) => scope.path),
        ),
        cancelSignal: input.cancelSignal,
    };
}

/**
 * Copy selected source files and dependency trees into a disposable folder.
 *
 * @param source the source paths and dependency trees.
 *
 * @returns the disposable source copy.
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
 * Select scope dependencies and existing configuration extras for a working-tree project copy.
 *
 * @param root the source repository.
 * @param paths selected authored files.
 * @param scopes the scope paths owning installed dependencies.
 *
 * @returns exact paths and dependency copy operations.
 */
export function projectCopyInputs(root: string, paths: string[], scopes: string[]): ScratchCopyPaths {
    const projects = paths.flatMap((path) =>
        new Set<string>(DEPENDENCY_FILES).has(posix.basename(path)) && posix.basename(posix.dirname(path)) !== DOT_GSPOT
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set([DOT_GSPOT, ...scopes, ...projects].map((project) => posix.join(project, NODE_MODULES))),
    ]
        .filter((path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined)
        .map(
            (path): DependencyCopy => ({
                path,
                operation: path === posix.join(DOT_GSPOT, NODE_MODULES) ? 'link' : 'clone',
            }),
        );
    return {
        root,
        paths: [...new Set([...paths, ...SCRATCH_EXTRAS])].filter(
            (path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
}
