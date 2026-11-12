import { isAbsolute, posix, relative, resolve, sep } from 'node:path';

import {
    DECLARATION_EXTENSIONS,
    EXECUTABLE_LAYOUTS,
    GLOB_SPECIAL_CHARACTERS,
    INSTALLED_DEPENDENCY_FOLDERS,
    PATH_SEPARATORS,
    RESERVED_SEGMENTS,
    UNSAFE_PATH_MESSAGE,
} from '#cli/config/system.ts';
import { GspotError } from '#cli/system/errors.ts';

export const executableLayout = process.platform === 'win32' ? EXECUTABLE_LAYOUTS.windows : EXECUTABLE_LAYOUTS.posix;

export function convertToPosixPath(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

export function isInside(local: string): boolean {
    return !(local === '..' || isAbsolute(local) || local.startsWith('../') || local.startsWith(`..${sep}`));
}

/**
Resolve a path argument from the working folder, relative to the root. The refusal of a path outside the root names
the argument: a flag such as --paths, or Path for a positional argument.
*/
export function buildArgumentPath(root: string, cwd: string, subject: string, argument = 'Path'): string {
    const path = convertToPosixPath(relative(root, resolve(cwd, subject)));
    if (!isInside(path)) throw new GspotError('arguments', `${argument} ${subject} is outside this repository.`);
    return path;
}

/**
Extract the extension with its dot, in lower case. A declaration extension such as '.d.ts' stays whole.
*/
export function extractExtension(path: string): string {
    const base = posix.basename(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

export function stripTrailingSlashes(path: string): string {
    let end = path.length;
    while (end > 0 && path[end - 1] === '/') end -= 1;
    return path.slice(0, end);
}

export function extractParentFolder(path: string): string {
    const slash = path.lastIndexOf('/');
    return slash === -1 ? '' : path.slice(0, slash);
}

/**
Extract the base name without its extension. A declaration extension such as `.d.mts` counts as one.
*/
export function extractBaseName(path: string): string {
    const base = posix.basename(path);
    const extension = extractExtension(base);
    return base.slice(0, base.length - extension.length);
}

export function includeParentFolders(paths: readonly string[]): Set<string> {
    const covered = new Set(paths);
    for (const path of paths) {
        const segments = path.split('/');
        for (let depth = 1; depth < segments.length; depth += 1) covered.add(segments.slice(0, depth).join('/'));
    }
    return covered;
}

export function listExecutableNames(name: string): string[] {
    return executableLayout.executableSuffixes.map((suffix) => name + suffix);
}

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
*/
export function findEnclosingFolder(path: string, folders: ReadonlySet<string>): string | undefined {
    for (const folder of listEnclosingFolders(path)) if (folders.has(folder)) return folder;
    return undefined;
}

export function buildModuleSpecifier(fromFile: string, toFile: string): string {
    const folder = posix.dirname(fromFile);
    const relativePath = posix.relative(folder, toFile);
    return relativePath.startsWith('../') ? relativePath : `./${relativePath}`;
}

export function isInInstalledFolder(path: string): boolean {
    return path.split('/').some((segment) => INSTALLED_DEPENDENCY_FOLDERS.has(segment));
}

export function escapeGlob(path: string): string {
    return path.replaceAll(GLOB_SPECIAL_CHARACTERS, (match) => `\\${match}`);
}

export function isInScope(path: string, scopePath: string): boolean {
    return scopePath === '' || path === scopePath || path.startsWith(`${scopePath}/`);
}

export function splitSystemPath(path: string): string[] {
    const segments = path.split('/');
    const systemSegments = process.platform === 'win32' ? path.split(PATH_SEPARATORS) : segments;
    if (systemSegments.some((segment) => RESERVED_SEGMENTS.has(segment) || segment.includes('\0')))
        throw new GspotError(
            'filesystem',
            UNSAFE_PATH_MESSAGE.replace('{path}', () => JSON.stringify(path)),
        );
    return segments;
}

export function buildDashSafePath(path: string): string {
    return path.startsWith('-') ? `./${path}` : path;
}
