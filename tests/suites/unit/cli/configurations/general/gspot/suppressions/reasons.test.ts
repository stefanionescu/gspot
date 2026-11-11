import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { createFileTree } from 'testdirs';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { compareText } from '#cli/system/text.ts';
import {
    SUPPRESSION_REASON_CASES,
    SUPPRESSION_REASONS,
    SWIFT_REASON_CASES,
    TYPESCRIPT_SUPPRESSIONS,
} from '#tests/config/configurations/gspot/suppressions.ts';
import { COMPILER_SOURCE } from '#tests/config/setup/languages.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('@ts-ignore, @ts-expect-error and @ts-nocheck need a reason; the same text in a string is not a comment', async () => {
    await using sandbox = await createGitSandbox({});
    const paths = TYPESCRIPT_SUPPRESSIONS.map((directive) => `${directive}.ts`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['typescript']),
        ...Object.fromEntries(
            TYPESCRIPT_SUPPRESSIONS.map((directive, index) => [
                paths[index]!,
                `// @ts-${directive}\n${COMPILER_SOURCE}`,
            ]),
        ),
        [`string.ts`]: 'export const example = "// @ts-ignore";\n',
    });
    const missing = await runChecks(await openSession(sandbox.path), buildRunOptions({ only: ['gspot/suppressions'] }));

    expect(
        missing.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })),
    ).toStrictEqual(
        paths.toSorted(compareText).map((file) => ({
            check: 'gspot/suppressions',
            file,
            line: 1,
            rule: 'tsc-no-reason',
            message: expect.any(String) as string,
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
});

test.each([...SUPPRESSION_REASON_CASES])('$name', async ({ path, source, findings }) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'bash'], { level: 'all', rules: true }),
        [path]: source,
    });
    const session = await openSession(sandbox.path);
    const result = await runChecks(session, buildRunOptions({ stage: 'commit', only: ['gspot/suppressions'] }));
    expect(result.report.checks.map(({ status }) => status)).toStrictEqual([
        findings.length === 0 ? 'passed' : 'failed',
    ]);
    expect(
        result.report.checks
            .flatMap(({ findings }) => findings)
            .map(({ check, file, line, rule }) => ({ check, file, line, rule })),
    ).toStrictEqual(
        findings.map((finding) => ({
            ...finding,
            check: 'gspot/suppressions',
            file: path,
        })),
    );
});

test.each(['-->', '--!>'])('an HTML suppression that ends with %s still needs a reason', async (ending) => {
    await using sandbox = await createGitSandbox({
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
    const path = 'source.ts';
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript', 'security'], { level: 'all' }),
        [path]: '// nosemgrep: example.rule -- The external interface requires this call.\nconst value = 1;\n',
    });
    const failed = await runSandboxCheck(sandbox.path, 'gspot/suppressions');

    expect(
        failed.map(({ check, file, line, rule, message, help }) => ({ check, file, line, rule, message, help })),
    ).toStrictEqual([
        {
            check: 'gspot/suppressions',
            file: path,
            line: 1,
            rule: 'semgrep',
            message: expect.any(String) as string,
            help: 'Remove the suppression and fix the finding. gspot accepts no suppression comment of this tool, with or without a reason.',
        },
    ]);
    await writeFile(join(sandbox.path, path), 'const value = 1;\n');

    expect(await runSandboxCheck(sandbox.path, 'gspot/suppressions')).toStrictEqual([]);
});

test.each([...SWIFT_REASON_CASES])(
    'the Swift suppression $directive needs a reason and passes with one',
    async ({ directive, rule }) => {
        const source = `// ${directive}\npublic let value = 1\n`;
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['swift'], { level: 'all' }),
            'Value.swift': source,
        });

        const failed = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );

        expect(
            failed.report.checks
                .flatMap(({ findings }) => findings)
                .map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })),
        ).toStrictEqual([
            {
                check: 'gspot/suppressions',
                file: 'Value.swift',
                line: 1,
                rule,
                message: expect.any(String) as string,
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
    async ({ configuration, file, bare, explained, rule }) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings([configuration], { level: 'all' }),
            [file]: `${bare}\n${explained}\n`,
        });
        const result = await runChecks(
            await openSession(sandbox.path),
            buildRunOptions({ only: ['gspot/suppressions'] }),
        );
        expect(
            result.report.checks
                .flatMap(({ findings }) => findings)
                .map(({ check, file, line, rule, message }) => ({ check, file, line, rule, message })),
        ).toStrictEqual([
            {
                check: 'gspot/suppressions',
                file,
                line: 1,
                rule,
                message: expect.any(String) as string,
            },
        ]);
    },
);

test.each([
    ['vitest', 'source.js', '/* v8 ignore next */\nexport const a = 1;\n', 'vitest-no-reason'],
    ['jest', 'source.js', '/* istanbul ignore next */\nexport const a = 1;\n', 'jest-no-reason'],
    ['svelte', 'Form.svelte', '<!-- svelte-ignore a11y_autofocus -->\n<input autofocus />\n', 'svelte-check-no-reason'],
])('a %s suppression in %s needs a reason', async (configuration, path, source, rule) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([configuration]),
        [path]: source,
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map((finding) => finding.rule)).toStrictEqual([rule]);
});

test.each([
    [
        'vitest',
        'source.js',
        '/* v8 ignore next -- reason: only a full disk reaches this branch */\nexport const a = 1;\n',
    ],
    ['jest', 'source.js', '/* istanbul ignore next: only a full disk reaches this branch */\nexport const a = 1;\n'],
    [
        'svelte',
        'Form.svelte',
        '<!-- svelte-ignore a11y_autofocus - reason: the dialog opens with the search field in focus -->\n<input autofocus />\n',
    ],
])('a %s suppression in %s with a reason passes', async (configuration, path, source) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([configuration]),
        [path]: source,
    });
    expect(await runSandboxCheck(sandbox.path, 'gspot/suppressions')).toStrictEqual([]);
});

test('a reason in a suppression or in gspot.toml that a reader cannot look up is reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            ignore: { checks: ['javascript/eslint'], reason: 'Step 3.1 of the plan keeps this.' },
        }),
        'source.ts':
            '// eslint-disable-next-line no-console -- Read /Users/ada/notes.md for the reason.\nconsole.log(1);\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/suppressions');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'source.ts', rule: 'home-path' },
        { file: 'gspot.toml', rule: 'plan-step' },
    ]);
});
