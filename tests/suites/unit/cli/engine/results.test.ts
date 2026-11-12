import { expect, test } from 'bun:test';

import { selectCheckCode } from '#cli/configurations/registry.ts';
import { formatExplainCommand, mergeCheckResults, restoreCommandPaths, runBuiltInCheck } from '#cli/engine/results.ts';
import { buildCheckSession } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import { CHECK_GENERATION } from '#cli/generation/checks.ts';
import type { CheckResult } from '#cli/types/engine/run.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('the built-in dispatcher attaches the check ID, fixability, and default help to sparse findings', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['naming'], { level: 'all' }),
        'source.js': 'export const source = 1;\n',
    });
    const session = await openSession(sandbox.path);
    const planned = planSandboxCheck(session, 'naming/identifiers');
    const result = await runBuiltInCheck(
        () => [
            { file: 'source.js', rule: 'name', message: 'Choose a descriptive name.' },
            { file: 'source.js', rule: 'name', message: 'Choose another name.', help: 'Use the project vocabulary.' },
        ],
        buildCheckSession(session, CHECK_GENERATION),
        { ...planned, check: { ...planned.check, help: 'Rename this identifier.' } },
        {},
    );
    expect(result.status).toBe('failed');
    expect(result.findings).toStrictEqual([
        {
            check: 'naming/identifiers',
            fixable: false,
            file: 'source.js',
            rule: 'name',
            message: 'Choose a descriptive name.',
            help: 'Rename this identifier.',
        },
        {
            check: 'naming/identifiers',
            fixable: false,
            file: 'source.js',
            rule: 'name',
            message: 'Choose another name.',
            help: 'Use the project vocabulary.',
        },
    ]);
});

test.each([
    ['bash/shellcheck', 'SC2086', 'gspot explain bash/shellcheck SC2086'],
    ['repository/encoding', 'path-encoding', 'gspot explain repository/encoding path-encoding'],
    ['repository/encoding', 'unlisted', 'gspot explain repository/encoding'],
    ['typescript/tsc', 'TS2322', 'gspot explain typescript/tsc'],
    ['javascript/eslint', 'no-var', 'gspot explain javascript/eslint no-var'],
    ['javascript/eslint', 'import-lite/no-default-export', 'gspot explain javascript/eslint'],
    ['css/stylelint', 'CssSyntaxError', 'gspot explain css/stylelint'],
    ['prose/vale', 'Vale.Repetition', 'gspot explain prose/vale'],
    ['javascript/biome', 'parse', 'gspot explain javascript/biome'],
] as const)(
    'the explain command of %s for %s names the rule only when the check has it listed',
    (check, rule, command) => {
        expect(formatExplainCommand({ check, rule }, selectCheckCode)).toBe(command);
    },
);

test('a result from a copy names repository paths in its command and its note', () => {
    const base: CheckResult = {
        check: 'typescript/tsc',
        scope: '',
        status: 'error',
        fileCount: 0,
        duration: 0,
        findings: [],
    };
    const restored = restoreCommandPaths(
        { ...base, command: ['/copy/bin/tsc', '/copy/tsconfig.json'], note: 'Stopped at /copy/a.ts and /copy/b.ts.' },
        '/copy',
        '/repository',
    );
    expect(restored).toStrictEqual({
        ...base,
        command: ['/repository/bin/tsc', '/repository/tsconfig.json'],
        note: 'Stopped at /repository/a.ts and /repository/b.ts.',
    });
    expect(restoreCommandPaths(base, '/copy', '/repository')).toStrictEqual(base);
});

test('merged runs that overlap report the wall time from the first start to the last end', () => {
    const base = {
        check: 'commits/commitlint-pushed',
        scope: '',
        status: 'passed',
        fileCount: 0,
        duration: 0,
        findings: [],
    } as const;
    const first = { ...base, duration: 1000, span: { start: 100, end: 1100 } };
    const second = { ...base, duration: 1500, span: { start: 300, end: 1800 } };
    const merged = mergeCheckResults(mergeCheckResults(base, first), second);
    expect(merged.duration).toBe(1700);
    expect(merged.span).toStrictEqual({ start: 100, end: 1800 });
});
