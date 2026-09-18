// Path handling: forward slashes in selectors, the platform form for tools.
import { isAbsolute, relative, resolve, sep } from 'node:path';

/** Forward slashes on every platform, for selectors, records and output. */
export function toPosix(path: string): string {
    return sep === '/' ? path : path.split(sep).join('/');
}

/** The platform's form, for arguments handed to tools. */
export function toPlatform(path: string): string {
    return sep === '/' ? path : path.split('/').join(sep);
}

/** Root-relative posix path, or undefined when the path is outside the root. */
export function relativeToRoot(root: string, path: string): string | undefined {
    const rel = toPosix(relative(root, isAbsolute(path) ? path : resolve(root, path)));
    if (rel === '' || rel.startsWith('../') || rel === '..') return undefined;
    return rel;
}

/** Joins root and a posix path into an absolute platform path. */
export function absolute(root: string, path: string): string {
    return resolve(root, toPlatform(path));
}

/** The last segment of a posix path. */
export function baseName(path: string): string {
    const index = path.lastIndexOf('/');
    return index === -1 ? path : path.slice(index + 1);
}

/** The directory of a posix path, '' at the root. */
export function directoryName(path: string): string {
    const index = path.lastIndexOf('/');
    return index === -1 ? '' : path.slice(0, index);
}

/** The extension including the dot, lowercased; '.d.ts' and similar double extensions kept. */
export function extensionOf(path: string): string {
    const base = baseName(path);
    const dts = base.match(/\.d\.(ts|mts|cts)$/);
    if (dts) return `.d.${dts[1]}`;
    const index = base.lastIndexOf('.');
    return index <= 0 ? '' : base.slice(index).toLowerCase();
}

/** The stem: the base name without its extension. */
export function stemOf(path: string): string {
    const base = baseName(path);
    const ext = extensionOf(path);
    return ext === '' ? base : base.slice(0, base.length - ext.length);
}
