import { join, dirname } from 'node:path';
import { git, markExecutable } from '#tests/harness/git.ts';
import type { CaseChanges, OriginalFile } from '#tests/types/harness/preservation.ts';

import {
    rm,
    chmod,
    lstat,
    mkdir,
    rmdir,
    access,
    unlink,
    readdir,
    symlink,
    readFile,
    readlink,
    writeFile,
} from 'node:fs/promises';

/**
 * Returns the index entries of the paths to the last commit, undoing what marking them executable staged.
 * @param cwd the sandbox
 * @param paths the repository-relative files
 */
function resetIndex(cwd: string, paths: string[]): void {
    if (process.platform !== 'win32' || paths.length === 0) return;
    const result = git(cwd, ['reset', '-q', '--', ...paths]);
    if (result.code !== 0) throw new Error(`Resetting the index failed: ${result.stderr}${result.stdout}`);
}

async function originalFile(path: string): Promise<OriginalFile | undefined> {
    try {
        const attributes = await lstat(path);
        if (attributes.isSymbolicLink()) return { kind: 'symlink', target: await readlink(path) };
        return { kind: 'file', bytes: await readFile(path), mode: attributes.mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

async function isAbsent(path: string): Promise<boolean> {
    try {
        await lstat(path);
        return false;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
        throw error;
    }
}

async function absentParents(cwd: string, paths: string[]): Promise<string[]> {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && (await isAbsent(parent))) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}

async function restoreFiles(cwd: string, originals: Map<string, OriginalFile | undefined>): Promise<void> {
    for (const [path, original] of originals) {
        const full = join(cwd, path);
        await rm(full, { force: true });
        if (original?.kind === 'symlink') await symlink(original.target, full);
        else if (original?.kind === 'file') {
            await writeFile(full, original.bytes);
            await chmod(full, original.mode);
        }
    }
}

async function removeParents(parents: string[]): Promise<void> {
    for (const path of parents) {
        try {
            await rmdir(path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
}

async function writeChanges(cwd: string, changes: CaseChanges, policy: string): Promise<void> {
    const { removed = [], executable = [] } = changes;
    for (const path of removed) await rm(join(cwd, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const full = join(cwd, path);
        await mkdir(dirname(full), { recursive: true });
        const original = await originalFile(full);
        if (original?.kind === 'symlink') await unlink(full);
        await writeFile(full, text);
    }
    for (const path of executable) await markExecutable(cwd, path);
    await writeFile(join(cwd, 'gspot.toml'), policy);
}

// Preserve bytes and permissions before the first mutation, including setup that fails partway through.
export async function applyChanges(cwd: string, changes: CaseChanges): Promise<() => Promise<void>> {
    const policyPath = join(cwd, 'gspot.toml');
    const current = await readFile(policyPath, 'utf8');
    const policy = changes.policy === undefined ? current : `${current}\n${changes.policy}`;
    const gone = changes.removed ?? [];
    const executables = changes.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(changes.files)])];
    const originals = new Map<string, OriginalFile | undefined>();
    for (const path of paths) originals.set(path, await originalFile(join(cwd, path)));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = await absentParents(cwd, paths);
    const restore = async (): Promise<void> => {
        await restoreFiles(cwd, originals);
        await removeParents(parents);
        resetIndex(cwd, executables);
    };
    try {
        await writeChanges(cwd, changes, policy);
    } catch (error) {
        await restore();
        throw error;
    }
    return restore;
}

/**
 * Captures repository paths, file contents, and modes for write-preservation tests.
 * @param root the repository directory
 * @returns each path and its mode and contents
 */
export async function readTree(root: string): Promise<Record<string, string>> {
    const entries = await readdir(root, { recursive: true });
    return Object.fromEntries(
        await Promise.all(
            entries.map(async (entry) => {
                const path = entry;
                const full = join(root, path);
                const attributes = await lstat(full);
                let bytes = 'directory';
                if (attributes.isSymbolicLink()) bytes = `symlink:${await readlink(full)}`;
                else if (attributes.isFile()) {
                    const content = await readFile(full);
                    bytes = `file:${content.toString('base64')}`;
                }
                return [path, `${String(attributes.mode)}:${bytes}`] as const;
            }),
        ),
    );
}

/**
 * Checks whether a filesystem path exists, following symbolic links.
 * @param path the file or directory
 * @returns false when native access fails, matching the filesystem existence contract
 */
export function pathExists(path: string): Promise<boolean> {
    return access(path).then(
        () => true,
        () => false,
    );
}
