import { basename, dirname, join, posix } from 'node:path';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import type { FileObservation } from '#cli/types/platform.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import type { LifecycleOwner } from '#cli/types/lifecycle/lifecycle.ts';
import { MODE_BITS, NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/constants/platform.ts';

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
    const files = openConfinedRoot(directory, 'native');
    const cacheDirectory = kind === 'python' ? '__pycache__' : undefined;
    const collect = (prefix: string | undefined): void => {
        for (const name of files.list(prefix)) {
            const local = posix.join(prefix ?? '', name);
            const path = `${destination}/${local}`;
            mutationTarget(path);
            const source = join(directory, local);
            const stat = lstatSync(source);
            if (stat.isDirectory() && name === cacheDirectory) continue;
            switch (true) {
                case stat.isDirectory(): {
                    collect(local);
                    break;
                }
                case stat.isFile(): {
                    outputs.push({
                        path,
                        file: { bytes: readFileSync(files.source(local)), mode: stat.mode & MODE_BITS },
                    });
                    break;
                }
                case stat.isSymbolicLink(): {
                    outputs.push({
                        path,
                        file: { bytes: Buffer.from(readlinkSync(source)), mode: stat.mode & MODE_BITS, isLink: true },
                    });
                    break;
                }
                default: {
                    throw new Error(`Unsupported installed entry: ${path}`);
                }
            }
        }
    };
    try {
        collect(undefined);
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
