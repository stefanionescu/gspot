import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { expect, test } from 'bun:test';
import { planRun } from '#cli/execution/plan.ts';
import { runText } from '#cli/output/reporter.ts';
import { sarifText } from '#cli/output/report.ts';
import { createFileTree, testdir } from 'testdirs';
import { settingRows } from '#cli/commands/list.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { executeRun } from '#cli/execution/execute.ts';
import { openSession } from '#cli/execution/session.ts';
import { runEngineCheck } from '#cli/execution/engines.ts';
import { containing } from '#tests/support/expectations.ts';
import { coverageReport } from '#cli/execution/coverage.ts';
import { explain } from '#cli/commands/explain/subjects.ts';

test('a root project check does not supply a disabled child scope with coverage', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[[scope]]\npath = "app"\nconfigurations = []\n',
        'source.sh': 'echo root\n',
        'app/source.sh': 'echo nested\n',
    });
    const session = await openSession(sandbox.path);
    for (const scope of session.scopes) {
        const manifest = scope.selected.find((entry) => entry.configuration.name === 'bash')!;
        const syntax = manifest.checks.find((entry) => entry.name === 'bash/syntax')!;
        scope.selected = [{ ...manifest, checks: scope.scope.path === '' ? [{ ...syntax, runs: 'per-scope' }] : [] }];
    }
    const coverage = coverageReport(session);
    expect(coverage.unchecked.map((entry) => entry.path)).toContain('app/source.sh');
    expect(coverage.endings).toContainEqual({ ending: '.sh', scope: 'app', files: 1, kinds: [] });
    expect(coverage.endings).toContainEqual({ ending: '.sh', scope: '', files: 1, kinds: ['syntax'] });
    session.scopes.find((scope) => scope.scope.path === 'app')!.selected = session.scopes[0]!.selected;
    const corrected = coverageReport(session);
    expect(corrected.unchecked.map((entry) => entry.path)).not.toContain('app/source.sh');
    expect(corrected.endings).toContainEqual({ ending: '.sh', scope: 'app', files: 1, kinds: ['syntax'] });
});

test('strict coverage fails uncovered supported sources and accepts enabled checks even in a narrowed run', async () => {
    await using sandbox = await testdir();
    const policy = {
        version: 1,
        configurations: [],
        coverage: { strict: true },
        check: [
            {
                name: 'project/policy',
                command: [process.execPath, '-e', 'Bun.TOML.parse(await Bun.file("gspot.toml").text())'],
                paths: ['gspot.toml'],
                stage: 'commit',
            },
        ],
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify(policy),
        'source.sh': 'echo example\n',
        'unknown.gspot-unsupported': 'Authored text with no registered linter.\n',
        'icon.png': Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    const options = { stage: 'all', skips: [], fix: false, isDryRun: false, noCache: true } as const;
    const session = await openSession(sandbox.path);
    expect(settingRows(session.policyFiles.policy, session.scopes).rows).toContainEqual(
        containing({ key: 'coverage.strict', value: true }),
    );
    expect(explain(session, 'coverage.strict')).toMatchObject({ kind: 'setting' });
    const failed = await executeRun(session, { ...options, skips: [] });
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.coverage.unchecked).toBe(coverageReport(session).unchecked.length);
    expect(failed.report.coverage.findings.map((entry) => entry.file)).toStrictEqual(['source.sh']);
    expect(runText(failed.report, { quiet: true, verbose: false })).toContain('1 finding,');
    expect(runText(failed.report, { quiet: true, verbose: false })).toEndWith('(failed)\n');
    expect(JSON.parse(sarifText(failed.report))).toHaveProperty('runs.0.results.0.ruleId', 'coverage.strict');
    expect(
        JSON.parse(readFileSync(join(sandbox.path, '.gspot/reports/report.codequality.json'), 'utf8')),
    ).toMatchObject([{ check_name: 'coverage.strict', location: { path: 'source.sh' } }]);
    writeFileSync(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            ...policy,
            check: [
                ...policy.check,
                {
                    name: 'project/syntax',
                    command: ['bash', '-n', '{files}'],
                    paths: ['source.sh'],
                    stage: 'manual',
                },
            ],
        }),
    );
    const corrected = await executeRun(await openSession(sandbox.path), {
        ...options,
        stage: 'manual',
        skips: [],
        paths: ['source.sh'],
    });
    expect(corrected.report.coverage).toStrictEqual({ checked: 1, unchecked: 0, findings: [] });
    expect(corrected.report.exitCode).toBe(0);
});

test('strict coverage keeps inability as exit two and leaves message-stage checks independent', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            coverage: { strict: true },
            check: [
                {
                    name: 'project/unavailable',
                    command: ['gspot-missing-coverage-command'],
                    paths: ['source.sh'],
                    stage: 'commit',
                },
            ],
        }),
        'source.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const failed = await executeRun(session, { stage: 'all', skips: [], fix: false, isDryRun: true, noCache: true });
    expect(failed.report.exitCode).toBe(2);
    expect(failed.report.coverage.findings.map((entry) => entry.file)).toContain('gspot.toml');
    const message = await executeRun(session, { stage: 'message', skips: [], fix: false, isDryRun: true });
    expect(message.report.exitCode).toBe(0);
    expect(message.report.coverage.findings).toStrictEqual([]);
});

