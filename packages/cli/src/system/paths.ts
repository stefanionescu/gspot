import { sep, join, posix, isAbsolute } from 'node:path';

import {
    PYTHON_EXECUTABLE,
    EXECUTABLE_LAYOUTS,
    DECLARATION_EXTENSIONS,
    GLOB_SPECIAL_CHARACTERS,
    INSTALLED_DEPENDENCY_FOLDERS,
} from '#cli/config/system.ts';

export const executableLayout = process.platform === 'win32' ? EXECUTABLE_LAYOUTS.windows : EXECUTABLE_LAYOUTS.posix;

/**
Convert a path to forward slashes on every system, for path patterns, stored paths, and output.

@param path the path, with system separators.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers write stored and printed paths with forward slashes through this one Windows rule.
export function convertToPosixPath(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
Check whether a path relative to a folder stays inside it: not absolute, not the parent, and not under the parent.

@param local the path relative to the folder, with either separator.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers refuse a path outside its folder by this test, which accepts both separators.
export function isInside(local: string): boolean {
    return !(local === '..' || isAbsolute(local) || local.startsWith('../') || local.startsWith(`..${sep}`));
}

/**
Extract the extension with its dot, in lower case. A declaration extension such as '.d.ts' stays whole.

@param path the path, with forward slashes.
@returns '' without an extension.
*/
export function extractExtension(path: string): string {
    const base = posix.basename(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

/**
Remove trailing separators from a written scope path.

@param path the written scope folder.
*/
export function stripTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

/**
Extract the parent folder of a path, '' at the root.

@param path the slash-separated location to split at the last separator.
@returns everything before the last slash.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers take the parent folder by this rule, with an empty path at the root.
export function extractParentFolder(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/**
Extract the base name without its extension. A declaration extension such as `.d.mts` counts as one.

@param path the file path.
*/
export function extractBaseName(path: string): string {
    const base = posix.basename(path);
    const extension = extractExtension(base);
    return base.slice(0, base.length - extension.length);
}

/**
Collect each path and every folder above it.

@param paths the repository-relative files.
*/
export function includeParentFolders(paths: readonly string[]): Set<string> {
    const covered = new Set(paths);
    for (const path of paths) {
        const segments = path.split('/');
        for (let depth = 1; depth < segments.length; depth += 1) covered.add(segments.slice(0, depth).join('/'));
    }
    return covered;
}

/**
List the file names that an executable can have on this system, in the order the system tries them.

@param name the executable without a suffix.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Checks, tools, and tests list the executable names with the suffixes of this system.
export function listExecutableNames(name: string): string[] {
    return executableLayout.executableSuffixes.map((suffix) => name + suffix);
}

/**
Locate the Python interpreter inside its virtual environment.

@param folder the environment root.
@returns the executable path, with the Python launcher suffix of this system.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The interpreter path uses the virtual environment folder and launcher suffix of this system.
export function buildVenvPythonPath(folder: string): string {
    return join(
        join(folder, executableLayout.environmentFolder),
        PYTHON_EXECUTABLE + executableLayout.environmentSuffix,
    );
}

/**
List a repository folder and each parent, ending at the repository root.

@param folder the repository-relative folder, with forward slashes.
@returns the enclosing folders, nearest first, with an empty string for the root.
*/
export function listEnclosingFolders(folder: string): string[] {
    let walked = folder === '.' ? '' : folder;
    const folders = [walked];
    while (walked !== '') {
        walked = extractParentFolder(walked);
        folders.push(walked);
    }
    return folders;
}

/**
Find the nearest of the folders that holds a path, so that a lookup costs the folder depth.

@param path the repository-relative path, with forward slashes.
@param folders the folders to search.
@returns undefined when no folder holds the path.
*/
export function findEnclosingFolder(path: string, folders: ReadonlySet<string>): string | undefined {
    for (const folder of listEnclosingFolders(path)) if (folders.has(folder)) return folder;
    return undefined;
}

/**
Find the outermost folder below the root that holds a path and passes a test.

@param path the repository-relative path, with forward slashes.
@param isMatch tests one folder.
@returns undefined when no such folder holds the path.
*/
export function findOutermostFolder(path: string, isMatch: (folder: string) => boolean): string | undefined {
    const folders = listEnclosingFolders(path).filter((folder) => folder !== '');
    const matches = folders.filter((folder) => isMatch(folder));
    return matches.at(-1);
}

/**
Build the import specifier that leads from one repository file to another.

@param fromFile the importing file.
@param toFile the imported file.
*/
export function buildModuleSpecifier(fromFile: string, toFile: string): string {
    const folder = posix.dirname(fromFile);
    const relativePath = posix.relative(folder, toFile);
    return relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

/**
Test whether a path passes through an installed dependency folder.

@param path the repository-relative path.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Checks and repository reads skip installed dependency folders by this one rule.
export function isInInstalledFolder(path: string): boolean {
    return path.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment));
}

/**
Escape a literal repository path for use within a glob.

@param path the literal path.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers escape a literal path for a glob with the one set of special characters.
export function escapeGlob(path: string): string {
    return path.replaceAll(GLOB_SPECIAL_CHARACTERS, (match) => `\\${match}`);
}

/**
Test scope containment. The empty root path matches every file.

@param path the file to test.
@param scope the folder that may contain the file.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Callers in many layers test scope containment by this rule: the root scope, an empty path, holds every path.
export function isInScope(path: string, scope: string): boolean {
    return scope === '' || path === scope || path.startsWith(`${scope}/`);
}
