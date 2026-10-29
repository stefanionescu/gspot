import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { Finding } from '#cli/types/runs/check.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { CANCELED_CHECK_NOTE } from '#tests/config/messages.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { waitForExit, waitForFile } from '#tests/setup/system/processes.ts';
import { SCOPE_FINDINGS, SCOPE_CHECK_FILES, QUALITY_SEARCH_ARGUMENTS } from '#tests/config/commands/check/run.ts';

test('an aborted run stops its command and reports cancellation on every system', async () => {
    await using sandbox = await createGitSandbox({});
    const marker = join(sandbox.path, 'command-ready');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings([], {
            tables: stringify({
                command_check: [
                    {
                        id: 'project/cancel',
                        stage: 'commit',
                        paths: ['source.txt'],
                        command: buildProgramCommand('fakes/tool', '--mark', marker, '--wait'),
                    },
                ],
            }),
        }),
        'source.txt': 'Input.\n',
    });
    const controller = new AbortController();
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    session.cancelSignal = controller.signal;
    const running = runChecks(session, buildRunOptions({ only: ['project/cancel'] }));
    expect(await waitForFile(marker)).toBe(true);
    controller.abort(143);
    const result = await running;
    expect(result.report.exitCode).toBe(143);
    expect(result.report.checks).toMatchObject([
        { check: 'project/cancel', status: 'error', note: `${process.execPath} was canceled.` },
    ]);
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
    const session = await openSession(sandbox.path);
    using _resources = session.resources;
    session.cancelSignal = controller.signal;
    const running = runChecks(session, buildRunOptions({ only: ['site/build'] }));
    expect(await waitForFile(marker)).toBe(true);
    controller.abort(130);
    const result = await running;
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'error', note: CANCELED_CHECK_NOTE }]);
    await waitForExit(Number(await readFile(marker, 'utf8')));
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
                        '--log-arguments',
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
    for (const log of ['checked.txt', 'fixed.txt']) {
        const logText = await readFile(join(sandbox.path, log), 'utf8');
        for (const line of logText.trim().split('\n'))
            expect((JSON.parse(line) as string[]).toSorted((left, right) => left.localeCompare(right))).toStrictEqual([
                'inputs/regular.txt',
                'inputs/skip-keep.txt',
            ]);
    }
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
        output: { format: name === 'broken' ? 'json' : 'lines' },
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
            note: 'The output is not JSON. It starts with: source.txt',
        },
        { check: 'sandbox/kept', status: 'failed', findings: [{ message: 'source.txt' }] },
    ]);
});

test('progress is reported as soon as each check ends, with ignores applied to the final results', async () => {
    await using sandbox = await createGitSandbox({
        'source.sh': 'echo example\n',
        'gspot.toml': buildSandboxSettings([], {
            rules: true,
            tables: stringify({
                ignore: [{ check: 'project/fast', rule: 'demo', reason: 'The sandbox tests filtered progress.' }],
                command_check: [
                    {
                        id: 'project/fast',
                        paths: ['source.sh'],
                        stage: 'commit',
                        command: buildProgramCommand(
                            'fakes/tool',
                            '--stdout',
                            'source.sh:demo:Ignored finding\n',
                            '--exit',
                            '1',
                        ),
                        output: { format: 'regex', pattern: '^(?<file>[^:]+):(?<rule>[^:]+):(?<message>.*)$' },
                    },
                    {
                        id: 'project/waiting',
                        paths: ['source.sh'],
                        stage: 'commit',
                        command: buildProgramCommand('fakes/tool', '--until', 'completed'),
                    },
                ],
            }),
        }),
    });

    const finished: number[] = [];
    const ready = Promise.withResolvers<undefined>();
    const running = runChecks(
        await openSession(sandbox.path),
        buildRunOptions({
            only: ['project/fast', 'project/waiting'],
            onProgress: (progress) => {
                finished.push(progress.finished);
                if (progress.finished === 1) ready.resolve(undefined);
            },
        }),
    );
    await Promise.race([ready.promise, running]);
    await writeFile(join(sandbox.path, 'completed'), 'ready');
    const result = await running;
    expect(result.report.exitCode).toBe(0);
    expect(finished).toStrictEqual([1, 2]);
    expect(result.report.checks.map((each) => each.check)).toStrictEqual(['project/fast', 'project/waiting']);
    expect(result.report.checks[0]).toMatchObject({ status: 'passed', findings: [] });
    expect(result.report.ignores).toStrictEqual([
        { check: 'project/fast', rule: 'demo', reason: 'The sandbox tests filtered progress.' },
    ]);
});

test('an ignore with names keeps them in the run report and in the verbose ignore line', async () => {
    const reason = 'The public hook serves the script caller.';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash'], {
            level: 'all',
            tables: stringify({ ignore: [{ check: 'structure/trivial-functions', names: ['useThing'], reason }] }),
        }),
        'source.sh':
            'useThing() { printf "%s\\n" ready; }\nuseOther() { printf "%s\\n" ready; }\nprintf "%s\\n" complete\n',
    });
    const command = ['check', '--only', 'structure/trivial-functions'];
    const json = parseCheckReport(await runGspot(sandbox.path, [...command, '--json']));
    const verbose = await runGspot(sandbox.path, [...command, '--verbose']);
    expect({ code: json.code, stderr: json.stderr }).toStrictEqual({ code: 1, stderr: '' });
    expect({ code: verbose.code, stderr: verbose.stderr }).toStrictEqual({ code: 1, stderr: '' });
    expect(json.report.checks.flatMap(({ findings }) => findings.map(({ name }) => name))).toStrictEqual(['useOther']);
    expect({
        ignores: json.report.ignores,
        lines: verbose.stdout.split('\n').filter((line) => line.startsWith('ignore     ')),
    }).toStrictEqual({
        ignores: [{ check: 'structure/trivial-functions', names: ['useThing'], reason }],
        lines: [`ignore     structure/trivial-functions names useThing  ${reason}`],
    });
});

test.each([...SCOPE_FINDINGS])("each check in a scope reads only that scope's files: $check", async (row) => {
    await using sandbox = await createGitSandbox({
        ...SCOPE_CHECK_FILES,
        'gspot.toml': buildSandboxSettings(['site', 'supabase', 'translations', 'cloudflare'], {
            level: 'all',
            scopes: [{ path: 'apps/backend' }],
            tables: '[translations]\nmessages_folder = "messages"\nbase_locale = "en"\n[scope.translations]\nmessages_folder = "apps/backend/messages"\n',
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
