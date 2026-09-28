import { mutationTarget } from '#cli/platform/safe-paths.ts';
import type { FileObservation } from '#cli/types/platform.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { LifecycleOwner } from '#cli/types/lifecycle/lifecycle.ts';
import { sep, join, posix, dirname, basename, relative } from 'node:path';
import { MODE_BITS, NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/constants/platform.ts';

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
function installedFile(directory: string, local: string, target: string, source: string): FileObservation {
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

// Read the complete isolated installation before opening a publication transaction.
function installationFiles(
    directory: string,
    kind: 'npm' | 'python',
): { destination: string; outputs: { path: string; file: FileObservation }[] } {
    const destination = kind === 'npm' ? NODE_MODULES_DIRECTORY : PYTHON_ENVIRONMENT_DIRECTORY;
    const outputs: { path: string; file: FileObservation }[] = [];
    const parent = openConfinedRoot(dirname(directory), 'native');
    try {
        if (parent.stat(basename(directory))?.isDirectory() !== true)
            throw new Error(`Installed output is not a directory: ${directory}`);
    } finally {
        parent.close();
    }
    const root = realpathSync(directory);
    const files = openConfinedRoot(root, 'native');
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
                collect(relative(root, source).split(sep).join('/'), target, [...ancestors, canonical]);
            } else outputs.push({ path, file: installedFile(directory, local, target, source) });
        }
    };
    try {
        collect(undefined, '', []);
    } finally {
        files.close();
    }
    return { destination, outputs };
}

/**
 * Publish an isolated native installation through the shared ownership journal.
 * @param owner the lifecycle owner of the repository
 * @param directory the isolated installation to publish
 * @param kind whether the installation is the npm project or the Python environment
 */
export function publishInstalledFiles(owner: LifecycleOwner, directory: string, kind: 'npm' | 'python'): void {
    const { destination, outputs } = installationFiles(directory, kind);
    owner.beginInstallation(kind);
    const proposed = new Map(outputs.map(({ path, file }) => [path, file]));
    const proposals = outputs.map((output) =>
        owner.proposeReplacement(output.path, output.file, 'dependency', false, undefined, proposed),
    );
    const wanted = new Set(outputs.map((output) => output.path));
    const pruning = owner
        .installedPaths()
        .filter(
            (path) =>
                path.startsWith(`${destination}/`) &&
                !wanted.has(path) &&
                !(kind === 'python' && path.includes('/__pycache__/')),
        )
        .map((path) => owner.proposeRestoration(path));
    const publication = [...proposals, ...pruning];
    const conflict = publication.find((proposal) => proposal.status === 'preserved');
    if (conflict !== undefined)
        throw new Error(`Preserved edited or unowned ${conflict.path}. Move it aside before installing.`);
    owner.applyProposals(publication);
    owner.finishInstallation(kind);
}
