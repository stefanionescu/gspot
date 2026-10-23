import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { COMPILER_SOURCE } from '#tests/config/checks/language/typescript.ts';

import {
    COMPILER_REASON,
    SWIFT_REASON_CASES,
    SUPPRESSION_REASONS,
    TYPESCRIPT_SUPPRESSIONS,
    SUPPRESSION_REASON_CASES,
} from '#tests/config/checks/general/gspot/suppressions/reasons.ts';

test.each(['javascript', 'typescript'])(
    '@ts-ignore, @ts-expect-error and @ts-nocheck in %s need a reason; the same text in a string is not a comment',
    async (language) => {
        await using sandbox = await testdir();
        const ending = language === 'javascript' ? 'js' : 'ts';
        const paths = TYPESCRIPT_SUPPRESSIONS.map((directive) => `${directive}.${ending}`);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings([language]),
            ...Object.fromEntries(
                TYPESCRIPT_SUPPRESSIONS.map((directive, index) => [
                    paths[index]!,
                    `// @ts-${directive}\n${COMPILER_SOURCE}`,
                ]),
            ),
            [`control.${ending}`]: COMPILER_SOURCE,
            [`string.${ending}`]: 'export const example = "// @ts-ignore";\n',
        });
        const missing = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );

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
            await writeFile(
                join(sandbox.path, paths[index]!),
                `// @ts-${directive}: ${COMPILER_REASON}\n${COMPILER_SOURCE}`,
            );
        const reasoned = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );
        expect(reasoned.report.failed).toStrictEqual([]);
    },
);

test.each(SUPPRESSION_REASON_CASES)(
    'a suppression in %s needs its reason on the line directly above',
    async (path, source, lines) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript', 'bash'], { level: 'all', rules: true }),
            [path]: source,
        });

        const session = await openSession(sandbox.path);
        const result = await runChecks(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
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

test.each(['-->', '--!>'])('an HTML suppression that ends with %s still needs a reason', async (ending) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['html', 'structure'], { level: 'all', rules: true }),
        'page.html': `<!-- html-validate-disable attr -- External validator owns this attribute. ${ending}\n<!-- html-validate-disable attr ${ending}\n`,
    });

    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));

    expect(
        result.report.checks.flatMap((check) => check.findings).map(({ file, line }) => ({ file, line })),
    ).toStrictEqual([{ file: 'page.html', line: 2 }]);
});

test('a nosemgrep comment is reported even with a reason', async () => {
    await using sandbox = await testdir();
    const path = 'source.ts';
    const source = '// nosemgrep: example.rule -- The external interface requires this call.\nconst value = 1;\n';
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript', 'security'], { level: 'all' }),
        [path]: source,
    });
    const failed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['gspot/suppressions'] }));

    expect(failed.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: path, line: 1, rule: 'semgrep' },
    ]);
    const corrected = 'const value = 1;\n';
    await writeFile(join(sandbox.path, path), corrected);
    const passed = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['gspot/suppressions'] }));

    expect(passed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([]);
});

test('noqa in a SQL file needs a sqlfluff reason and noqa in a Python file needs a Ruff reason', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['structure', 'sql', 'python'], { level: 'all' }),
        'query.sql': 'SELECT 1; -- noqa: LT01\n',
        'entry.py': 'answer = 1  # noqa: F841\n',
    });

    const result = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['gspot/suppressions'] }));

    expect(result.report.checks).toMatchObject([
        {
            findings: [
                { file: 'entry.py', rule: 'ruff-no-reason' },
                { file: 'query.sql', rule: 'sqlfluff-no-reason' },
            ],
        },
    ]);
});

test.each([...SWIFT_REASON_CASES])(
    'the Swift suppression $directive needs a reason and passes with one',
    async ({ directive, rule }) => {
        const source = `// ${directive}\npublic let value = 1\n`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': source,
        });

        const failed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );

        expect(failed.report.checks).toMatchObject([
            { status: 'failed', findings: [{ file: 'Value.swift', line: 1, rule }] },
        ]);
        const correction = source.replace(
            `// ${directive}`,
            `// ${directive} - The external declaration retains its layout.`,
        );
        await writeFile(join(sandbox.path, 'Value.swift'), correction);
        const passed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );

        expect(passed.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);

test.each(SUPPRESSION_REASONS)(
    'the %s suppression pattern of %s finds the comment and its reason',
    (configuration, tool, bare, explained, expected) => {
        const definition = readConfigurations()
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
