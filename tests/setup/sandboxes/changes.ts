import { join, dirname } from 'node:path';
import { openWriter } from '#cli/write.ts';
import { openSession } from '#cli/session.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { generate } from '#cli/generation/generate.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { isOnDisk } from '#tests/setup/system/files.ts';
import { runGspotStep } from '#tests/setup/cli/commands.ts';
import type { SandboxChanges } from '#tests/types/samples.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import type { PreviousFile, SandboxWrite } from '#tests/types/changes.ts';
import { runGit, runGitStep, markExecutable } from '#tests/setup/system/git.ts';
import { rm, chmod, lstat, mkdir, rmdir, unlink, symlink, readFile, readlink, writeFile } from 'node:fs/promises';

async function readPreviousFile(path: string): Promise<PreviousFile | undefined> {
    try {
        const attributes = await lstat(path);
        return attributes.isSymbolicLink()
            ? { kind: 'symlink', target: await readlink(path) }
            : { kind: 'file', bytes: await readFile(path), mode: attributes.mode };
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) return undefined;
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
async function restoreFiles(cwd: string, previousFiles: Map<string, PreviousFile | undefined>): Promise<void> {
    for (const [path, saved] of previousFiles) {
        const absolute = join(cwd, path);
        await rm(absolute, { force: true });
        if (saved?.kind === 'symlink') await symlink(saved.target, absolute);
        else if (saved?.kind === 'file') {
            await writeFile(absolute, saved.bytes);
            await chmod(absolute, saved.mode);
        }
    }
}
async function removeParents(parents: string[]): Promise<void> {
    for (const path of parents) {
        try {
            await rmdir(path);
        } catch (error) {
            if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTEMPTY')) continue;
            throw error;
        }
    }
}
async function writeChanges(cwd: string, changes: SandboxWrite): Promise<void> {
    for (const path of changes.removed) await rm(join(cwd, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const absolute = join(cwd, path);
        await mkdir(dirname(absolute), { recursive: true });
        if (changes.previousFiles.get(path)?.kind === 'symlink') await unlink(absolute);
        await writeFile(absolute, text);
    }
    for (const path of changes.executable) await markExecutable(cwd, path);
    await writeFile(join(cwd, 'gspot.toml'), changes.settings);
}

/**
Change a sandbox, and restore its files on disposal, and in a Git repository its index and `HEAD` too. It saves file
bytes and modes before the first change, so a failed change still restores them.

@param sandbox the installed sandbox to change.
@param changes the files, settings, removals, and executable bits to apply.
@returns the disposer that restores the sandbox.
*/
export async function changeSandbox(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    const cwd = sandbox.root;
    const tree = runGit(cwd, ['write-tree']).stdout.trim();
    const head = runGit(cwd, ['rev-parse', 'HEAD']);
    const untracked = new Set(
        runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).stdout.split('\0').filter(Boolean),
    );
    const settingsPath = join(cwd, 'gspot.toml');
    const previous = await readFile(settingsPath, 'utf8');
    const base = changes.files['gspot.toml'] ?? previous;
    const settings = [base, changes.settings].filter((text) => text !== undefined).join('\n');
    const removed = changes.removed ?? [];
    const executable = changes.executable ?? [];
    const paths = [...new Set(['gspot.toml', ...removed, ...executable, ...Object.keys(changes.files)])];
    const previousFiles = new Map<string, PreviousFile | undefined>();
    for (const path of paths) previousFiles.set(path, await readPreviousFile(join(cwd, path)));
    const parents = await listAbsentParents(cwd, paths);
    const restore = async (): Promise<void> => {
        if (head.code === 0) {
            runGitStep(cwd, ['reset', '--soft', head.stdout.trim()]);
            runGitStep(cwd, ['read-tree', tree]);
        }
        for (const path of runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z']).stdout.split('\0'))
            if (path !== '' && !untracked.has(path)) await rm(join(cwd, path), { force: true });
        await restoreFiles(cwd, previousFiles);
        await removeParents(parents);
    };
    try {
        await writeChanges(cwd, {
            files: changes.files,
            settings,
            previousFiles,
            removed,
            executable,
        });
    } catch (error) {
        await restore();
        throw error;
    }
    return { [Symbol.asyncDispose]: restore };
}

/**
Change the sandbox for a test that applies, and apply again after the restore so the generated files match.
*/
export async function changeAppliedSandbox(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    const change = await changeSandbox(sandbox, changes);
    return {
        // eslint-disable-next-line gspot/no-trivial-functions -- reason: The rule in the plugin source does not report it.
        async [Symbol.asyncDispose]() {
            await change[Symbol.asyncDispose]();
            await runGspotStep(sandbox, ['apply']);
        },
    };
}

/**
Write the sample files and run apply; disposal restores the files and applies again.
*/
export async function applySandboxChanges(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeAppliedSandbox(sandbox, changes));
    await runGspotStep(sandbox, ['apply']);
    return resources.move();
}

/**
Write the generated files for an existing test repository.
*/
export async function applyGeneratedFiles(root: string): Promise<void> {
    using writer = openWriter(root);
    const session = await openSession(root);
    await writeGeneratedFiles(session, generate(session), writer);
}

/**
Build the changes that replace the files of a sandbox plan with these files and keep its .gitignore.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 22 calls in 11 files share it.
export function buildSandboxChanges(
    planFiles: Readonly<Record<string, string>>,
    files: Record<string, string>,
): SandboxChanges {
    return {
        files,
        removed: Object.keys(planFiles).filter((path) => path !== '.gitignore' && !Object.hasOwn(files, path)),
    };
}
