import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import { openSession } from '#cli/planning/session.ts';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { runGspotStep } from '#tests/setup/cli/commands.ts';
import type { SandboxWrite } from '#tests/types/changes.ts';
import type { SandboxChanges } from '#tests/types/samples.ts';
import { writeGeneratedFiles } from '#cli/generation/write.ts';
import { SETTINGS_FILE } from '#cli/config/settings/settings.ts';
import { buildGeneratedFiles } from '#cli/generation/generate.ts';
import { runCommandBlocking } from '#tests/setup/system/processes.ts';
import { runGitStep, markExecutable } from '#tests/setup/system/git.ts';
import { rm, mkdir, lstat, rmdir, unlink, readFile, writeFile } from 'node:fs/promises';

async function deleteLeftover(root: string, path: string): Promise<void> {
    await rm(join(root, path), { force: true });
    for (let folder = dirname(path); folder !== '.'; folder = dirname(folder)) {
        const removed = await rmdir(join(root, folder)).then(
            () => true,
            (error: unknown) => {
                if (!hasErrorCode(error, 'ENOTEMPTY') && !hasErrorCode(error, 'ENOENT')) throw error;
                return false;
            },
        );
        if (!removed) return;
    }
}

async function writeChanges(root: string, changes: SandboxWrite): Promise<void> {
    for (const path of changes.removed) await rm(join(root, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const absolute = join(root, path);
        await mkdir(dirname(absolute), { recursive: true });
        const attributes = await lstat(absolute).catch((error: unknown) => {
            if (!hasErrorCode(error, 'ENOENT')) throw error;
            return undefined;
        });
        if (attributes?.isSymbolicLink() === true) await unlink(absolute);
        await writeFile(absolute, text);
    }
    for (const path of changes.executable) await markExecutable(root, path);
    await writeFile(join(root, SETTINGS_FILE), changes.settings);
}

/**
Change a sandbox, and on disposal restore its files, its index and `HEAD` from a savedTree taken before the change, so
a failed change still restores them. Disposal deletes new ignored files and the folders they leave empty, but cannot
bring back an ignored file that the change deleted.
*/
export async function changeSandbox(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    const cwd = sandbox.root;
    const index = runGitStep(cwd, ['write-tree']);
    const head = runCommandBlocking(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: cwd, env: {} });
    const ignored = new Set(
        runGitStep(cwd, ['ls-files', '--others', '--ignored', '--exclude-standard', '-z']).split('\0'),
    );
    const savedIndex = join(runGitStep(cwd, ['rev-parse', '--absolute-git-dir']), randomUUID());
    const environment = { GIT_INDEX_FILE: savedIndex };
    runGitStep(cwd, ['add', '-A'], environment);
    const savedTree = runGitStep(cwd, ['write-tree'], environment);
    const previous = await readFile(join(cwd, SETTINGS_FILE), 'utf8');
    const settings = [changes.files[SETTINGS_FILE] ?? previous, changes.settings]
        .filter((text) => text !== undefined)
        .join('\n');
    const restore = async (): Promise<void> => {
        try {
            const ignoredAfter = runGitStep(cwd, [
                'ls-files',
                '--others',
                '--ignored',
                '--exclude-standard',
                '-z',
            ]).split('\0');
            runGitStep(cwd, ['add', '-A'], environment);
            runGitStep(cwd, ['read-tree', '-u', '--reset', savedTree], environment);
            if (head.code === 0) runGitStep(cwd, ['reset', '--soft', head.stdout.trim()]);
            else if (runCommandBlocking(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: cwd, env: {} }).code === 0)
                runGitStep(cwd, ['update-ref', '-d', 'HEAD']);
            runGitStep(cwd, ['read-tree', index]);
            for (const path of ignoredAfter) if (path !== '' && !ignored.has(path)) await deleteLeftover(cwd, path);
        } finally {
            await unlink(savedIndex);
        }
    };
    try {
        await writeChanges(cwd, {
            files: changes.files,
            settings,
            removed: changes.removed ?? [],
            executable: changes.executable ?? [],
        });
    } catch (error) {
        await restore();
        throw error;
    }
    return { [Symbol.asyncDispose]: restore };
}

/**
Write the sample files and run apply. Disposal restores the working files, index, and current commit.
*/
export async function writeSandboxChanges(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeSandbox(sandbox, changes));
    await runGspotStep(sandbox, ['apply']);
    return resources.move();
}

/**
Write the generated files for an existing test repository.
*/
export async function applyGeneratedFiles(root: string): Promise<void> {
    const writer = openFiles(root);
    const session = await openSession(root);
    await writeGeneratedFiles(session, buildGeneratedFiles(session), writer);
}

/**
Build the changes that replace the files of a sandbox plan with these files and keep its .gitignore.
*/

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Tests in many files replace the files of a sandbox through it, and jscpd reports the inlined copies as clones.
export function buildSandboxChanges(
    planFiles: Readonly<Record<string, string>>,
    files: Record<string, string>,
): SandboxChanges {
    return {
        files,
        removed: Object.keys(planFiles).filter((path) => path !== '.gitignore' && !Object.hasOwn(files, path)),
    };
}
