// Host Bash and Zsh and the pinned Bats parse test scripts after apply writes the configuration.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { executeRun } from '#cli/execution/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { isPosix } from '#tests/config/harness/platforms.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { NESTED_POLICY } from '#tests/config/samples/commands.ts';
import { containing, textContaining } from '#tests/harness/expectations.ts';
import { runGspot, spawnGspot, checkReport, buildRunOptions } from '#tests/harness/gspot.ts';
import { SYNTAX_CASES, DECLARATION_CASES } from '#tests/config/tools/configurations/language/bash/syntax.ts';

// Windows has no Zsh or Bats; Linux and macOS run all three.
test.each(isPosix ? SYNTAX_CASES : SYNTAX_CASES.slice(0, 1))(
    '$check accepts clean files and reports syntax in $path',
    async (entry) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], { level: 'all' }),
            'script.sh': 'echo example\n',
            launcher: '#!/usr/bin/env -S bash -e\necho example\n',
            'script.zsh': 'repeat 2 do print example; done\n',
            zlauncher: '#!/usr/bin/env -S zsh -f\nrepeat 2 do print example; done\n',
            'script.bats': '@test "example" {\n    true\n}\n',
        });
        const environment = { PATH: buildToolsPath(isPosix ? ['bats'] : []) };
        const applied = await spawnGspot(sandbox.path, ['apply'], environment);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const clean = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
        expect(clean.code, clean.stdout + clean.stderr).toBe(0);
        const report = JSON.parse(clean.stdout) as RunReport;
        expect(report.checks[0]?.status).toBe('passed');
        const planned = planRun(await openSession(sandbox.path), { stage: 'all', skips: [], only: [entry.check] });
        expect(planned[0]?.files.map(({ path }) => path)).toStrictEqual(entry.files);
        expect(report.checks[0]?.fileCount).toBe(entry.files.length);
        const path = join(sandbox.path, entry.path);
        const original = await readFile(path);
        try {
            await Bun.write(path, entry.broken);
            const broken = await spawnGspot(sandbox.path, ['check', '--only', entry.check, '--json'], environment);
            expect(broken.code, broken.stdout + broken.stderr).toBe(1);
            const failed = JSON.parse(broken.stdout) as RunReport;
            expect(failed.checks).toMatchObject([{ check: entry.check, status: 'failed' }]);
            expect(failed.checks[0]!.findings).toContainEqual(
                containing({
                    file: entry.path,
                    line: entry.line,
                    message: textContaining(entry.message),
                }),
            );
        } finally {
            await Bun.write(path, original);
        }
    },
);

test.skipIf(!isPosix)('Bash findings retain newline and colon directory names without Git', async () => {
    await using sandbox = await testdir();
    const paths = ['source\nfiles/greet.sh', 'source:files/greet.sh'];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash']),
        ...Object.fromEntries(paths.map((path) => [path, 'if then\n'])),
    });
    const options = buildRunOptions({ only: ['bash/bash-syntax'] });
    const broken = await executeRun(await openSession(sandbox.path), options);
    expect(broken.report.exitCode).toBe(1);
    expect(
        [...new Set(broken.report.checks[0]!.findings.map((finding) => finding.file))].toSorted((left, right) =>
            left.localeCompare(right),
        ),
    ).toStrictEqual(paths);
});

test('switching levels preserves finding checks and selects stricter naming checks', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['bash', 'naming']),
        'entry.sh': 'helper_command=example\n',
    });
    const command = ['check', '--only', 'bash/bash-syntax', 'naming/identifiers', '--json'];
    const recommended = await checkReport(sandbox.path, command);
    expect(recommended.code, recommended.stdout + recommended.stderr).toBe(0);
    const report = recommended.report;
    expect(report.skips).toStrictEqual([]);
    expect(report.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/bash-syntax', status: 'passed' },
    ]);
    await Bun.write(join(sandbox.path, 'entry.sh'), 'if then\n');
    const invalid = await checkReport(sandbox.path, command);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    expect(invalid.report.checks[0]).toMatchObject({
        check: 'bash/bash-syntax',
        status: 'failed',
        fileCount: 1,
    });
    await Bun.write(join(sandbox.path, 'entry.sh'), 'helper_command=example\n');
    const all = await runGspot(sandbox.path, ['set', 'level', 'all']);
    expect(all.code, all.stdout + all.stderr).toBe(0);
    const strict = await checkReport(sandbox.path, command);
    expect(strict.code, strict.stdout + strict.stderr).toBe(1);
    const strictReport = strict.report;
    expect(strictReport.skips).toStrictEqual([]);
    expect(strictReport.checks.map(({ check, status }) => ({ check, status }))).toStrictEqual([
        { check: 'bash/bash-syntax', status: 'passed' },
        { check: 'naming/identifiers', status: 'failed' },
    ]);
    expect(strictReport.checks[1]!.findings).toHaveLength(1);
    expect(strictReport.checks[1]!.findings[0]).toMatchObject({
        check: 'naming/identifiers',
        file: 'entry.sh',
        line: 1,
        rule: 'banned-term',
    });
    const reset = await runGspot(sandbox.path, ['set', 'level', '--default']);
    expect(reset.code, reset.stdout + reset.stderr).toBe(0);
    const routine = await checkReport(sandbox.path, command);
    expect(routine.code, routine.stdout + routine.stderr).toBe(0);
    expect(routine.report.checks.map((check) => check.check)).toStrictEqual(['bash/bash-syntax']);
});

