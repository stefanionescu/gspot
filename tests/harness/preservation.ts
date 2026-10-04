import { join, dirname } from 'node:path';
import { git, markExecutable } from '#tests/harness/git.ts';
import type { CaseChanges, OriginalFile } from '#tests/types/harness/preservation.ts';

import {
    rmSync,
    chmodSync,
    lstatSync,
    mkdirSync,
    rmdirSync,
    unlinkSync,
    readdirSync,
    symlinkSync,
    readFileSync,
    readlinkSync,
    writeFileSync,
} from 'node:fs';

/**
 * Returns the index entries of the paths to the last commit, undoing what marking them executable staged.
 * @param cwd the test repository
 * @param paths the repository-relative files
 */
function resetIndex(cwd: string, paths: string[]): void {
    if (process.platform !== 'win32' || paths.length === 0) return;
    const result = git(cwd, ['reset', '-q', '--', ...paths]);
    if (result.code !== 0) throw new Error(`Resetting the index failed: ${result.stderr}${result.stdout}`);
}

function originalFile(path: string): OriginalFile | undefined {
    try {
        const attributes = lstatSync(path);
        if (attributes.isSymbolicLink()) return { kind: 'symlink', target: readlinkSync(path) };
        return { kind: 'file', bytes: readFileSync(path), mode: attributes.mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}

function isAbsent(path: string): boolean {
    try {
        lstatSync(path);
        return false;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
        throw error;
    }
}

function absentParents(cwd: string, paths: string[]): string[] {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && isAbsent(parent)) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}

function restoreFiles(cwd: string, originals: Map<string, OriginalFile | undefined>): void {
    for (const [path, original] of originals) {
        const full = join(cwd, path);
        rmSync(full, { force: true });
        if (original?.kind === 'symlink') symlinkSync(original.target, full);
        else if (original?.kind === 'file') {
            writeFileSync(full, original.bytes);
            chmodSync(full, original.mode);
        }
    }
}

function removeParents(parents: string[]): void {
    for (const path of parents) {
        try {
            rmdirSync(path);
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
}

function writeChanges(cwd: string, changes: CaseChanges, policy: string): void {
    const { removed = [], executable = [] } = changes;
    for (const path of removed) rmSync(join(cwd, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const full = join(cwd, path);
        mkdirSync(dirname(full), { recursive: true });
        if (lstatSync(full, { throwIfNoEntry: false })?.isSymbolicLink() === true) unlinkSync(full);
        writeFileSync(full, text);
    }
    for (const path of executable) markExecutable(cwd, path);
    writeFileSync(join(cwd, 'gspot.toml'), policy);
}

// Preserve bytes and permissions before the first mutation, including setup that fails partway through.
export function applyChanges(cwd: string, changes: CaseChanges): () => void {
    const policyPath = join(cwd, 'gspot.toml');
    const current = readFileSync(policyPath, 'utf8');
    const policy = changes.policy === undefined ? current : `${current}\n${changes.policy}`;
    const gone = changes.removed ?? [];
    const executables = changes.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(changes.files)])];
    const originals = new Map(paths.map((path) => [path, originalFile(join(cwd, path))]));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = absentParents(cwd, paths);
    const restore = (): void => {
        restoreFiles(cwd, originals);
        removeParents(parents);
        resetIndex(cwd, executables);
    };
    try {
        writeChanges(cwd, changes, policy);
    } catch (error) {
        restore();
        throw error;
    }
    return restore;
}

/**
 * Captures repository paths, file contents, and modes for write-preservation tests.
 * @param root the repository directory
 * @returns each path and its mode and contents
 */
export function readTree(root: string): Record<string, string> {
    return Object.fromEntries(
        readdirSync(root, { recursive: true }).map((entry) => {
            const path = String(entry);
            const full = join(root, path);
            const attributes = lstatSync(full);
            let bytes = 'directory';
            if (attributes.isSymbolicLink()) bytes = `symlink:${readlinkSync(full)}`;
            else if (attributes.isFile()) bytes = `file:${readFileSync(full).toString('base64')}`;
            return [path, `${String(attributes.mode)}:${bytes}`];
        }),
    );
}
