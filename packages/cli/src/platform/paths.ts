// Path handling: forward slashes in selectors, the platform form for tools.
import { join, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import { cacheHome } from '#cli/platform/environment.ts';
import { DECLARATION_EXTENSIONS } from '#cli/constants/platform.ts';

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
 * @param root the repository root
 * @returns the cache folder for this repository
 */
export function buildFolder(root: string): string {
    const identity = new Bun.CryptoHasher('sha256').update(realpathSync(root)).digest('hex');
    return join(cacheHome(), 'gspot', identity);
}