test.each(DECLARATION_CASES)(
    '$kind directories return to source checks when their declaration is removed',
    async ({ kind, directory, tables, files, setup }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['bash'], { tables }),
            'entry.sh': 'echo example\n',
            ...Object.fromEntries(files),
        });
        for (const command of setup) {
            const changed = await runGspot(sandbox.path, command);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        }
        const before = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
        expect(before.code, before.stdout + before.stderr).toBe(0);
        expect(before.report.checks).toMatchObject([
            { check: 'bash/bash-syntax', status: 'passed', fileCount: 1, findings: [] },
        ]);
        const removed = await runGspot(sandbox.path, ['set', kind, directory, '--remove']);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        const after = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
        expect(after.code, after.stdout + after.stderr).toBe(1);
        const checked = after.report.checks[0];
        expect(checked).toMatchObject({ check: 'bash/bash-syntax', status: 'failed', fileCount: 2 });
        expect(new Set(checked?.findings.map((finding) => finding.file))).toStrictEqual(
            new Set([`${directory}/broken.sh`]),
        );
    },
);

test('command checks retain nested inputs and report their findings once at the root', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `${NESTED_POLICY}\n[check."project/syntax"]\ncommand = ["bash", "-n", "{files}"]\npaths = ["**/*.sh"]\nstage = "push"\n`,
        'api/source.sh': 'if then\n',
        'web/source.sh': 'echo sibling\n',
    });
    const options = buildRunOptions({
        stage: 'push',
        only: ['project/syntax'],
        changed: ['api/source.sh'],
    });
    const failed = await executeRun(await openSession(sandbox.path), options);
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks).toMatchObject([
        { check: 'project/syntax', scope: '', fileCount: 1, status: 'failed' },
    ]);
});

test('placeholder reasons and omitted tool-option reasons are refused without a policy write', async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': `configurations = ["bash"]\n[agent_rules]\nenabled = false\n`,
        'entry.sh': 'echo example\n',
    });
    const before = await readFile(join(directory.path, 'gspot.toml'), 'utf8');
    const ignored = await runGspot(directory.path, ['ignore', 'bash/bash-syntax', '--reason', 'TBD']);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(2);
    expect(ignored.stdout + ignored.stderr).toContain('needs a reason that says something');
    expect(await readFile(join(directory.path, 'gspot.toml'), 'utf8')).toBe(before);
    const loosened = await runGspot(directory.path, ['set', 'limits.file_lines', '400', '--reason', 'TBD']);
    expect(loosened.code, loosened.stdout + loosened.stderr).toBe(2);
    const policyPath = join(directory.path, 'gspot.toml');
    const written = await readFile(policyPath, 'utf8');
    await Bun.write(policyPath, written + '\n[tools.shellcheck.verbatim]\nexternal_sources = true\n');
    const checked = await checkReport(directory.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const findings = checked.report.checks
        .filter((check) => check.check === 'gspot/policy')
        .flatMap((check) => check.findings);
    const aboutExtra = {
        file: 'gspot.toml',
        message: textContaining('[tools.shellcheck.verbatim] needs an entry in [reasons]'),
    };
    expect(findings).toMatchObject([aboutExtra]);
    expect(await readFile(policyPath, 'utf8')).toBe(
        written + '\n[tools.shellcheck.verbatim]\nexternal_sources = true\n',
    );
});

test('a nested unknown setting is a finding at its key path', async () => {
    const policy = buildPolicy(['bash'], {
        tables: '[scope."api"]\n[scope."api".limits]\nfile_linse = 200\n',
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'api/source.sh': 'echo example\n' });
    const invalid = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
    const report = invalid.report;
    expect(report.checks.find((check) => check.check === 'gspot/policy')?.findings).toMatchObject([
        { message: textContaining('scope.api.limits.file_linse:') },
    ]);
});

test('a loosening without a reason is a finding of gspot/policy, and the rest of the policy runs', async () => {
    const policy = buildPolicy(['bash'], {
        tables: '[limits]\nfile_lines = 1000\n',
    });
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': policy, 'source.sh': 'echo example\n' });
    const checked = await checkReport(sandbox.path, ['check', '--only', 'bash/bash-syntax', '--json']);
    expect(checked.code, checked.stdout + checked.stderr).toBe(1);
    const report = checked.report;
    expect(report.checks).toMatchObject([
        { check: 'bash/bash-syntax', status: 'passed' },
        {
            check: 'gspot/policy',
            status: 'failed',
            findings: [{ file: 'gspot.toml', message: textContaining('limits.file_lines: ') }],
        },
    ]);
    const listed = await runGspot(sandbox.path, ['list', '--json']);
    expect(listed.code, listed.stdout + listed.stderr).toBe(0);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code).toBe(2);
    expect(applied.stdout + applied.stderr).toContain('gspot.toml: limits.file_lines:');
});
