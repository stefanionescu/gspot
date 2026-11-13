import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, spyOn, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CheckStop } from '#cli/system/errors.ts';
import { formatUnexpectedError } from '#cli/system/terminal.ts';
import { compareText } from '#cli/system/text/order.ts';
import * as locate from '#cli/tools/locate.ts';
import { buildRunOptions, createRunResources } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { waitForExit, waitForFile } from '#tests/setup/system/processes.ts';
import { buildProgramCommand } from '#tests/setup/system/programs.ts';
import type { CallRecord } from '#tests/types/setup.ts';

function parseJsonLines<Line>(text: string): Line[] {
    const lines = text.trim().split('\n');
    return lines.map((line) => JSON.parse(line) as Line);
}

function selectFailingCheckCode() {
    return {
        check: () => {
            throw new TypeError('Private failure stack');
        },
    };
}

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
    expect(result.report.checks).toMatchObject([{ check: 'site/build', status: 'canceled' }]);
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
    const search = ['--text', 'corrected\n', '--match', 'differs', '--log', 'checked.txt', '--', '{files}'];
    const record = ['--record', 'fixed.txt', '--text', 'corrected\n', '--', '{files}'];
    const settings = buildSandboxSettings([], {
        tables: stringify({
            command_check: [
                {
                    id: 'project/quality',
                    command: buildProgramCommand('checks/search', ...search),
                    fix: buildProgramCommand('fakes/tool', ...record),
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'inputs/regular.txt': 'defect\n',
        'inputs/skip café.txt': 'defect\n',
        'inputs/skip-keep.txt': 'defect\n',
    });
    const options = buildRunOptions({ cwd: sandbox.path, only: ['project/quality'], fix: true });
    const corrected = await runChecks(await openSession(sandbox.path), options);
    expect(corrected.report.exitCode).toBe(0);
    expect(corrected.report.checks[0]).toMatchObject({ status: 'passed', fileCount: 2, findings: [] });
    const checked = await readFile(join(sandbox.path, 'checked.txt'), 'utf8');
    const fixed = await readFile(join(sandbox.path, 'fixed.txt'), 'utf8');
    const fileLists = [
        ...parseJsonLines<string[]>(checked),
        ...parseJsonLines<CallRecord>(fixed).map((call) => call.arguments),
    ];
    for (const files of fileLists)
        expect(files.toSorted(compareText)).toStrictEqual(['inputs/regular.txt', 'inputs/skip-keep.txt']);
    const paths = ['inputs/skip café.txt'];
    const skipped = await runChecks(await openSession(sandbox.path), { ...options, paths, pathArguments: paths });
    expect(skipped.report.exitCode).toBe(0);
    expect(skipped.report.checks[0]).toMatchObject({ status: 'skipped', cause: 'ignore', findings: [] });
    expect(await readFile(join(sandbox.path, 'checked.txt'), 'utf8')).toBe(checked);
    expect(await readFile(join(sandbox.path, 'fixed.txt'), 'utf8')).toBe(fixed);
});

test('a path ignore covers its own paths, not the scopes below or beside it', async () => {
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
    await using sandbox = await createGitSandbox({
        'gspot.toml': settings,
        'root.sh': source,
        'app/cleanup.sh': source,
        'app/child/cleanup.sh': source,
        'sibling/cleanup.sh': source,
    });
    const { report } = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['bash/safety'] }));
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file, rule }) => ({ file, rule })))).toStrictEqual([
        { file: 'app/child/cleanup.sh', rule: 'recursive-remove' },
        { file: 'sibling/cleanup.sh', rule: 'recursive-remove' },
    ]);
});

test.each([
    { name: 'no file', pattern: '^(?<message>.+)$', line: 'oops' },
    { name: 'a folder', pattern: '^(?<file>[^:]+):(?<message>.+)$', line: 'sub:oops' },
])(
    'a fixable finding without a file gives no fix command and does not abort the run: $name',
    async ({ pattern, line }) => {
        const check = {
            id: 'project/quality',
            command: buildProgramCommand('fakes/tool', '--line', line, '--exit', '1'),
            fix: buildProgramCommand('fakes/tool'),
            paths: ['sub/**'],
            runs: 'once',
            exit_codes: [1],
            output: { format: 'regex', pattern, fixable: '.' },
            stage: 'commit',
        };
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [check] }) }),
            'sub/source.txt': 'text\n',
        });
        const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['project/quality'] }));
        expect(result.report.checks).toMatchObject([{ check: 'project/quality', status: 'failed' }]);
        expect(result.report.checks[0]).not.toHaveProperty('fixCommand');
    },
);

test('the fix command of a file that starts with a dash names it as ./-f.txt', async () => {
    const check = {
        id: 'project/quality',
        command: buildProgramCommand('fakes/tool', '--line=-f.txt:oops', '--exit', '1'),
        fix: buildProgramCommand('fakes/tool'),
        paths: ['*.txt'],
        runs: 'once',
        exit_codes: [1],
        output: { format: 'regex', pattern: '^(?<file>[^:]+):(?<message>.+)$', fixable: '.' },
        stage: 'commit',
    };
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], { tables: stringify({ command_check: [check] }) }),
        '-f.txt': 'text\n',
    });
    const paths = ['-f.txt'];
    const options = buildRunOptions({ only: ['project/quality'], cwd: sandbox.path, paths, pathArguments: paths });
    const result = await runChecks(await openSession(sandbox.path), options);
    expect(result.report.checks[0]?.fixCommand).toEndWith(' ./-f.txt');
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
    expect(result.report.checks).toMatchObject([
        {
            check: 'sandbox/broken',
            status: 'error',
            note: expect.stringContaining('source.txt') as string,
        },
        { check: 'sandbox/kept', status: 'failed', findings: [{ message: 'source.txt' }] },
    ]);
});

test('a check that fails inside gspot reports the internal error note, and its stack only under verbose', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([]),
        'source.txt': 'Input.\n',
    });
    const note = formatUnexpectedError('repository/encoding');
    const concise = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['repository/encoding'], selectCheckCode: selectFailingCheckCode }),
    );
    expect(concise.report.checks.map(({ status, note: text, stack }) => ({ status, note: text, stack }))).toStrictEqual(
        [{ status: 'error', note, stack: undefined }],
    );
    const verbose = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['repository/encoding'], selectCheckCode: selectFailingCheckCode, verbose: true }),
    );
    expect(verbose.report.checks).toMatchObject([
        { status: 'error', note, stack: expect.stringContaining('TypeError: Private failure stack') as string },
    ]);
});

test.each([
    { name: 'no cause', options: undefined, cause: 'condition' },
    { name: 'the cause replaced', options: { skipCause: 'replaced' as const }, cause: 'replaced' },
])(
    'a check that stops as skipped reports the skip cause it gives, condition by default: $name',
    async ({ options, cause }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([]),
            'source.txt': 'Input.\n',
        });
        const { report } = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({
                only: ['repository/encoding'],
                selectCheckCode: () => ({
                    check: () => {
                        throw new CheckStop('skipped', 'No input.', options);
                    },
                }),
            }),
        );
        expect(report.checks.map(({ status, cause: reported }) => ({ status, cause: reported }))).toStrictEqual([
            { status: 'skipped', cause },
        ]);
    },
);
