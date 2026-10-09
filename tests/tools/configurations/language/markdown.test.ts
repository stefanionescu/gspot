import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import { shareToolProjects } from '#tests/harness/install.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { FILES, TABLES, TABLE_COLUMN_SAMPLE } from '#tests/config/tools/configurations/language/markdown.ts';

test('Markdown coverage switches by level while scoped native options remain effective', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, FILES);
    for (const level of ['recommended', 'all', 'recommended'] as const) {
        await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['markdown'], { level, tables: TABLES }));
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await shareToolProjects(sandbox.path);
        const failed = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        const findings = report.checks.flatMap((check) => check.findings);
        expect(findings).toContainEqual(containing({ file: 'root.md', line: 7, rule: 'MD045' }));
        expect(findings.filter(({ rule }) => rule === 'MD041').map(({ file }) => file)).toStrictEqual(
            level === 'all' ? ['title.md'] : [],
        );
        expect(findings.filter(({ rule }) => rule === 'MD044')).toStrictEqual([]);
        expect(findings.filter(({ rule }) => ['MD013', 'MD033'].includes(rule ?? ''))).toStrictEqual([]);
        await Bun.write(join(sandbox.path, 'root.md'), FILES['root.md'].replace('![]', '![Request flow]'));
        await Bun.write(
            join(sandbox.path, 'app/guide.md'),
            FILES['app/guide.md'].replace('Nested label.', 'nested label.'),
        );
        const changed = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(changed.code, changed.stdout + changed.stderr).toBe(1);
        const changedReport = JSON.parse(changed.stdout) as RunReport;
        expect(changedReport.checks.flatMap(({ findings: entries }) => entries)).toContainEqual(
            containing({ file: 'app/guide.md', line: 5, rule: 'MD044' }),
        );
        const fixed = await spawnGspot(sandbox.path, [
            'check',
            'app/guide.md',
            '--only',
            'markdown/markdownlint',
            '--fix',
            '--json',
        ]);
        expect(fixed.code, fixed.stdout + fixed.stderr).toBe(0);
        expect(await Bun.file(join(sandbox.path, 'app/guide.md')).text()).toBe(FILES['app/guide.md']);
        expect(await Bun.file(join(sandbox.path, 'root.md')).text()).toBe(
            FILES['root.md'].replace('![]', '![Request flow]'),
        );
        await Bun.write(join(sandbox.path, 'root.md'), FILES['root.md']);
    }
});

test('native Markdown discovery reads shipped defaults and scoped options through the generated editor pointers', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...FILES,
        'gspot.toml': buildPolicy(['markdown'], { level: 'all', tables: TABLES }),
        'root.md': FILES['root.md'].replace('![]', '![Request flow]'),
        'title.md': '# Title\n\nA document with a title.\n',
    });
    const applied = await spawnGspot(sandbox.path, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
    const environment = await shareToolProjects(sandbox.path);
    for (const folder of ['', 'app']) {
        const native = await runTestCommand(
            [
                'markdownlint-cli2',
                '--no-globs',
                ...(folder === '' ? [':root.md', ':title.md', ':long.md'] : [':guide.md']),
            ],
            { cwd: join(sandbox.path, folder), env: environment },
        );
        expect(native.code, native.stdout + native.stderr).toBe(0);
    }
});

test.each(['recommended', 'all'] as const)(
    '%s preserves a reasoned Markdown rule ignore in root and scoped native configurations',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...FILES,
            'title.md': '# Title\n\nA document with a title.\n',
            'gspot.toml': buildPolicy(['markdown'], {
                level,
                tables: `${TABLES}[[ignore]]\ncheck = "markdown/markdownlint"\nrule = "MD045"\nreason = "The sample demonstrates an empty alternative."\n`,
            }),
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await shareToolProjects(sandbox.path);
        const ignored = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        const ignoredReport = JSON.parse(ignored.stdout) as RunReport;
        expect(ignoredReport.checks).toMatchObject([
            { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
            { check: 'markdown/markdownlint', scope: 'app', status: 'passed', findings: [] },
        ]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s enforces native table alignment by default and applies the selected table style',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['markdown'], {
            level,
            tables: TABLES.replace('MD060 = { style = "aligned" }\n', ''),
        });
        await createFileTree(sandbox.path, { 'gspot.toml': policy, 'table.md': TABLE_COLUMN_SAMPLE });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        await shareToolProjects(sandbox.path);
        const failed = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        const report = JSON.parse(failed.stdout) as RunReport;
        expect(report.checks).toMatchObject([
            {
                check: 'markdown/markdownlint',
                scope: '',
                status: 'failed',
                findings: [{ file: 'table.md', rule: 'MD060' }],
            },
        ]);
        await Bun.write(join(sandbox.path, 'table.md'), FILES['long.md']);
        const corrected = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect((JSON.parse(corrected.stdout) as RunReport).checks).toMatchObject([
            { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
        ]);
        await Bun.write(
            join(sandbox.path, 'gspot.toml'),
            buildPolicy(['markdown'], { level, tables: TABLES.replace('style = "aligned"', 'style = "tight"') }),
        );
        const changed = await spawnGspot(sandbox.path, ['apply']);
        expect(changed.code, changed.stdout + changed.stderr).toBe(0);
        const selected = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(selected.code, selected.stdout + selected.stderr).toBe(1);
        expect((JSON.parse(selected.stdout) as RunReport).checks[0]!.findings).toContainEqual(
            containing({ file: 'table.md', rule: 'MD060' }),
        );
        const tight = FILES['long.md']
            .split('\n')
            .map((line) =>
                line.startsWith('|')
                    ? line
                          .split('|')
                          .map((cell) => cell.trim())
                          .join('|')
                    : line,
            )
            .join('\n');
        const passed = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--fix', '--json']);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect((JSON.parse(passed.stdout) as RunReport).checks).toMatchObject([
            { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
        ]);
        expect(await Bun.file(join(sandbox.path, 'table.md')).text()).toBe(tight);
    },
);
