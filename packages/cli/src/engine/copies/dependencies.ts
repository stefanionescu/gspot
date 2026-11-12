import {
    constants,
    copyFileSync,
    type Dirent,
    existsSync,
    mkdirSync,
    readdirSync,
    realpathSync,
    statSync,
    symlinkSync,
} from 'node:fs';
import { cp } from 'node:fs/promises';
import { basename, dirname, join, posix, relative } from 'node:path';

import { JSCONFIG_FILE, TSCONFIG_FILE } from '#cli/config/parsers/projects.ts';
import { DECLARATION_EXTENSIONS, NODE_MODULES, PYTHON_ENVIRONMENT_FOLDER } from '#cli/config/system.ts';
import { findTsconfig, listSourceFiles } from '#cli/parsers/projects/tsconfig.ts';
import { readIgnoredPaths } from '#cli/repository/files/gitignore.ts';
import { createRunCache } from '#cli/system/cache.ts';
import { convertToPosixPath, extractExtension, isInScope, isInside, splitSystemPath } from '#cli/system/paths.ts';
import type { CopyPlan, DeclarationDependencies } from '#cli/types/engine/tool-runs.ts';
import type { ParsedTsconfig } from '#cli/types/parsers.ts';
import type { GitFile } from '#cli/types/repository.ts';
import type { RunCache } from '#cli/types/system.ts';

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
    const isFolder = statSync(destination).isDirectory();
    const output = join(plan.target, child);
    if (!isFolder && process.platform === 'win32') copyFileSync(destination, output, constants.COPYFILE_FICLONE);
    else symlinkSync(destination, output, isFolder ? 'junction' : 'file');
}

/**
Leave a hidden entry of node_modules out of the copy, such as a cache that a build in the copy writes into, unless
it holds an install of its own, which a tsconfig path can name.
*/
function isLinkedEntry(folder: string, entry: Dirent): boolean {
    if (entry.name === '.bin' || !entry.name.startsWith('.')) return true;
    return entry.isDirectory() && existsSync(join(folder, entry.name, NODE_MODULES));
}

function linkInstalledPackages(plan: Pick<CopyPlan, 'root' | 'target' | 'cancelSignal'>, path: string): void {
    const source = join(plan.root, path);
    mkdirSync(join(plan.target, path), { recursive: true });
    const dependencies = readdirSync(source, { withFileTypes: true }).filter((dependency) =>
        isLinkedEntry(source, dependency),
    );
    for (const dependency of dependencies) {
        plan.cancelSignal?.throwIfAborted();
        const child = join(path, dependency.name);
        const isPackageGroup =
            dependency.isDirectory() && (dependency.name === '.bin' || dependency.name.startsWith('@'));
        if (isPackageGroup) linkInstalledPackages(plan, child);
        else linkInstalledDependency(plan, child);
    }
}

function listCheckedTsconfigs(indexFiles: GitFile[], checkedPaths: string[] | undefined): GitFile[] {
    return indexFiles.filter(({ path }) => {
        const name = basename(path);
        if (name !== TSCONFIG_FILE && name !== JSCONFIG_FILE) return false;
        const folder = posix.dirname(path);
        return checkedPaths?.some((checked) => isInScope(checked, folder === '.' ? '' : folder)) !== false;
    });
}

function readMatchingTsconfig(
    cache: RunCache,
    path: string,
    unchangedPaths: ReadonlySet<string>,
): ParsedTsconfig | undefined {
    if (!unchangedPaths.has(path)) return undefined;
    const tsconfig = findTsconfig(cache.root, join(cache.root, path), cache);
    const changed = tsconfig?.tsconfigFiles.some((file) => {
        const local = convertToPosixPath(relative(cache.root, file));
        return !splitSystemPath(local).includes(NODE_MODULES) && !unchangedPaths.has(local);
    });
    return changed === true ? undefined : tsconfig;
}

/**
Link the Python environment of each scope into a copy that holds its own tools, so that the checks of the copy read it.
The checks run uv with --no-sync, so the environment does not change.
*/
export function linkEnvironments(root: string, target: string, scopes: string[]): void {
    for (const scopePath of scopes) {
        const installed = join(root, scopePath, PYTHON_ENVIRONMENT_FOLDER);
        const output = join(target, scopePath, PYTHON_ENVIRONMENT_FOLDER);
        if (existsSync(installed) && !existsSync(output)) symlinkSync(installed, output, 'junction');
    }
}

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

/**
Lists the ignored declaration files that your own tsconfig needs. With checked paths, only the tsconfig files whose
folder holds one of them count, because the type-aware tools of the run read only those programs. With no checked
paths, every tsconfig counts.

@param cancelSignal stops the Git queries.
*/
export async function readDeclarationDependencies(
    root: string,
    {
        indexFiles,
        unchangedPaths,
        paths: checkedPaths,
    }: { indexFiles: GitFile[]; unchangedPaths: ReadonlySet<string>; paths: string[] | undefined },
    cancelSignal?: AbortSignal,
): Promise<DeclarationDependencies> {
    const tracked = new Set(indexFiles.map(({ path }) => path));
    const cache = createRunCache(root);
    let paths = new Set<string>();
    let isMismatched = false;
    for (const indexFile of listCheckedTsconfigs(indexFiles, checkedPaths)) {
        const tsconfig = readMatchingTsconfig(cache, indexFile.path, unchangedPaths);
        if (tsconfig === undefined) {
            isMismatched = true;
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
    return { copies: selected, mismatched: isMismatched };
}
