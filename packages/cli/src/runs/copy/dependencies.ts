import { cp } from 'node:fs/promises';
import { runGit } from '#cli/system/git.ts';
import { GspotError } from '#cli/system/errors.ts';
import { MODE_BITS } from '#cli/config/system/modes.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { join, dirname, basename, relative } from 'node:path';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { GIT_CHECK_IGNORE_ARGUMENTS } from '#cli/config/runs/copy.ts';
import { readTsconfig, listSourceFiles } from '#cli/parsers/tsconfig.ts';
import { TSCONFIG_FILE, JSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import type {
    CopyPlan,
    PendingLink,
    DependencyCopy,
    DependencyTreeCopy,
    DeclarationDependencies,
} from '#cli/types/runs/copy.ts';
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
} from 'node:fs';

function listUntrackedDeclarations(root: string, tracked: ReadonlySet<string>, paths: string[]): string[] {
    return paths.flatMap((path) => {
        const local = convertToPosixPath(relative(root, path));
        if (!isInside(local) || tracked.has(local)) return [];
        return DECLARATION_EXTENSIONS.includes(extractExtension(local)) ? [local] : [];
    });
}

// Copying collects links without a second filesystem walk, then repairs only those links.
async function copyTree(
    copy: DependencyTreeCopy,
    source: string,
    target: string,
    operation: DependencyCopy['operation'],
): Promise<void> {
    if (operation === 'link') {
        symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
        return;
    }
    copy.copies.set(source, target);
    await cp(source, target, {
        recursive: true,
        verbatimSymlinks: true,
        mode: constants.COPYFILE_FICLONE,
        filter: (path, destination) => {
            copy.cancelSignal?.throwIfAborted();
            if (lstatSync(path).isSymbolicLink()) {
                const original = realpathSync(path);
                if (isInside(relative(original, copy.root)))
                    throw new GspotError(
                        'copy',
                        `Installed dependency link ${relative(copy.copyRoot, destination)} points to this repository or a parent folder. Check this commit in its own clone after installing its project dependencies there.`,
                    );
                copy.links.push({ source: original, target: destination });
            }
            return true;
        },
    });
    chmodSync(target, statSync(source).mode & MODE_BITS);
}

// Where a path inside a copied tree lives in the copy, or undefined when no copy holds it.
function findCopiedPath(copies: Map<string, string>, source: string): string | undefined {
    for (const [original, copied] of [...copies].toSorted(([left], [right]) => right.length - left.length)) {
        const local = relative(original, source);
        if (isInside(local)) return join(copied, local);
    }
    return undefined;
}

async function replaceLink(copy: DependencyTreeCopy, { source, target }: PendingLink): Promise<void> {
    const copied = findCopiedPath(copy.copies, source);
    unlinkSync(target);
    const folder = statSync(source).isDirectory();
    if (copied !== undefined) {
        if (statSync(copied, { throwIfNoEntry: false }) !== undefined)
            symlinkSync(relative(dirname(target), copied), target, folder ? 'dir' : 'file');
        return;
    }
    if (folder) await copyTree(copy, source, target, 'clone');
    else copyFileSync(source, target, constants.COPYFILE_FICLONE);
}

/**
 * Selects the paths that Git ignores.
 *
 * @param repositoryRoot the repository folder.
 * @param paths the prerequisites to test.
 * @param cancelSignal stops the Git query.
 * @returns the ones that Git ignores.
 */
export async function readIgnoredPaths(
    repositoryRoot: string,
    paths: string[],
    cancelSignal?: AbortSignal,
): Promise<string[]> {
    if (paths.length === 0) return [];
    const result = await runGit(repositoryRoot, GIT_CHECK_IGNORE_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
        cancelSignal,
    });
    if (result.code !== 0 && result.code !== 1) throw new GspotError('git', result.stderr);
    return result.stdout.split('\0').filter((path) => path !== '');
}

/**
 * Clones installed dependency trees into the copy and repairs the links inside them.
 *
 * @param plan the copy and the dependencies to copy.
 */
export async function copyDependencies(
    plan: Pick<CopyPlan, 'root' | 'target' | 'dependencies' | 'cancelSignal'>,
): Promise<void> {
    const root = realpathSync(plan.root);
    const context: DependencyTreeCopy = {
        root,
        copyRoot: plan.target,
        copies: new Map([[root, plan.target]]),
        links: [],
        cancelSignal: plan.cancelSignal,
    };
    for (const dependency of plan.dependencies) {
        plan.cancelSignal?.throwIfAborted();
        const source = realpathSync(join(root, dependency.path));
        const target = join(plan.target, ...splitSystemPath(dependency.path));
        mkdirSync(dirname(target), { recursive: true });
        await copyTree(context, source, target, dependency.operation);
    }
    // Clone the folders that links point into before the links, including trees found through another link.
    while (context.links.length > 0) {
        context.links = context.links.toSorted((left, right) => left.source.length - right.source.length);
        const link = context.links.shift();
        if (link !== undefined) await replaceLink(context, link);
        plan.cancelSignal?.throwIfAborted();
    }
}

/**
 * Lists the ignored declaration files that your own tsconfig needs.
 *
 * @param workingTree the checkout with installed declaration files.
 * @param entries the tracked files of the revision.
 * @param cancelSignal stops the Git queries.
 * @returns the files to clone, and the tsconfig paths to match.
 */
export async function readDeclarationDependencies(
    workingTree: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<DeclarationDependencies> {
    const tracked = new Set(entries.map(({ path }) => path));
    const reads = createReadCache(workingTree);
    let paths = new Set<string>();
    let configurationPaths = new Set<string>();
    for (const entry of entries.filter(
        ({ path }) => basename(path) === TSCONFIG_FILE || basename(path) === JSCONFIG_FILE,
    )) {
        const tsconfig = readTsconfig(workingTree, join(workingTree, entry.path), reads);
        if (tsconfig === undefined) continue;
        const declarations = listUntrackedDeclarations(workingTree, tracked, tsconfig.fileNames);
        const ignored = await readIgnoredPaths(workingTree, declarations, cancelSignal);
        if (ignored.length === 0) continue;
        const selected = listUntrackedDeclarations(
            workingTree,
            tracked,
            listSourceFiles(workingTree, dirname(entry.path), reads, tsconfig)
                .filter((source) => source.isDeclarationFile)
                .map((source) => source.fileName),
        );
        paths = paths.union(new Set(selected));
        configurationPaths = configurationPaths.union(
            new Set(
                tsconfig.tsconfigFiles
                    .map((path) => convertToPosixPath(relative(workingTree, path)))
                    .filter((path) => tracked.has(path)),
            ),
        );
    }
    const selected = await readIgnoredPaths(workingTree, [...paths], cancelSignal);
    return { copies: selected.map((path) => ({ path, operation: 'clone' })), configurationPaths };
}
