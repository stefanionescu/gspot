import { cp } from 'node:fs/promises';
import { runGit } from '#cli/system/git.ts';
import { GspotError } from '#cli/system/errors.ts';
import { createRunCache } from '#cli/system/cache.ts';
import type { RunCache } from '#cli/types/system/system.ts';
import { splitSystemPath } from '#cli/system/files/reads.ts';
import type { GitFile } from '#cli/types/parsers/parsers.ts';
import { join, dirname, basename, relative } from 'node:path';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import type { ParsedTsconfig } from '#cli/types/parsers/projects.ts';
import { GIT_CHECK_IGNORE_ARGUMENTS } from '#cli/config/runs/copy.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/system/system.ts';
import { NODE_MODULES, JSCONFIG_FILE } from '#cli/config/files/names.ts';
import type { CopyPlan, DeclarationDependencies } from '#cli/types/runs/copy.ts';
import { readTsconfig, listSourceFiles } from '#cli/parsers/projects/tsconfig.ts';
import { isInside, extractExtension, convertToPosixPath } from '#cli/system/paths.ts';

import {
    statSync,
    constants,
    mkdirSync,
    existsSync,
    readdirSync,
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

function findDependencyTarget(plan: Pick<CopyPlan, 'root' | 'target'>, installed: string): string {
    const targetPath = realpathSync(installed);
    const local = relative(plan.root, targetPath);
    return isInside(local) && (local === '' || !splitSystemPath(convertToPosixPath(local)).includes(NODE_MODULES))
        ? join(plan.target, local)
        : targetPath;
}

function linkInstalledDependency(plan: Pick<CopyPlan, 'root' | 'target'>, child: string): void {
    const installed = join(plan.root, child);
    if (!existsSync(installed)) return;
    const destination = findDependencyTarget(plan, installed);
    if (!existsSync(destination)) return;
    const folder = statSync(destination).isDirectory();
    const output = join(plan.target, child);
    if (process.platform === 'win32' && !folder) copyFileSync(destination, output, constants.COPYFILE_FICLONE);
    else symlinkSync(destination, output, folder ? 'junction' : 'file');
}

function linkInstalledPackages(plan: Pick<CopyPlan, 'root' | 'target' | 'cancelSignal'>, path: string): void {
    const source = join(plan.root, path);
    mkdirSync(join(plan.target, path), { recursive: true });
    for (const dependency of readdirSync(source, { withFileTypes: true })) {
        plan.cancelSignal?.throwIfAborted();
        if (dependency.name.startsWith('.') && dependency.name !== '.bin') continue;
        const child = join(path, dependency.name);
        if (dependency.isDirectory() && (dependency.name.startsWith('@') || dependency.name === '.bin'))
            linkInstalledPackages(plan, child);
        else linkInstalledDependency(plan, child);
    }
}

/**
Selects the paths that Git ignores.

@param root the repository folder.
@param paths the prerequisites to test.
@param cancelSignal stops the Git query.
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
Links the entries of each installed node_modules into the copy, and clones the other dependency paths.

@param plan the copy and the dependencies to copy.
*/
export async function copyDependencies(
    plan: Pick<CopyPlan, 'root' | 'target' | 'dependencies' | 'cancelSignal'>,
): Promise<void> {
    const context = { ...plan, root: realpathSync(plan.root) };
    for (const path of plan.dependencies) {
        plan.cancelSignal?.throwIfAborted();
        if (basename(path) === NODE_MODULES) linkInstalledPackages(context, path);
        else {
            const target = join(plan.target, path);
            mkdirSync(dirname(target), { recursive: true });
            await cp(join(context.root, path), target, {
                recursive: true,
                verbatimSymlinks: true,
                mode: constants.COPYFILE_FICLONE,
                filter: () => {
                    plan.cancelSignal?.throwIfAborted();
                    return true;
                },
            });
        }
    }
}

function readMatchingTsconfig(
    cache: RunCache,
    path: string,
    unchangedPaths: ReadonlySet<string>,
): ParsedTsconfig | undefined {
    if (!unchangedPaths.has(path)) return undefined;
    let tsconfig: ParsedTsconfig | undefined;
    try {
        tsconfig = readTsconfig(cache.root, join(cache.root, path), cache);
    } catch (error) {
        if (!(error instanceof GspotError) || error.code !== 'configuration') throw error;
        return undefined;
    }
    const changed = tsconfig?.tsconfigFiles.some((file) => {
        const local = convertToPosixPath(relative(cache.root, file));
        return !splitSystemPath(local).includes(NODE_MODULES) && !unchangedPaths.has(local);
    });
    return changed === true ? undefined : tsconfig;
}

/**
Lists the ignored declaration files that your own tsconfig needs.

@param root the checkout with installed declaration files.
@param indexFiles the tracked files of the revision.
@param unchangedPaths dependency files whose bytes match the selected revision.
@param cancelSignal stops the Git queries.
*/
export async function readDeclarationDependencies(
    root: string,
    indexFiles: GitFile[],
    unchangedPaths: ReadonlySet<string>,
    cancelSignal?: AbortSignal,
): Promise<DeclarationDependencies> {
    const tracked = new Set(indexFiles.map(({ path }) => path));
    const cache = createRunCache(root);
    let paths = new Set<string>();
    let mismatched = false;
    for (const indexFile of indexFiles) {
        const name = basename(indexFile.path);
        if (name !== TSCONFIG_FILE && name !== JSCONFIG_FILE) continue;
        const tsconfig = readMatchingTsconfig(cache, indexFile.path, unchangedPaths);
        if (tsconfig === undefined) {
            mismatched = true;
            continue;
        }
        const declarations = listUntrackedDeclarations(root, tracked, tsconfig.fileNames);
        const ignored = await readIgnoredPaths(root, declarations, cancelSignal);
        if (ignored.length === 0) continue;
        const selected = listUntrackedDeclarations(
            root,
            tracked,
            listSourceFiles(root, dirname(indexFile.path), cache, {
                ...tsconfig,
                fileNames: tsconfig.fileNames.filter((path) => isInside(relative(root, path))),
            })
                .filter((source) => source.isDeclarationFile)
                .map((source) => source.fileName),
        );
        paths = paths.union(new Set(selected));
    }
    const selected = await readIgnoredPaths(root, [...paths], cancelSignal);
    return { copies: selected, mismatched };
}
