import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run/checks.ts';
import { openSession } from '#cli/engine/session.ts';
import { listFindingRows } from '#tests/setup/cli/commands.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';

test('after --fix, the checks read the fixed file', async () => {
    const tables = stringify({
        command_check: [
            {
                id: 'project/defects',
                stage: 'commit',
                paths: ['notes.txt'],
                command: buildProgramCommand('checks/search', '--text', 'defect', '--report', 'line', '--', '{files}'),
                fix: buildProgramCommand('checks/replacement', 'passing defect', 'fixed', '{files}'),
                output: { format: 'regex', pattern: String.raw`^(?<file>[^:]+):(?<line>\d+):(?<message>.*)$` },
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
        'notes.txt': 'passing defect\nlasting defect\n',
    });
    const options = buildRunOptions({ only: ['project/defects'] });
    const unfixed = await runChecks(await openSession(sandbox.path), options);
    expect(listFindingRows(unfixed.report)).toStrictEqual([
        { file: 'notes.txt', line: 1, rule: undefined },
        { file: 'notes.txt', line: 2, rule: undefined },
    ]);
    const fixed = await runChecks(await openSession(sandbox.path), { ...options, fix: true });
    expect(fixed.report.exitCode).toBe(1);
    expect(listFindingRows(fixed.report)).toStrictEqual([{ file: 'notes.txt', line: 2, rule: undefined }]);
    expect(fixed.fixes?.results).toMatchObject([{ status: 'changed', changed: ['notes.txt'] }]);
});

test('a fix run rereads the repository and keeps the package scopes it found', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['docs'], { level: 'all' }),
        'package.json': '{"name":"root","private":true,"scripts":{"root":"true"}}',
        'README.md': 'Run `bun run root`.\n',
        'app/package.json': '{"name":"app","private":true,"scripts":{"child":"true"}}',
        'app/README.md': 'Run `bun run child`.\n',
        'app/main.js': 'export const ready = true;\n',
    });
    const session = await openSession(sandbox.path);
    expect(session.repository.scopeFolders.map(({ path }) => path)).toStrictEqual(['', 'app']);
    const options = buildRunOptions({ only: ['docs/missing-paths'] });
    const unchanged = await runChecks(session, options);
    const fixed = await runChecks(await openSession(session.root), { ...options, fix: true });
    expect(unchanged.report.exitCode).toBe(0);
    expect(fixed.report.exitCode, JSON.stringify(fixed.report.checks)).toBe(0);
    expect(fixed.report.checks.map(({ scope, status, findings }) => ({ scope, status, findings }))).toStrictEqual(
        unchanged.report.checks.map(({ scope, status, findings }) => ({ scope, status, findings })),
    );
});

test('checks read a new file inventory after a fixer creates a source and leave the session they got as it was', async () => {
    const tables = stringify({
        command_check: [
            {
                id: 'project/inventory',
                stage: 'commit',
                paths: ['*.txt'],
                command: buildProgramCommand('checks/arguments', '--includes', 'added.txt', '--', '{files}'),
                fix: buildProgramCommand('fakes/tool', '--text', 'created', 'added.txt'),
            },
        ],
    });
    await using sandbox = await createGitSandbox({
        'source.txt': 'input',
        'gspot.toml': buildSandboxSettings([], { rules: true, tables }),
    });

    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources });
    const options = buildRunOptions({ stage: 'commit', fix: true, only: ['project/inventory'] });
    const result = await runChecks(session, options);
    expect(result.report.exitCode).toBe(0);
    expect(result.report.checks[0]!.fileCount).toBe(2);
    expect(session.repository.files.map((file) => file.path)).toStrictEqual(['gspot.toml', 'source.txt']);
});