test('engine coverage rejects an unobserved path and accepts confirmed repository sources', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        'source.sh': 'echo example\n',
    });
    const session = await openSession(sandbox.path);
    const [planned] = await planRun(session, { stage: 'all', only: ['bash/syntax'], skips: [] });
    const failed = await runEngineCheck(
        session,
        () => Promise.resolve({ findings: [], checkedFiles: ['../outside.sh'] }),
        planned!,
    );
    expect(failed.status).toBe('error');
    expect(failed.checkedFiles).toBeUndefined();
    const corrected = await runEngineCheck(
        session,
        () => Promise.resolve({ findings: [], checkedFiles: ['source.sh', 'source.sh'] }),
        planned!,
    );
    expect(corrected).toMatchObject({ status: 'ok', files: 1, checkedFiles: ['source.sh'] });
});

test('a per-scope check runs only where that scope owns a claimed source', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n[[scope]]\npath = "app"\nconfigurations = []\n',
        'app/source.sh': 'echo example\n',
        'notes.md': 'No shell source belongs to the root.\n',
    });
    const session = await openSession(sandbox.path);
    for (const scope of session.scopes) {
        const manifest = scope.selected.find((entry) => entry.configuration.name === 'bash')!;
        const syntax = manifest.checks.find((entry) => entry.name === 'bash/syntax')!;
        if (syntax.engine !== undefined || syntax.analysis !== undefined || syntax.reported_by !== undefined)
            throw new Error('The fixture requires the shell syntax command.');
        scope.selected = [
            {
                ...manifest,
                checks: [{ ...syntax, runs: 'per-scope', cwd: 'scope', command: ['bash', '-n', 'source.sh'] }],
            },
        ];
    }
    const outcome = await executeRun(session, {
        stage: 'all',
        only: ['bash/syntax'],
        skips: [],
        fix: false,
        isDryRun: true,
        noCache: true,
    });
    expect(outcome.report.exitCode).toBe(0);
    expect(outcome.report.checks).toMatchObject([{ check: 'bash/syntax', scope: 'app', status: 'ok' }]);
    expect(outcome.report.coverage).toStrictEqual({ checked: 1, unchecked: 2, findings: [] });
});

test('a project-wide check covers its claimed sources without claiming unrelated project inputs', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'version = 1\nconfigurations = ["bash"]\n',
        'source.sh': 'echo example\n',
        'notes.md': 'An unrelated source document.\n',
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const manifest = scope.selected.find((entry) => entry.configuration.name === 'bash')!;
    const syntax = manifest.checks.find((entry) => entry.name === 'bash/syntax')!;
    if (syntax.engine !== undefined || syntax.analysis !== undefined || syntax.reported_by !== undefined)
        throw new Error('The fixture requires the shell syntax command.');
    scope.selected = [
        { ...manifest, checks: [{ ...syntax, runs: 'per-scope', command: ['bash', '-n', 'source.sh'] }] },
    ];
    const outcome = await executeRun(session, {
        stage: 'all',
        only: ['bash/syntax'],
        skips: [],
        fix: false,
        isDryRun: true,
        noCache: true,
    });
    expect(outcome.report.checks).toMatchObject([{ check: 'bash/syntax', status: 'ok' }]);
    expect(outcome.report.coverage).toStrictEqual({ checked: 1, unchecked: 2, findings: [] });
});

test.each([
    { scenario: 'pass', status: 'ok', checked: 1 },
    { scenario: 'finding', status: 'fail', checked: 1 },
    { scenario: 'skip', status: 'skipped', checked: 0 },
    { scenario: 'ignore', status: 'skipped', checked: 0 },
    { scenario: 'missing', status: 'missing', checked: 0 },
])('coverage counts executed source checks for $scenario', async ({ scenario, status, checked }) => {
    await using sandbox = await testdir();
    const check = 'project/syntax';
    await createFileTree(sandbox.path, {
        'gspot.toml': stringify({
            version: 1,
            configurations: [],
            ...(scenario === 'ignore' ? { ignore: [{ check }] } : {}),
            check: [
                {
                    name: check,
                    command:
                        scenario === 'missing'
                            ? ['gspot-missing-coverage-executable', '{files}']
                            : ['bash', '-n', '{files}'],
                    paths: ['source.sh'],
                    stage: 'commit',
                },
            ],
        }),
        'source.sh': scenario === 'finding' ? 'if then\n' : 'echo example\n',
    });
    const outcome = await executeRun(await openSession(sandbox.path), {
        stage: 'all',
        skips: scenario === 'skip' ? [check] : [],
        fix: false,
        isDryRun: true,
        noCache: true,
    });
    expect(outcome.report.checks).toMatchObject([{ check, status }]);
    expect(outcome.report.coverage).toStrictEqual({ checked, unchecked: scenario === 'ignore' ? 2 : 1, findings: [] });
});
