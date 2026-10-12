import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { runCheckSample } from '#tests/setup/fixes.ts';
import { createSandbox } from '#tests/setup/sandbox.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { COMPILER_SOURCE } from '#tests/config/typescript.ts';
import { BASH_REPOSITORY } from '#tests/config/bash/sandbox.ts';
import { containing, containingAll } from '#tests/setup/matchers.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { runGspot, checkReport, buildRunOptions } from '#tests/setup/run-gspot.ts';

import {
    VALE_OFF_GUIDE,
    COMPILER_REASON,
    VALE_FIXED_GUIDE,
    SUPPRESSION_CASES,
    SUPPRESSION_REASONS,
    TYPESCRIPT_SUPPRESSIONS,
    SUPPRESSION_REASON_CASES,
} from '#tests/config/suppressions.ts';

test.each(['javascript', 'typescript'])(
    '@ts-ignore, @ts-expect-error and @ts-nocheck in %s need a reason; the same text in a string is not a comment',
    async (language) => {
        await using sandbox = await testdir();
        const ending = language === 'javascript' ? 'js' : 'ts';
        const paths = TYPESCRIPT_SUPPRESSIONS.map((directive) => `${directive}.${ending}`);
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText([language]),
            ...Object.fromEntries(
                TYPESCRIPT_SUPPRESSIONS.map((directive, index) => [
                    paths[index]!,
                    `// @ts-${directive}\n${COMPILER_SOURCE}`,
                ]),
            ),
            [`control.${ending}`]: COMPILER_SOURCE,
            [`string.${ending}`]: 'export const example = "// @ts-ignore";\n',
        });
        const missing = await checkReport(sandbox.path, ['check', '--only', 'gspot/suppressions', '--json']);
        expect(missing.code, missing.stdout + missing.stderr).toBe(1);
        expect(
            missing.report.checks.flatMap(({ findings }) =>
                findings.map(({ file, line, rule }) => ({ file, line, rule })),
            ),
        ).toStrictEqual(
            paths
                .toSorted((left, right) => left.localeCompare(right))
                .map((file) => ({ file, line: 1, rule: 'tsc-no-reason' })),
        );
        for (const [index, directive] of TYPESCRIPT_SUPPRESSIONS.entries())
            await Bun.write(
                join(sandbox.path, paths[index]!),
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
        const reasoned = await runGspot(sandbox.path, ['check', '--only', 'gspot/suppressions', '--json']);
        expect(reasoned.code, reasoned.stdout + reasoned.stderr).toBe(0);
        for (const [index, directive] of TYPESCRIPT_SUPPRESSIONS.entries())
            expect(await Bun.file(join(sandbox.path, paths[index]!)).text()).toBe(
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
    },
);

test.each(SUPPRESSION_REASON_CASES)(
    'a suppression in %s needs its reason on the line directly above',
    async (path, source, lines) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nconfigurations = ["typescript", "bash"]\n',
            [path]: source,
        });
        const session = await openSession(sandbox.path);
        const result = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
        expect(result.report.checks.map(({ status }) => status)).toStrictEqual([
            lines.length === 0 ? 'passed' : 'failed',
        ]);
        expect(result.report.checks.flatMap(({ findings }) => findings.map(({ line }) => line))).toStrictEqual([
            ...lines,
        ]);
        for (const finding of result.report.checks.flatMap(({ findings }) => findings)) {
            const name = finding.rule!.replace('-no-reason', '');
            expect(finding.message).toBe(`This ${name} suppression has no reason of two or more words.`);
        }
    },
);

test('a <!-- vale off --> comment is reported and passes once removed', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['prose', 'sql'], {
            level: 'all',
        }),
        'guide.md': VALE_OFF_GUIDE,
        'query.sql': '/* Explains the query. */\nSELECT 1;\n',
        'source.ts': 'const example = "<!-- vale off -->";\n',
    });
    const command = ['check', '--only', 'gspot/suppressions', '--json'];
    await Bun.write(join(sandbox.path, 'guide.mdx'), Bun.file(join(sandbox.path, 'guide.md')));
    const failed = await checkReport(sandbox.path, command);
    expect(failed.code, failed.stdout + failed.stderr).toBe(1);
    expect(failed.report.checks).toMatchObject([
        {
            check: 'gspot/suppressions',
            status: 'failed',
            findings: [
                { file: 'guide.md', rule: 'vale', line: 3 },
                { file: 'guide.mdx', rule: 'vale', line: 3 },
            ],
        },
    ]);
    await Bun.write(join(sandbox.path, 'guide.md'), VALE_FIXED_GUIDE);
    await Bun.write(join(sandbox.path, 'guide.mdx'), Bun.file(join(sandbox.path, 'guide.md')));
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'gspot/suppressions', status: 'passed', findings: [] }]);
    expect(await Bun.file(join(sandbox.path, 'query.sql')).text()).toBe('/* Explains the query. */\nSELECT 1;\n');
});

