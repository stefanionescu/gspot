import { randomUUID } from 'node:crypto';
import { lstatSync } from 'node:fs';
import { mkdir, readFile, rm, rmdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { SETTINGS_FILE } from '#cli/config/repository/files.ts';
import { openSession } from '#cli/engine/session.ts';
import { writeEveryGeneratedFile } from '#cli/generation/write.ts';
import { hasErrorCode } from '#cli/system/errors.ts';
import { openFiles } from '#cli/system/files/open.ts';
import type { ApplyReport } from '#cli/types/generation.ts';
import { markExecutable, runGitStep } from '#tests/setup/system/git.ts';
import { runBlockingCommand } from '#tests/setup/system/processes.ts';
import type { Sandbox, SandboxChanges, SandboxWrite } from '#tests/types/setup.ts';

async function deleteLeftover(root: string, path: string): Promise<void> {
    await rm(join(root, path), { force: true });
    for (let folder = dirname(path); folder !== '.'; folder = dirname(folder)) {
        try {
            await rmdir(join(root, folder));
        } catch (error) {
            if (hasErrorCode(error, 'ENOTEMPTY') || hasErrorCode(error, 'ENOENT')) return;
            throw error;
        }
    }
}

async function writeChanges(root: string, changes: SandboxWrite): Promise<void> {
    for (const path of changes.removed) await rm(join(root, path));
    for (const [path, text] of Object.entries(changes.files)) {
        const absolute = join(root, path);
        await mkdir(dirname(absolute), { recursive: true });
        if (lstatSync(absolute, { throwIfNoEntry: false })?.isSymbolicLink() === true) await unlink(absolute);
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
    const head = runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: cwd, env: {} });
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
            else if (runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd, env: {} }).code === 0)
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

export async function applyGeneratedFiles(root: string): Promise<ApplyReport> {
    const session = await openSession(root);
    return writeEveryGeneratedFile(session, openFiles(root));
}

export async function writeSandboxChanges(sandbox: Sandbox, changes: SandboxChanges): Promise<AsyncDisposable> {
    await using resources = new AsyncDisposableStack();
    resources.use(await changeSandbox(sandbox, changes));
    await applyGeneratedFiles(sandbox.root);
    return resources.move();
}

export function buildSandboxChanges(
    planFiles: Readonly<Record<string, string>>,
    files: Record<string, string>,
): SandboxChanges {
    return {
        files,
        removed: Object.keys(planFiles).filter((path) => path !== '.gitignore' && !Object.hasOwn(files, path)),
    };
}
