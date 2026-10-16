import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { emitAll } from '#cli/generation/files.ts';
import { pathExists } from '#tests/setup/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { openWriter } from '#cli/ownership/writer.ts';
import { openSession } from '#cli/commands/session.ts';
import { runCommand } from '#tests/setup/processes.ts';
import { spawnGspot } from '#tests/setup/run-gspot.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { settingsText } from '#tests/setup/settings.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { SHELLCHECK_RC } from '#tests/config/bash/tools.ts';
import { prepareNpmLockfile } from '#cli/tools/npm/project.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { openSafeFolder } from '#cli/system/safe-folder/open.ts';
import { UV_LOCKFILE_ARGUMENTS } from '#cli/config/tools/python.ts';
import { NPM_TOOL_PROJECT_FILE } from '#cli/config/system/locations.ts';

test('gspot/generated-files reports an edited file and one with merge conflict markers, and apply clears both', async () => {
    const command = ['check', '--only', 'gspot/generated-files', '--json'];
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['bash']),
        'run.sh': '#!/usr/bin/env bash\necho ok\n',
        '.gitignore': '.gspot/state/\n',
    });
    await writeOwnedFiles(sandbox.path);
    const session = await openSession(sandbox.path);
    const manifest = emitAll(session).files.find(({ path }) => path === NPM_TOOL_PROJECT_FILE)!;
    using files = openSafeFolder(sandbox.path);
    const lockfile = await prepareNpmLockfile(manifest, files, session, undefined, []);
    await writeFile(join(sandbox.path, lockfile.path), lockfile.content);
    const prepared = await runCommand(['uv', ...UV_LOCKFILE_ARGUMENTS], { cwd: join(sandbox.path, '.gspot') });
    expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
    expect(await pathExists(join(sandbox.path, '.gspot/node_modules'))).toBe(false);
    expect(await pathExists(join(sandbox.path, '.gspot/.venv'))).toBe(false);
    const cleanCommand = await spawnGspot(sandbox.path, command);
    const clean = JSON.parse(cleanCommand.stdout) as RunReport;
    expect(clean.checks).toMatchObject([{ check: 'gspot/generated-files', status: 'passed', findings: [] }]);
    const emitted = await readFile(join(sandbox.path, SHELLCHECK_RC), 'utf8');
    await writeFile(join(sandbox.path, SHELLCHECK_RC), `${emitted}disable=SC2034\n`);
    const editedCommand = await spawnGspot(sandbox.path, command);
    const edited = JSON.parse(editedCommand.stdout) as RunReport;
    expect(edited.exitCode).toBe(1);
    expect(edited.checks[0]?.findings).toMatchObject([
        { file: SHELLCHECK_RC, rule: 'changed', help: textContaining('gspot apply') },
    ]);
    await writeFile(
        join(sandbox.path, SHELLCHECK_RC),
        `<<<<<<< HEAD\n${emitted}=======\n${emitted}disable=SC2034\n>>>>>>> feature\n`,
    );
    const conflictedCommand = await spawnGspot(sandbox.path, command);
    const conflicted = JSON.parse(conflictedCommand.stdout) as RunReport;
    expect(conflicted.checks[0]?.findings).toMatchObject([
        {
            file: SHELLCHECK_RC,
            rule: 'changed',
            message: textContaining('merge conflict markers'),
            help: 'Run gspot apply to write the file again, then gspot install to install what it records.',
        },
    ]);
    await writeOwnedFiles(sandbox.path);
    const repairedCommand = await spawnGspot(sandbox.path, command);
    const repaired = JSON.parse(repairedCommand.stdout) as RunReport;
    expect(repaired.checks[0]).toMatchObject({ status: 'passed', findings: [] });
});

/** Write the generated files through their ownership log. */
async function writeOwnedFiles(root: string): Promise<void> {
    using log = openWriter(root);
    const session = await openSession(root);
    writeGeneratedFiles(session, emitAll(session), log);
}
