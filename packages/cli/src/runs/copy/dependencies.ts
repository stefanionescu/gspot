import { cp } from 'node:fs/promises';
import { runGit } from '#cli/system/git.ts';
import { GspotError } from '#cli/system/errors.ts';
import { MODE_BITS } from '#cli/config/files/modes.ts';
import type { GitFile } from '#cli/types/parsers/git.ts';
import { JSCONFIG_FILE } from '#cli/config/files/names.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { splitSystemPath } from '#cli/system/files/names.ts';
import { join, dirname, basename, relative } from 'node:path';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/paths.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { readTsconfig, listSourceFiles } from '#cli/parsers/projects/tsconfig.ts';
import { GIT_CHECK_IGNORE_ARGUMENTS } from '#cli/config/runs/copy/dependencies.ts';
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
    existsSync,
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
                if (!existsSync(path)) return false;
                const linkedPath = realpathSync(path);
                if (isInside(relative(linkedPath, copy.root)))
                    throw new GspotError(
                        'copy',
                        `Installed dependency link ${relative(copy.copyRoot, destination)} points to this repository or a parent folder. Check this commit in its own clone after installing its project dependencies there.`,
                    );
                copy.links.push({ source: linkedPath, target: destination });
            }
            return true;
        },
    });
    chmodSync(target, statSync(source).mode & MODE_BITS);
}

function findCopiedPath(copies: Map<string, string>, source: string): string | undefined {
    const roots = [...copies].toSorted(([left], [right]) => right.length - left.length);
    for (const [sourceRoot, copyRoot] of roots) {
        const local = relative(sourceRoot, source);
        if (isInside(local)) return join(copyRoot, local);
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
Selects the paths that Git ignores.

@param root the repository folder.
@param paths the prerequisites to test.
@param cancelSignal stops the Git query.
@returns the ones that Git ignores.
*/
export async function readIgnoredPaths(root: string, paths: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    if (paths.length === 0) return [];
    const result = await runGit(root, GIT_CHECK_IGNORE_ARGUMENTS, {
        stdin: paths.join('\0') + '\0',
        cancelSignal,
    });
    if (result.code !== 0 && result.code !== 1) throw new GspotError('git', result.stderr);
    return result.stdout.split('\0').filter((path) => path !== '');
}

/**
Clones installed dependency trees into the copy and repairs the links inside them.

@param plan the copy and the dependencies to copy.
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
    while (context.links.length > 0) {
        context.links = context.links.toSorted((left, right) => left.source.length - right.source.length);
        await replaceLink(context, context.links.shift() as PendingLink);
        plan.cancelSignal?.throwIfAborted();
    }
}

/**
Lists the ignored declaration files that your own tsconfig needs.

@param workingTree the checkout with installed declaration files.
@param indexFiles the tracked files of the revision.
@param cancelSignal stops the Git queries.
@returns the files to clone, and the tsconfig paths to match.
*/
export async function readDeclarationDependencies(
    workingTree: string,
    indexFiles: GitFile[],
    cancelSignal?: AbortSignal,
): Promise<DeclarationDependencies> {
    const tracked = new Set(indexFiles.map(({ path }) => path));
    const reads = createReadCache(workingTree);
    let paths = new Set<string>();
    let configurationPaths = new Set<string>();
    for (const indexFile of indexFiles) {
        const name = basename(indexFile.path);
        if (name !== TSCONFIG_FILE && name !== JSCONFIG_FILE) continue;
        const tsconfig = readTsconfig(workingTree, join(workingTree, indexFile.path), reads);
        if (tsconfig === undefined) continue;
        const declarations = listUntrackedDeclarations(workingTree, tracked, tsconfig.fileNames);
        const ignored = await readIgnoredPaths(workingTree, declarations, cancelSignal);
        if (ignored.length === 0) continue;
        const selected = listUntrackedDeclarations(
            workingTree,
            tracked,
            listSourceFiles(workingTree, dirname(indexFile.path), reads, tsconfig)
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
