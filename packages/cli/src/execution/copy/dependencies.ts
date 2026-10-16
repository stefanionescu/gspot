import { cp } from 'node:fs/promises';
import { runGit } from '#cli/system/git.ts';
import { GspotError } from '#cli/system/errors.ts';
import { MODE_BITS } from '#cli/config/system/modes.ts';
import type { GitEntry } from '#cli/types/parsers/git.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { join, dirname, basename, relative } from 'node:path';
import { GIT_IGNORED_PATHS } from '#cli/config/execution/copy.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { readTsconfig, listSourceFiles } from '#cli/parsers/tsconfig.ts';
import { TSCONFIG_FILE, JSCONFIG_FILE } from '#cli/config/parsers/tsconfig.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import type {
    PendingLink,
    DependencyCopy,
    ScratchCopyPlan,
    DependencyTreeCopy,
    DeclarationDependencies,
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
} from 'node:fs';

function untrackedDeclaration(root: string, tracked: ReadonlySet<string>, path: string): string | undefined {
    const local = convertToPosixPath(relative(root, path));
    if (!isInside(local) || tracked.has(local)) return undefined;
    if (!DECLARATION_EXTENSIONS.has(extractExtension(local))) return undefined;
    return local;
}

// Copying collects links without a second filesystem walk, then repairs only those links.
async function copyTree(
    context: DependencyTreeCopy,
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
        recursive: true,
        verbatimSymlinks: true,
        mode: constants.COPYFILE_FICLONE,
        filter: (path, destination) => {
            context.cancelSignal?.throwIfAborted();
            if (lstatSync(path).isSymbolicLink()) {
                const original = realpathSync(path);
                if (isInside(relative(original, context.root)))
                    throw new GspotError(
                        'files',
                        `Installed dependency link ${relative(context.scratch, destination)} points to this repository or a parent folder. Check this commit in its own clone after installing its project dependencies there.`,
                    );
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
async function repairLink(context: DependencyTreeCopy, { source, target }: PendingLink): Promise<void> {
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

/**
 * Select paths that Git identifies as ignored.
 * @param root the repository root.
 * @param paths the candidate prerequisites.
 * @param cancelSignal the Git query cancellation.
 * @returns paths that Git identifies as ignored.
 */
export async function ignoredPaths(root: string, paths: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    if (paths.length === 0) return [];
    const result = await runGit(root, GIT_IGNORED_PATHS, { stdin: paths.join('\0') + '\0', cancelSignal });
    if (result.code !== 0 && result.code !== 1) throw new GspotError('git', result.stderr);
    return result.stdout.split('\0').filter((path) => path !== '');
}

/**
 * Clone installed dependency trees and repair contained links in the scratch copy.
 *
 * @param input the owned scratch copy and selected dependency operations.
 *
 * @returns completion after every dependency and link has settled.
 */
export async function copyDependencies(
    input: Pick<ScratchCopyPlan, 'root' | 'target' | 'dependencies' | 'cancelSignal'>,
): Promise<void> {
    const root = realpathSync(input.root);
    const context: DependencyTreeCopy = {
        root,
        scratch: input.target,
        copies: new Map([[root, input.target]]),
        links: [],
        cancelSignal: input.cancelSignal,
    };
    for (const dependency of input.dependencies) {
        input.cancelSignal?.throwIfAborted();
        const source = realpathSync(join(root, dependency.path));
        const target = join(input.target, ...splitSystemPath(dependency.path));
        mkdirSync(dirname(target), { recursive: true });
        await copyTree(context, source, target, dependency.operation);
    }
    // Clone parent targets before creating links into them, including trees found through another link.
    while (context.links.length > 0) {
        context.links = context.links.toSorted((left, right) => left.source.length - right.source.length);
        const link = context.links.shift();
        if (link !== undefined) await repairLink(context, link);
        input.cancelSignal?.throwIfAborted();
    }
}

/**
 * Carry ignored declaration prerequisites selected by the authored compiler configuration.
 *
 * @param root the installed working tree.
 * @param entries the selected tracked revision.
 * @param cancelSignal cancellation for Git queries.
 *
 * @returns declaration copies and configuration paths that must match the revision.
 */
export async function declarationDependencies(
    root: string,
    entries: GitEntry[],
    cancelSignal?: AbortSignal,
): Promise<DeclarationDependencies> {
    const tracked = new Set(entries.map(({ path }) => path));
    const reads = createReadCache(root);
    let paths = new Set<string>();
    let configurationPaths = new Set<string>();
    for (const entry of entries.filter(
        ({ path }) => basename(path) === TSCONFIG_FILE || basename(path) === JSCONFIG_FILE,
    )) {
        const config = readTsconfig(root, join(root, entry.path), reads);
        if (config === undefined) continue;
        const declarations = config.fileNames.flatMap((path) => {
            const local = untrackedDeclaration(root, tracked, path);
            return local === undefined ? [] : [local];
        });
        const ignored = await ignoredPaths(root, declarations, cancelSignal);
        if (ignored.length === 0) continue;
        const selected = listSourceFiles(root, dirname(entry.path), reads, config)
            .filter((source) => source.isDeclarationFile)
            .flatMap((source) => {
                const local = untrackedDeclaration(root, tracked, source.fileName);
                return local === undefined ? [] : [local];
            });
        paths = paths.union(new Set(selected));
        configurationPaths = configurationPaths.union(
            new Set(
                config.configurationFiles
                    .map((path) => convertToPosixPath(relative(root, path)))
                    .filter((path) => tracked.has(path)),
            ),
        );
    }
    const selected = await ignoredPaths(root, [...paths], cancelSignal);
    return { copies: selected.map((path) => ({ path, operation: 'clone' })), configurationPaths };
}
