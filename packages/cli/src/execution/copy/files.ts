// Temporary copies of selected files for commands that must not read the working tree.
import { cp } from 'node:fs/promises';
import { isInside } from '#cli/platform/paths.ts';
import { setImmediate } from 'node:timers/promises';
import { GspotError } from '#cli/platform/errors.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Root } from '#cli/types/platform/root.ts';
import { isInScope } from '#cli/repository/selectors.ts';
import { scratchFolder } from '#cli/platform/scratch.ts';
import { writeLink } from '#cli/platform/root/writes.ts';
import { join, posix, dirname, relative } from 'node:path';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { ScratchFolder } from '#cli/types/platform/scratch.ts';
import { fileMode, nativeSegments } from '#cli/platform/root/rules.ts';
import { MODE_BITS, PERMISSION_BITS } from '#cli/config/platform/modes.ts';
import { ENTRY_MODES, SYMLINK_MODE } from '#cli/config/repository/revisions.ts';

import {
    WRITE_BATCH,
    CLONE_OPTIONS,
    SCRATCH_EXTRAS,
    PACKAGE_MANIFESTS,
    SCRATCH_DIRECTORIES,
} from '#cli/config/execution/copy.ts';
import type {
    TreeCopy,
    ScratchCopy,
    ScratchFile,
    WorktreeCopy,
    ScratchSource,
    DependencyCopy,
} from '#cli/types/execution/copy.ts';
import {
    statSync,
    chmodSync,
    constants,
    lstatSync,
    mkdirSync,
    unlinkSync,
    symlinkSync,
    copyFileSync,
    realpathSync,
    writeFileSync,
} from 'node:fs';

// Native copying collects links without a second filesystem walk, then repairs only those links.
async function copyTree(
    context: WorktreeCopy,
    source: string,
    target: string,
    operation: DependencyCopy['operation'],
): Promise<void> {
    if (operation === 'link') {
        symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
        return;
    }
    context.copies.set(source, target);
    await cp(source, target, {
        ...CLONE_OPTIONS,
        mode: constants.COPYFILE_FICLONE,
        filter: (path, destination) => {
            context.cancelSignal?.throwIfAborted();
            if (lstatSync(path).isSymbolicLink()) {
                const original = realpathSync(path);
                if (isInside(relative(original, context.root)))
                    throw new GspotError('selection', [
                        `Installed dependency link ${relative(context.scratch, destination)} leaves the repository. Prepare isolated dependencies for this revision.`,
                    ]);
                context.links.push({ source: original, target: destination });
            }
            return true;
        },
    });
    chmodSync(target, statSync(source).mode & MODE_BITS);
}

// Where a path inside a copied tree lives in the scratch copy, or undefined when no copy holds it.
function relocated(copies: Map<string, string>, source: string): string | undefined {
    for (const [original, copied] of [...copies].toSorted(([left], [right]) => right.length - left.length)) {
        const local = relative(original, source);
        if (isInside(local)) return join(copied, local);
    }
    return undefined;
}

// Every dependency link uses the same containment and private-clone policy.
async function repairLink(context: WorktreeCopy, { source, target }: TreeCopy): Promise<void> {
    const copied = relocated(context.copies, source);
    unlinkSync(target);
    const directory = statSync(source).isDirectory();
    if (copied !== undefined) {
        if (statSync(copied, { throwIfNoEntry: false }) !== undefined)
            symlinkSync(relative(dirname(target), copied), target, directory ? 'dir' : 'file');
        return;
    }
    if (directory) await copyTree(context, source, target, 'clone');
    else copyFileSync(source, target, constants.COPYFILE_FICLONE);
}

async function copyDependencies(input: ScratchCopy): Promise<void> {
    const root = realpathSync(input.root);
    const context: WorktreeCopy = {
        root,
        scratch: input.target,
        copies: new Map([[root, input.target]]),
        links: [],
        cancelSignal: input.cancelSignal,
    };
    for (const dependency of input.dependencies) {
        input.cancelSignal?.throwIfAborted();
        const source = realpathSync(join(root, dependency.path));
        const target = join(input.target, ...nativeSegments(dependency.path));
        mkdirSync(dirname(target), { recursive: true });
        await copyTree(context, source, target, dependency.operation);
    }
    // Parent targets are cloned before links into them, including trees found by another link.
    while (context.links.length > 0) {
        context.links = context.links.toSorted((left, right) => left.source.length - right.source.length);
        const link = context.links.shift();
        if (link !== undefined) await repairLink(context, link);
        input.cancelSignal?.throwIfAborted();
    }
}

