import { toPosix } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { MODE_BITS } from '#cli/config/platform/root.ts';
import type { Read } from '#cli/types/platform/platform.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import type { InstalledOutput } from '#cli/types/tools/tools.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/kits.ts';

import {
    openSync,
    closeSync,
    constants,
    fstatSync,
    lstatSync,
    readFileSync,
    readlinkSync,
    realpathSync,
} from 'node:fs';

// The link target of an entry, or nothing when the entry is not a link. One call decides, so no check precedes a use.
function linkTarget(entry: string): string | undefined {
    try {
        return readlinkSync(entry);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EINVAL') return undefined;
        throw error;
    }
}

// Preserve file links at their original location and copy their bytes inside a directory alias.
function installedFile(directory: string, local: string, target: string, source: string): Read {
    if (local === target) {
        const entry = join(directory, local);
        const link = linkTarget(entry);
        if (link !== undefined)
            return { bytes: Buffer.from(link), mode: lstatSync(entry).mode & MODE_BITS, isLink: true };
    }
    const descriptor = openSync(source, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
        const stat = fstatSync(descriptor);
        if (!stat.isFile()) throw new Error(`Unsupported installed entry: ${local}`);
        return { bytes: readFileSync(descriptor), mode: stat.mode & MODE_BITS };
    } finally {
        closeSync(descriptor);
    }
}

/**
 * Reads a complete isolated installation before the owner swaps it in. A link cycle or a link that leaves it is refused.
 * @param directory the isolated installation
 * @param kind whether the installation is the npm project or the Python environment
 * @returns every file at its path under the installation folder
 */
export function installedOutputs(directory: string, kind: 'npm' | 'python'): InstalledOutput[] {
    const destination = kind === 'npm' ? NODE_MODULES_DIRECTORY : PYTHON_ENVIRONMENT_DIRECTORY;
    const outputs: InstalledOutput[] = [];
    using parent = openRoot(dirname(directory), 'native');
    if (parent.stat(basename(directory))?.isDirectory() !== true)
        throw new Error(`Installed output is not a directory: ${directory}`);
    const root = realpathSync(directory);
    const files = openRoot(root, 'native');
    const cacheDirectory = kind === 'python' ? '__pycache__' : undefined;
    const collect = (prefix: string | undefined, output: string, ancestors: string[]): void => {
        const canonical = join(root, prefix ?? '');
        if (ancestors.includes(canonical)) throw new Error(`Installed directory link forms a cycle: ${output}`);
        for (const name of files.list(prefix)) {
            const local = posix.join(prefix ?? '', name);
            const target = posix.join(output, name);
            const path = `${destination}/${target}`;
            mutationTarget(path);
            const source = files.source(local);
            if (lstatSync(source).isDirectory()) {
                if (name === cacheDirectory) continue;
                collect(toPosix(relative(root, source)), target, [...ancestors, canonical]);
            } else outputs.push({ path, file: installedFile(directory, local, target, source) });
        }
    };
    try {
        collect(undefined, '', []);
    } finally {
        files.close();
    }
    return outputs;
}
