import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { spawnGspot } from '#tests/harness/gspot.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { containing } from '#tests/harness/expectations.ts';
import type { RunReport } from '#cli/types/execution/runtime.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { FILES, TABLES } from '#tests/config/tools/configurations/language/markdown.ts';

test(
    'Markdown coverage switches by level while scoped native options remain effective',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, FILES);
        for (const level of ['recommended', 'all', 'recommended'] as const) {
            await Bun.write(join(sandbox.path, 'gspot.toml'), buildPolicy(['markdown'], { level, tables: TABLES }));
            const applied = await spawnGspot(sandbox.path, ['apply']);
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            const failed = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
            expect(failed.code, failed.stdout + failed.stderr).toBe(1);
            const report = JSON.parse(failed.stdout) as RunReport;
            const findings = report.checks.flatMap((check) => check.findings);
            expect(findings).toContainEqual(containing({ file: 'root.md', line: 7, rule: 'MD045' }));
            expect(findings.filter(({ rule }) => rule === 'MD041').map(({ file }) => file)).toStrictEqual(
                level === 'all' ? ['title.md'] : [],
            );
            expect(findings.filter(({ rule }) => rule === 'MD044')).toStrictEqual([]);
            expect(findings.filter(({ rule }) => ['MD013', 'MD033', 'MD060'].includes(rule ?? ''))).toStrictEqual([]);
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
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test(
    'native Markdown discovery reads shipped defaults and scoped options through the generated editor pointers',
    async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...FILES,
            'gspot.toml': buildPolicy(['markdown'], { level: 'all', tables: TABLES }),
            'root.md': FILES['root.md'].replace('![]', '![Request flow]'),
            'title.md': '# Title\n\nA document with a title.\n',
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        for (const folder of ['', 'app']) {
            const native = await runTestCommand(
                [
                    'markdownlint-cli2',
                    '--no-globs',
                    ...(folder === '' ? [':root.md', ':title.md', ':long.md'] : [':guide.md']),
                ],
                { cwd: join(sandbox.path, folder) },
            );
            expect(native.code, native.stdout + native.stderr).toBe(0);
        }
    },
    NATIVE_TEST_TIMEOUT_MS,
);

test.each(['recommended', 'all'] as const)(
    '%s preserves a reasoned Markdown rule ignore in root and scoped native configurations',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...FILES,
            'title.md': '# Title\n\nA document with a title.\n',
            'gspot.toml': buildPolicy(['markdown'], {
                level,
                tables: `${TABLES}[[ignore]]\ncheck = "markdown/markdownlint"\nrule = "MD045"\nreason = "The fixture demonstrates an empty alternative."\n`,
            }),
        });
        const applied = await spawnGspot(sandbox.path, ['apply']);
        expect(applied.code, applied.stdout + applied.stderr).toBe(0);
        const ignored = await spawnGspot(sandbox.path, ['check', '--only', 'markdown/markdownlint', '--json']);
        expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
        const ignoredReport = JSON.parse(ignored.stdout) as RunReport;
        expect(ignoredReport.checks).toMatchObject([
            { check: 'markdown/markdownlint', scope: '', status: 'passed', findings: [] },
            { check: 'markdown/markdownlint', scope: 'app', status: 'passed', findings: [] },
        ]);
    },
    NATIVE_TEST_TIMEOUT_MS,
);
