// Path handling: forward slashes in selectors, the platform form for tools.
import { join, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { cacheHome } from '#cli/platform/environment.ts';

const DECLARATION_EXTENSIONS = ['.d.ts', '.d.mts', '.d.cts'];

/** Repository-relative paths shared by generation, execution, and lifecycle storage. */
export const CONFIGURATION_DIRECTORY = '.gspot/config';
export const STATE_DIRECTORY = '.gspot/state';
export const OWNERSHIP_FILE = `${STATE_DIRECTORY}/ownership.json`;
export const REPORT_DIRECTORY = '.gspot/reports';
export const CACHE_DIRECTORY = '.gspot/cache';
export const NODE_MODULES_DIRECTORY = '.gspot/node_modules';
export const PYTHON_ENVIRONMENT_DIRECTORY = '.gspot/.venv';
export const PRIVATE_PATHS = [
    `${NODE_MODULES_DIRECTORY}/`,
    `${PYTHON_ENVIRONMENT_DIRECTORY}/`,
    `${STATE_DIRECTORY}/`,
    `${CACHE_DIRECTORY}/`,
    `${REPORT_DIRECTORY}/`,
];

/**
 * Forward slashes on every platform, for selectors, records and output.
 * @param path a path in the platform's form
 * @returns the path with forward slashes
 */
export function toPosix(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * The platform's form, for arguments handed to tools.
 * @param path a posix path
 * @returns the path in the platform's form
 */
export function toPlatform(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
 * The last segment of a posix path.
 * @param path a posix path
 * @returns the base name
 */
export function baseName(path: string): string {
    const index = path.lastIndexOf('/');
    return index === -1 ? path : path.slice(index + 1);
}

/**
 * The extension including the dot, lowercased; '.d.ts' and similar double extensions kept.
 * @param path a posix path
 * @returns the extension, '' when there is none
 */
export function extensionOf(path: string): string {
    const base = baseName(path);
    const declaration = DECLARATION_EXTENSIONS.find((extension) => base.endsWith(extension));
    if (declaration !== undefined) return declaration;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

/**
 * The private build cache for the canonical repository path.
 * @param root
 */
export function buildFolder(root: string): string {
    const identity = new Bun.CryptoHasher('sha256').update(realpathSync(root)).digest('hex');
    return join(cacheHome(), 'gspot', identity);
}
