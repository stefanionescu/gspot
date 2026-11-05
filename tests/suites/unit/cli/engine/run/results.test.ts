import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import * as locate from '#cli/tools/locate.ts';
import type { Finding } from '#cli/types/engine/tool-runs.ts';
import { QUALITY_SEARCH_ARGUMENTS, SCOPE_CHECK_FILES, SCOPE_FINDINGS } from '#tests/config/engine/run.ts';
import { CANCELED_CHECK_NOTE } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspot } from '#tests/setup/cli/commands.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { waitForExit, waitForFile } from '#tests/setup/system/processes.ts';
import { buildProgramCommand, readCallRecords } from '#tests/setup/system/programs.ts';

test('an aborted run stops its command and reports cancellation on every system', async () => {
    await using sandbox = await createGitSandbox({});
    const marker = join(sandbox.path, 'command-ready');
    const command = buildProgramCommand('fakes/tool', '--mark', marker, '--wait');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [{ id: 'project/cancel', stage: 'commit', paths: ['source.txt'], command }],
            }),
        }),
        'source.txt': 'Input.\n',
    });
    const controller = new AbortController();
    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources });
    session.cancelSignal = controller.signal;
    const running = runChecks(session, buildRunOptions({ only: ['project/cancel'] }));
    expect(await waitForFile(marker)).toBe(true);
    controller.abort(143);
    const result = await running;
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks).toMatchObject([{ check: 'project/cancel', status: 'canceled' }]);
    await waitForExit(Number(await readFile(marker, 'utf8')));
});

test('a check whose code fails because the run was canceled reports the cancellation', async () => {
    await using sandbox = await createGitSandbox({});
    const marker = join(sandbox.path, 'build-ready');
    const command = buildProgramCommand('fakes/tool', '--mark', marker, '--wait');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['site'], {
            level: 'all',
            tables: `[site]\nbuild_command = ${JSON.stringify(command)}\n`,
        }),
        'index.html': '<p>Ready.</p>\n',
    });
    const controller = new AbortController();
    using resources = createRunResources();
    const session = await openSession(sandbox.path, { resources });
    session.cancelSignal = controller.signal;
    const running = runChecks(session, buildRunOptions({ only: ['site/build'] }));
    expect(await waitForFile(marker)).toBe(true);
    controller.abort(130);
    const result = await running;
    expect(result.report.checks).toMatchObject([
        { check: 'site/build', status: 'canceled', note: CANCELED_CHECK_NOTE },
    ]);
    await waitForExit(Number(await readFile(marker, 'utf8')));
});

test('a run canceled during its tool lookups reports the check canceled', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['spelling']),
        'notes.md': 'Notes.\n',
    });
    await applyGeneratedFiles(sandbox.path);
    const controller = new AbortController();
    const session = await openSession(sandbox.path);
    session.cancelSignal = controller.signal;
    using _binPaths = spyOn(locate, 'readToolBinPaths').mockImplementation(() => {
        controller.abort(130);
        return Promise.resolve({ folders: [] });
    });
    const running = runChecks(session, buildRunOptions({ only: ['spelling/typos'] }));
    const result = await running;
    expect(result.report.checks).toMatchObject([{ check: 'spelling/typos', status: 'canceled' }]);
});

test('a path ignore keeps the check and its fixer off those paths, and a run of only ignored paths is skipped', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings([], {
        tables: stringify({
            command_check: [
                {
                    id: 'project/quality',
                    command: buildProgramCommand('checks/search', ...QUALITY_SEARCH_ARGUMENTS),
                    fix: buildProgramCommand(
                        'fakes/tool',
                        '--record',
                        'fixed.txt',
                        '--text',
                        'corrected\n',
                        '--',
                        '{files}',
                    ),
                    paths: ['inputs/**'],
                    stage: 'commit',
                },
            ],
            ignore: [
                {
                    check: 'project/quality',
                    paths: ['inputs/skip*', '!inputs/skip-keep.txt'],
                    reason: 'The skipped input preserves the sample.',
                },
            ],
        }),
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'inputs/regular.txt': 'defect\n',
        'inputs/skip café.txt': 'defect\n',
        'inputs/skip-keep.txt': 'defect\n',
    });
    const commandArguments = ['check', '--only', 'project/quality', '--fix', '--json'];
    const corrected = parseCheckReport(await runGspot(sandbox.path, commandArguments));
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
    const checkedLog = await readFile(join(sandbox.path, 'checked.txt'), 'utf8');
    const fixedCalls = await readCallRecords(join(sandbox.path, 'fixed.txt'));
    const fileLists = [
        ...checkedLog
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line) as string[]),
        ...fixedCalls.map((call) => call.arguments),
    ];
    for (const files of fileLists)
        expect(files.toSorted(compareText)).toStrictEqual(['inputs/regular.txt', 'inputs/skip-keep.txt']);
    expect(await readFile(join(sandbox.path, 'inputs/skip café.txt'), 'utf8')).toBe('defect\n');
    const checked = await readFile(join(sandbox.path, 'checked.txt'), 'utf8');
    const fixed = await readFile(join(sandbox.path, 'fixed.txt'), 'utf8');
    const skipped = parseCheckReport(await runGspot(sandbox.path, [...commandArguments, '--', 'inputs/skip café.txt']));
    expect(skipped.code, skipped.stdout + skipped.stderr).toBe(0);
    expect(skipped.report.checks[0]).toMatchObject({ status: 'skipped', cause: 'ignore', findings: [] });
    expect(await readFile(join(sandbox.path, 'checked.txt'), 'utf8')).toBe(checked);
    expect(await readFile(join(sandbox.path, 'fixed.txt'), 'utf8')).toBe(fixed);
});

