// Path handling: forward slashes in selectors, the platform form for tools.
import { sep, join } from 'node:path';
import { realpathSync } from 'node:fs';
import { cacheHome } from '#cli/platform/environment.ts';
import { DECLARATION_EXTENSIONS } from '#cli/constants/platform.ts';

/**
 * Forward slashes on every platform, for selectors, records, and output.
 * @param path a path in the platform's form
 * @returns the path with forward slashes
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Forward slashes on every platform, for selectors, records, and output. 11 files make 18 calls; one owner keeps that behavior in one place.
export function toPosix(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/**
 * The platform's form, for arguments handed to tools.
 * @param path a posix path
 * @returns the path in the platform's form
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The platform's form, for arguments handed to tools. 2 files make 6 calls; one owner keeps that behavior in one place.
export function toPlatform(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/**
 * The last segment of a posix path.
 * @param path a posix path
 * @returns the base name
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The last segment of a posix path. 4 files make 8 calls; one owner keeps that behavior in one place.
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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The private build cache for the canonical repository path. 6 files make 14 calls; one owner keeps that behavior in one place.
export function buildFolder(root: string): string {
    const identity = new Bun.CryptoHasher('sha256').update(realpathSync(root)).digest('hex');
    return join(cacheHome(), 'gspot', identity);
}