test.each(['-->', '--!>'])('an HTML suppression that ends with %s still needs a reason', async (ending) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'level = "all"\nconfigurations = ["html", "structure"]\n',
        'page.html': `<!-- html-validate-disable attr -- External validator owns this attribute. ${ending}\n<!-- html-validate-disable attr ${ending}\n`,
    });
    const session = await openSession(sandbox.path);
    const result = await executeRun(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
    expect(result.report.exitCode).toBe(1);
    expect(
        result.report.checks.flatMap((check) => check.findings).map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([{ file: 'page.html', line: 2 }]);
});

test('a nosemgrep comment is reported even with a reason', async () => {
    await using sandbox = await testdir();
    const path = 'source.ts';
    const source = '// nosemgrep: example.rule -- The external interface requires this call.\nconst value = 1;\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText(['typescript', 'security'], { level: 'all' }),
        [path]: source,
    });
    const failed = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ['gspot/suppressions'] }));
    expect(failed.report.exitCode).toBe(1);
    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: path, line: 1, rule: 'semgrep' },
    ]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(source);
    const corrected = 'const value = 1;\n';
    await Bun.write(join(sandbox.path, path), corrected);
    const passed = await executeRun(await openSession(sandbox.path), buildRunOptions({ only: ['gspot/suppressions'] }));
    expect(passed.report.exitCode).toBe(0);
    expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
    expect(await Bun.file(join(sandbox.path, path)).text()).toBe(corrected);
});

test("noqa in a SQL file is sqlfluff's; noqa in a Python file is ruff's", async () => {
    await using directory = await testdir();
    await createFileTree(directory.path, {
        'gspot.toml': 'level = "all"\nconfigurations = ["structure", "sql", "python"]\n[rules]\nenabled = false\n',
        'query.sql': 'SELECT 1; -- noqa: LT01\n',
        'entry.py': 'answer = 1  # noqa: F841\n',
    });
    const result = await checkReport(directory.path, ['check', '--only', 'gspot/suppressions', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const report = result.report;
    expect(report.checks[0]!.findings).toStrictEqual(
        containingAll([
            containing({ file: 'query.sql', rule: 'sqlfluff-no-reason' }),
            containing({ file: 'entry.py', rule: 'ruff-no-reason' }),
        ]),
    );
    expect(report.checks[0]!.findings).toHaveLength(2);
});

test.each(['swiftformat:disable blockComments', 'periphery:ignore'])(
    'suppression reason table (two Swift rows)',
    async (directive) => {
        await using sandbox = await testdir();
        const source = `// ${directive}\npublic let value = 1\n`;
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['swift'], { level: 'all' }),
            'Value.swift': source,
        });
        const command = ['check', '--only', 'gspot/suppressions', '--json'];
        const failed = await checkReport(sandbox.path, command);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.report.checks).toMatchObject([
            { status: 'failed', findings: [{ file: 'Value.swift', line: 1 }] },
        ]);
        const correction = source.replace(
            `// ${directive}`,
            `// ${directive} - The external declaration retains its layout.`,
        );
        await Bun.write(join(sandbox.path, 'Value.swift'), correction);
        const passed = await checkReport(sandbox.path, command);
        expect(passed.code, passed.stdout + passed.stderr).toBe(0);
        expect(passed.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
        expect(await Bun.file(join(sandbox.path, 'Value.swift')).text()).toBe(correction);
    },
);

test.each(SUPPRESSION_REASONS)(
    'the %s suppression pattern of %s finds the comment and its reason',
    (configuration, tool, bare, explained, expected) => {
        const definition = configurationManifests()
            .get(configuration)!
            .tools.find(({ name }) => name === tool)!.suppression!;
        const marker = new RegExp(definition.marker, 'u');
        const reason = new RegExp(definition.reason, 'u');
        expect(marker.test(bare)).toBe(true);
        expect(marker.test(explained)).toBe(true);
        expect(reason.exec(bare)?.groups?.['reason']).toBeUndefined();
        expect(reason.exec(explained)?.groups?.['reason']).toBe(expected);
    },
);

for (const entry of SUPPRESSION_CASES) {
    test(entry.check + ' reports ' + entry.expected.rule + ' and passes after the fix', async () => {
        await using sandbox = await createSandbox(BASH_REPOSITORY);
        await runCheckSample(sandbox, entry, BASH_REPOSITORY);
    });
}
