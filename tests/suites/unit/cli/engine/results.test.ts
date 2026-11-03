import { test, expect } from 'bun:test';
import { openSession } from '#cli/engine/session.ts';
import { buildCheckSession } from '#cli/engine/run.ts';
import { planSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { CHECK_GENERATION, CHECK_RUN_OPTIONS } from '#tests/setup/cli/run.ts';
import { runBuiltInCheck, mergeCheckResults } from '#cli/engine/results.ts';

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
        CHECK_RUN_OPTIONS,
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