test('a path ignore covers its own paths, not the scopes below or beside it', async () => {
    await using sandbox = await createGitSandbox({});
    const settings = buildSandboxSettings(['bash'], {
        tables: stringify({
            ignore: [
                {
                    check: 'bash/safety',
                    rule: 'recursive-remove',
                    paths: ['root.sh'],
                    reason: 'The root script owns process cleanup.',
                },
                {
                    check: 'bash/safety',
                    rule: 'recursive-remove',
                    paths: ['app/cleanup.sh'],
                    reason: 'The application script owns process cleanup.',
                },
            ],
        }),
        scopes: [{ path: 'app' }, { path: 'app/child' }, { path: 'sibling' }],
    });
    const source = '#!/usr/bin/env bash\nrm -rf "$target"\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'root.sh': source,
        'app/cleanup.sh': source,
        'app/child/cleanup.sh': source,
        'sibling/cleanup.sh': source,
    });
    const command = ['check', '--only', 'bash/safety', '--json'];
    const broken = parseCheckReport(await runGspot(sandbox.path, command));
    expect(broken.code, broken.stdout + broken.stderr).toBe(1);
    expect(broken.report.checks.flatMap((check) => check.findings)).toStrictEqual([
        matchFields({ file: 'app/child/cleanup.sh', line: 2, rule: 'recursive-remove' }),
        matchFields({ file: 'sibling/cleanup.sh', line: 2, rule: 'recursive-remove' }),
    ]);
    for (const path of ['app/child/cleanup.sh', 'sibling/cleanup.sh'])
        await writeFile(`${sandbox.path}/${path}`, '#!/usr/bin/env bash\nprintf "%s\\n" "$target"\n');
    const corrected = await runGspot(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});

test('a check with malformed JSON reports an error, and the other checks keep their results', async () => {
    const reporter = buildProgramCommand('fakes/tool', '--stdout', 'source.txt\n', '--exit', '1');
    const checks = ['broken', 'kept'].map((name) => ({
        id: `sandbox/${name}`,
        command: reporter,
        paths: ['source.txt'],
        stage: 'commit',
        output: name === 'broken' ? { format: 'json' } : { format: 'regex', pattern: '(?<message>.+)' },
    }));
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: checks }) }),
        'source.txt': 'input\n',
    });

    const result = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['sandbox/broken', 'sandbox/kept'] }),
    );
    expect(result.report.exitCode).toBe(2);
    expect(result.report.checks).toMatchObject([
        {
            check: 'sandbox/broken',
            status: 'error',
            note: expect.stringContaining('source.txt') as string,
        },
        { check: 'sandbox/kept', status: 'failed', findings: [{ message: 'source.txt' }] },
    ]);
});

test.each([...SCOPE_FINDINGS])("each check in a scope reads only that scope's files: $check", async (row) => {
    await using sandbox = await createGitSandbox({
        ...SCOPE_CHECK_FILES,
        'gspot.toml': buildSandboxSettings(['site', 'supabase', 'translations', 'cloudflare'], {
            level: 'all',
            scopes: [{ path: 'apps/backend' }],
            tables: '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n[scope.translations]\nmessages_folder = "messages"\n',
        }),
    });

    const result = parseCheckReport(await runGspot(sandbox.path, ['check', '--only', row.check, '--json']));
    expect(result.code, `${row.check}: ${result.stdout}${result.stderr}`).toBe(1);
    expect(
        result.report.checks.map(({ scope, findings }) => ({ scope, findings })),
        row.check,
    ).toStrictEqual([
        { scope: '', findings: row.root.map((finding) => matchFields<Finding>(finding)) },
        { scope: 'apps/backend', findings: row.nested.map((finding) => matchFields<Finding>(finding)) },
    ]);
});