// All scratch destinations share native writes; authored source reads retain the repository boundary.
function writeScratchFile(files: Root, scratch: string, file: ScratchFile): void {
    const target = join(scratch, ...nativeSegments(typeof file === 'string' ? file : file.entry.path));
    mkdirSync(dirname(target), { recursive: true });
    if (typeof file === 'string') {
        const source = files.realPath(file);
        copyFileSync(source, target, constants.COPYFILE_FICLONE);
        chmodSync(target, statSync(source).mode & PERMISSION_BITS);
        return;
    }
    const mode = fileMode({ mode: ENTRY_MODES[file.entry.mode] });
    if (file.entry.mode === SYMLINK_MODE) writeLink(target, file.bytes, mode);
    else {
        writeFileSync(target, file.bytes, { flag: 'wx', mode });
        chmodSync(target, mode);
    }
}

/**
 * Copy files, Git blobs, and installed dependencies into an owned scratch root.
 * @param input source root, destination, and files
 */
export async function copyInto(input: ScratchCopy): Promise<void> {
    using files = openRoot(input.root, 'native');
    let written = 0;
    for await (const file of input.files) {
        if (written % WRITE_BATCH === 0) await setImmediate();
        written += 1;
        input.cancelSignal?.throwIfAborted();
        const path = typeof file === 'string' ? file : file.entry.path;
        if (!input.dependencies.some((dependency) => isInScope(path, dependency.path)))
            writeScratchFile(files, input.target, file);
    }
    await copyDependencies(input);
}

/**
 * Own a scratch folder containing only the supplied files and dependency trees.
 * @param input exact source paths and dependency operations
 * @returns the private folder and its disposal
 */
export function copyIntoScratch(input: ScratchSource): Promise<ScratchFolder>;
export function copyIntoScratch(input: CheckInput, extra?: string[]): Promise<ScratchFolder>;
export async function copyIntoScratch(input: ScratchSource | CheckInput, extra: string[] = []): Promise<ScratchFolder> {
    const source =
        'paths' in input
            ? input
            : {
                  ...projectCopyInputs(
                      input.root,
                      [...input.files.map((file) => file.path), ...input.dependencyFiles(), ...extra],
                      input.scopeEntries.map((scope) => scope.path),
                  ),
                  cancelSignal: input.cancelSignal,
              };
    const folder = scratchFolder('gspot-fix-');
    try {
        await copyInto({ ...source, target: folder.path, files: new Set(source.paths) });
        return folder;
    } catch (error) {
        folder[Symbol.dispose]();
        throw error;
    }
}

/**
 * Select scope dependencies and existing configuration extras for a working-tree project copy.
 * @param root the source repository
 * @param paths selected authored files
 * @param scopes the scope paths owning installed dependencies
 * @returns exact paths and cloned dependency trees
 */
export function projectCopyInputs(root: string, paths: string[], scopes: string[]): ScratchSource {
    const projects = paths.flatMap((path) =>
        PACKAGE_MANIFESTS.includes(posix.basename(path)) && posix.basename(posix.dirname(path)) !== DOT_GSPOT
            ? [posix.dirname(path)]
            : [],
    );
    const dependencies = [
        ...new Set(
            [...scopes, ...projects].flatMap((project) => SCRATCH_DIRECTORIES.map((name) => posix.join(project, name))),
        ),
    ]
        .filter((path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined)
        .map((path): DependencyCopy => ({ path, operation: 'clone' }));
    return {
        root,
        paths: [...new Set([...paths, ...SCRATCH_EXTRAS])].filter(
            (path) => statSync(join(root, path), { throwIfNoEntry: false }) !== undefined,
        ),
        dependencies,
    };
}
