import { join, dirname } from 'node:path';
import { openSession } from '#cli/session.ts';
import { generate } from '#cli/generation/generate.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { openWriter } from '#cli/apply/write/writer.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGspotStep } from '#tests/setup/cli/commands.ts';
import { isWindows } from '#tests/setup/system/platform.ts';
import { writeGeneratedFiles } from '#cli/apply/files/generated.ts';
import { runGit, markExecutable } from '#tests/setup/system/git.ts';
import type { OriginalFile, SampleChanges } from '#tests/types/samples.ts';

import {
    rm,
    open,
    chmod,
    lstat,
    mkdir,
    rmdir,
    unlink,
    symlink,
    readFile,
    readlink,
    writeFile,
    appendFile,
} from 'node:fs/promises';

function resetIndex(cwd: string, paths: readonly string[]): void {
    if (!isWindows || paths.length === 0) return;
    const result = runGit(cwd, ['reset', '-q', '--', ...paths]);
    if (result.code !== 0) throw new Error(`Resetting the index failed: ${result.stderr}${result.stdout}`);
}
async function readOriginalFile(path: string): Promise<OriginalFile | undefined> {
    try {
        const attributes = await lstat(path);
        if (attributes.isSymbolicLink()) return { kind: 'symlink', target: await readlink(path) };
        await using file = await open(path, 'r');
        const fileAttributes = await file.stat();
        return { kind: 'file', bytes: await file.readFile(), mode: fileAttributes.mode };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
        throw error;
    }
}
async function listAbsentParents(cwd: string, paths: readonly string[]): Promise<string[]> {
    const parents = new Set<string>();
    for (const path of paths) {
        let parent = dirname(join(cwd, path));
        while (parent !== cwd && !(await isOnDisk(parent))) {
            parents.add(parent);
            parent = dirname(parent);
        }
    }
    return [...parents].toSorted((a, b) => b.length - a.length);
}
async function restoreFiles(cwd: string, originals: Map<string, OriginalFile | undefined>): Promise<void> {
    for (const [path, original] of originals) {
        const absolute = join(cwd, path);
        await rm(absolute, { force: true });
        if (original?.kind === 'symlink') await symlink(original.target, absolute);
        else if (original?.kind === 'file') {
            await writeFile(absolute, original.bytes);
            await chmod(absolute, original.mode);
        }
    }
}
async function removeParents(parents: string[]): Promise<void> {
    for (const path of parents) {
        try {
            await rmdir(path);
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== 'ENOENT' && code !== 'ENOTEMPTY') throw error;
        }
    }
}
async function writeChanges(cwd: string, changes: SampleChanges, settings: string): Promise<void> {
    const { removed = [], executable = [] } = changes;
    for (const path of removed) await rm(join(cwd, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const absolute = join(cwd, path);
        await mkdir(dirname(absolute), { recursive: true });
        const original = await readOriginalFile(absolute);
        if (original?.kind === 'symlink') await unlink(absolute);
        await writeFile(absolute, text);
    }
    for (const path of executable) await markExecutable(cwd, path);
    await writeFile(join(cwd, 'gspot.toml'), settings);
}

/**
 * Change a sandbox, and restore its files on disposal, and in a Git repository its index and `HEAD` too. It saves file
 * bytes and modes before the first change, so a failed change still restores them.
 *
 * @param sandbox the installed sandbox to change.
 * @param changes the files, settings, removals, and executable bits to apply.
 * @returns the disposer that restores the sandbox.
 */
export async function changeSandbox(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    const cwd = sandbox.root;
    const tree = runGit(cwd, ['write-tree']).stdout.trim();
    const head = runGit(cwd, ['rev-parse', 'HEAD']);
    const untracked = new Set(
        runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).stdout.split('\0').filter(Boolean),
    );
    const settingsPath = join(cwd, 'gspot.toml');
    const original = await readFile(settingsPath, 'utf8');
    const base = changes.files['gspot.toml'] ?? original;
    const settings = [base, changes.settings].filter((text) => text !== undefined).join('\n');
    const gone = changes.removed ?? [];
    const executables = changes.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...gone, ...executables, ...Object.keys(changes.files)])];
    const originals = new Map<string, OriginalFile | undefined>();
    for (const path of paths) originals.set(path, await readOriginalFile(join(cwd, path)));
    for (const path of gone)
        if (originals.get(path) === undefined) throw new Error(`The sandbox removal target ${path} is absent.`);
    const parents = await listAbsentParents(cwd, paths);
    const restore = async (): Promise<void> => {
        await restoreFiles(cwd, originals);
        await removeParents(parents);
        resetIndex(cwd, executables);
    };
    try {
        await writeChanges(cwd, changes, settings);
    } catch (error) {
        await restore();
        throw error;
    }
    return {
        async [Symbol.asyncDispose]() {
            for (const path of runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z'])
                .stdout.split('\0')
                .filter(Boolean))
                if (!untracked.has(path)) await rm(join(cwd, path), { force: true });
            await restore();
            if (head.code !== 0) return;
            const reset = runGit(cwd, ['reset', '--soft', head.stdout.trim()]);
            if (reset.code !== 0) throw new Error(reset.stderr);
            const restored = runGit(cwd, ['read-tree', tree]);
            if (restored.code !== 0) throw new Error(restored.stderr);
        },
    };
}

/** Change the sandbox for a test that applies, and apply again after the restore so the generated files match. */
export async function changeAppliedSandbox(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    const change = await changeSandbox(sandbox, changes);
    return {
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: `await using` calls it when the scope ends.
        async [Symbol.asyncDispose]() {
            await change[Symbol.asyncDispose]();
            await runGspotStep(sandbox, ['apply']);
        },
    };
}

/** Write the sample files and run apply; disposal restores the files and applies again. */
export async function applySandboxChanges(sandbox: Sandbox, changes: SampleChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeAppliedSandbox(sandbox, changes));
    await runGspotStep(sandbox, ['apply']);
    return resources.move();
}

/** Write the generated files for an existing test repository. */
export async function applyGeneratedFiles(root: string): Promise<void> {
    using writer = openWriter(root);
    const session = await openSession(root);
    await writeGeneratedFiles(session, generate(session), writer);
}

/** Change that replace the default sources of a sample but keep .gitignore. */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: 22 calls in 11 files share it.
export function buildSandboxChanges(
    originalFiles: Readonly<Record<string, string>>,
    files: Record<string, string>,
): SampleChanges {
    return {
        check: '',
        files,
        removed: Object.keys(originalFiles).filter((path) => path !== '.gitignore' && !Object.hasOwn(files, path)),
    };
}

/**
 * Append settings to the gspot.toml of an installed sandbox, then write and format the generated files again, as a
 * repository does after it edits its settings by hand.
 *
 * @param sandbox the installed sandbox.
 * @param settings the TOML text to append.
 */
export async function appendSandboxSettings(sandbox: Sandbox, settings: string): Promise<void> {
    await appendFile(join(sandbox.root, 'gspot.toml'), settings);
    await runGspotStep(sandbox, ['apply']);
    await runGspotStep(sandbox, ['check', '--only', 'format/prettier', '--fix']);
}
