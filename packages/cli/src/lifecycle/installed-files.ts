import { readdirSync, lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
import { mutationTarget } from '#cli/lifecycle/confined.ts';
import type { FileSnapshot, LifecycleOwner } from '#cli/lifecycle/types.ts';

/** Publish an isolated native installation through the shared ownership journal. */
export function publishInstalledFiles(owner: LifecycleOwner, directory: string, kind: 'npm' | 'python'): void {
    const destination = kind === 'npm' ? '.gspot/node_modules' : '.gspot/.venv';
    const outputs: { path: string; file: FileSnapshot }[] = [];
    const collect = (sourceDirectory: string, prefix: string): void => {
        for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
            const path = `${prefix}/${entry.name}`;
            mutationTarget(path);
            const source = join(sourceDirectory, entry.name);
            const stat = lstatSync(source);
            if (stat.isDirectory()) collect(source, path);
            else if (stat.isFile())
                outputs.push({ path, file: { bytes: readFileSync(source), mode: stat.mode & 0o7777 } });
            else if (stat.isSymbolicLink())
                outputs.push({
                    path,
                    file: { bytes: Buffer.from(readlinkSync(source)), mode: stat.mode & 0o7777, isLink: true },
                });
            else throw new Error(`Unsupported installed entry: ${path}`);
        }
    };
    collect(directory, destination);
    outputs.sort((a, b) => Number(a.file.isLink === true) - Number(b.file.isLink === true));
    owner.beginInstallation(kind);
    // Link validation reads its real target, so publish regular files before executable links.
    for (const isLink of [false, true]) {
        const proposals = outputs
            .filter((output) => (output.file.isLink === true) === isLink)
            .map((output) => owner.proposeReplacement(output.path, output.file, 'dependency'));
        const conflict = proposals.find((proposal) => proposal.status === 'preserved');
        if (conflict !== undefined)
            throw new Error(`Preserved edited or unowned ${conflict.path}. Move it aside before installing.`);
        owner.applyProposals(proposals);
    }
    const wanted = new Set(outputs.map((output) => output.path));
    const pruning = owner
        .installedPaths()
        .filter((path) => path.startsWith(`${destination}/`) && !wanted.has(path))
        .map((path) => owner.proposeRestoration(path));
    owner.applyProposals(pruning);
    owner.finishInstallation(kind);
}
