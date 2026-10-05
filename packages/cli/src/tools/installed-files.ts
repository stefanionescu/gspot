import { toPosix } from '#cli/platform/paths.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { MODE_BITS } from '#cli/config/platform/modes.ts';
import type { Snapshot } from '#cli/types/platform/root.ts';
import { assertMutationTarget } from '#cli/platform/root/rules.ts';
import { join, posix, dirname, basename, relative } from 'node:path';
import type { InstalledOutput, InstallationKind } from '#cli/types/tools/install.ts';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/config/platform/locations.ts';

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

// Read a link's target without a separate filesystem check.
function linkTarget(entry: string): string | undefined {
    try {
        return readlinkSync(entry);
    } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'EINVAL') return undefined;
        throw error;
    }
}

// Preserve file links at their original location and copy their bytes inside a directory alias.
function installedFile(directory: string, realPath: string, outputPath: string, source: string): Snapshot {
    if (realPath === outputPath) {
        const entry = join(directory, realPath);
        const link = linkTarget(entry);
        if (link !== undefined)
            return { bytes: Buffer.from(link), mode: lstatSync(entry).mode & MODE_BITS, isLink: true };
    }
    const descriptor = openSync(source, constants.O_RDONLY | constants.O_NONBLOCK);
    try {
        const stat = fstatSync(descriptor);
        if (!stat.isFile()) throw new Error(`Unsupported installed entry: ${realPath}`);
        return { bytes: readFileSync(descriptor), mode: stat.mode & MODE_BITS };
    } finally {
        closeSync(descriptor);
    }
}

/**
 * Reads a complete isolated installation before the owner swaps it in. A link cycle or a link that leaves it is refused.
 * @param directory the isolated installation
 * @param kind whether the installation is the npm project or the Python environment
 * @returns every file, at its destination under .gspot/node_modules or .gspot/.venv
 */
export function readInstalledTree(directory: string, kind: InstallationKind): InstalledOutput[] {
    const destination = kind === 'npm' ? NODE_MODULES_DIRECTORY : PYTHON_ENVIRONMENT_DIRECTORY;
    const outputs: InstalledOutput[] = [];
    using parent = openRoot(dirname(directory), 'native');
    if (parent.stat(basename(directory))?.isDirectory() !== true)
        throw new Error(`Installed output is not a directory: ${directory}`);
    const root = realpathSync(directory);
    using files = openRoot(root, 'native');
    const cacheDirectory = kind === 'python' ? '__pycache__' : undefined;
    const collect = (prefix: string | undefined, output: string, ancestors: string[]): void => {
        const canonical = join(root, prefix ?? '');
        if (ancestors.includes(canonical)) throw new Error(`Installed directory link forms a cycle: ${output}`);
        for (const name of files.list(prefix)) {
            const realPath = posix.join(prefix ?? '', name);
            const outputPath = posix.join(output, name);
            const path = `${destination}/${outputPath}`;
            assertMutationTarget(path);
            const source = files.realPath(realPath);
            if (lstatSync(source).isDirectory()) {
                if (name === cacheDirectory) continue;
                collect(toPosix(relative(root, source)), outputPath, [...ancestors, canonical]);
            } else outputs.push({ path, file: installedFile(directory, realPath, outputPath, source) });
        }
    };
    collect(undefined, '', []);
    return outputs;
}
