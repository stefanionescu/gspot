import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { runChecks } from '#cli/commands/check/run.ts';
import { openSession } from '#cli/planning/session.ts';
import { buildRunOptions } from '#tests/setup/cli/runs.ts';
import { COMPILER_SOURCE } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

import {
    SUPPRESSION_HELP,
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

        expect(missing.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
            paths.toSorted(compareText).map((file) => ({
                check: 'gspot/suppressions',
                file,
                line: 1,
                rule: 'tsc-no-reason',
                message: 'This tsc suppression has no reason of two or more words.',
                fixable: false,
                help: SUPPRESSION_HELP,
            })),
        );
        for (const [index, directive] of TYPESCRIPT_SUPPRESSIONS.entries())
            await writeFile(
                join(sandbox.path, paths[index]!),
                `// @ts-${directive}: A separate sandbox checks the external declaration.\n${COMPILER_SOURCE}`,
            );
        const reasoned = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );
        expect(reasoned.report.failed).toStrictEqual([]);
    },
);

test.each([...SUPPRESSION_REASON_CASES])('$name', async ({ path, source, findings }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'bash'], { level: 'all', rules: true }),
        [path]: source,
    });
    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
    expect(result.report.checks.map(({ status }) => status)).toStrictEqual([
        findings.length === 0 ? 'passed' : 'failed',
    ]);
    expect(result.report.checks.flatMap(({ findings }) => findings)).toStrictEqual(
        findings.map((finding) => ({
            ...finding,
            check: 'gspot/suppressions',
            file: path,
            fixable: false,
            help: SUPPRESSION_HELP,
        })),
    );
});

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

    expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
        {
            check: 'gspot/suppressions',
            file: path,
            line: 1,
            rule: 'semgrep',
            fixable: false,
            message: 'semgrep suppression is not allowed; fix the finding or configure an explicit ignore.',
            help: SUPPRESSION_HELP,
        },
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

    expect(result.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
        {
            check: 'gspot/suppressions',
            file: 'entry.py',
            rule: 'ruff-no-reason',
            line: 1,
            fixable: false,
            message: 'This ruff suppression has no reason of two or more words.',
            help: SUPPRESSION_HELP,
        },
        {
            check: 'gspot/suppressions',
            file: 'query.sql',
            rule: 'sqlfluff-no-reason',
            line: 1,
            fixable: false,
            message: 'This sqlfluff suppression has no reason of two or more words.',
            help: SUPPRESSION_HELP,
        },
    ]);
});

test.each([...SWIFT_REASON_CASES])(
    'the Swift suppression $directive needs a reason and passes with one',
    async ({ tool, directive, rule }) => {
        const source = `// ${directive}\npublic let value = 1\n`;
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': source,
        });

        const failed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );

        expect(failed.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
            {
                check: 'gspot/suppressions',
                file: 'Value.swift',
                line: 1,
                rule,
                fixable: false,
                message: `This ${tool} suppression has no reason of two or more words.`,
                help: SUPPRESSION_HELP,
            },
        ]);
        const correction = source.replace(
            `// ${directive}`,
            () => `// ${directive} - The external declaration retains its layout.`,
        );
        await writeFile(join(sandbox.path, 'Value.swift'), correction);
        const passed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );

        expect(passed.report.checks).toMatchObject([{ status: 'passed', findings: [] }]);
    },
);

test.each([...SUPPRESSION_REASONS])(
    'a $tool suppression needs a reason and passes with one',
    async ({ configuration, tool, file, bare, explained, rule }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
            [file]: `${bare}\n${explained}\n`,
        });
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );
        expect(result.report.checks.flatMap(({ findings }) => findings)).toStrictEqual([
            {
                check: 'gspot/suppressions',
                file,
                line: 1,
                rule,
                fixable: false,
                message: `This ${tool} suppression has no reason of two or more words.`,
                help: SUPPRESSION_HELP,
            },
        ]);
    },
);
