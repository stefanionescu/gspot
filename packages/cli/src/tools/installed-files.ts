import { basename, dirname, join } from 'node:path';
import { MODE_BITS } from '#cli/platform/file-modes.ts';
import { mutationTarget } from '#cli/platform/safe-paths.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import type { FileSnapshot } from '#cli/platform/safe-paths.ts';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import type { LifecycleOwner } from '#cli/lifecycle/ownership.ts';
import { NODE_MODULES_DIRECTORY, PYTHON_ENVIRONMENT_DIRECTORY } from '#cli/platform/paths.ts';

/**
 * Publish an isolated native installation through the shared ownership journal.
 * @param owner the lifecycle owner of the repository
 * @param directory the isolated installation to publish
 * @param kind whether the installation is the npm project or the Python environment
 */
export function publishInstalledFiles(owner: LifecycleOwner, directory: string, kind: 'npm' | 'python'): void {
    const destination = kind === 'npm' ? NODE_MODULES_DIRECTORY : PYTHON_ENVIRONMENT_DIRECTORY;
    const outputs: { path: string; file: FileSnapshot }[] = [];
    const parent = openConfinedRoot(dirname(directory), 'native');
    try {
        if (parent.stat(basename(directory))?.isDirectory() !== true)
            throw new Error(`Installed output is not a directory: ${directory}`);
    } finally {
        parent.close();
    }
    const files = openConfinedRoot(directory, 'native');
    const collect = (prefix: string): void => {
        for (const name of files.list(prefix === '' ? undefined : prefix)) {
            const local = prefix === '' ? name : `${prefix}/${name}`;
            const path = `${destination}/${local}`;
            mutationTarget(path);
            const source = join(directory, local);
            const stat = lstatSync(source);
            if (kind === 'python' && stat.isDirectory() && name === '__pycache__') continue;
            if (stat.isDirectory()) collect(local);
            else if (stat.isFile())
                outputs.push({ path, file: { bytes: readFileSync(files.source(local)), mode: stat.mode & MODE_BITS } });
            else if (stat.isSymbolicLink())
                outputs.push({
                    path,
                    file: { bytes: Buffer.from(readlinkSync(source)), mode: stat.mode & MODE_BITS, isLink: true },
                });
            else throw new Error(`Unsupported installed entry: ${path}`);
        }
    };
    try {
        collect('');
    } finally {
        files.close();
    }
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
