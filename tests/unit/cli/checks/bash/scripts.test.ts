import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import type { Sandbox } from '#tests/types/sandbox.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { commitAll, markExecutable } from '#tests/setup/git.ts';
import { runBashSample, expectedSummary, summarizeSample, registerBashSandbox } from '#tests/setup/sample-checks.ts';

import {
    DOC_COMMENT_CASES,
    SINGLE_CALL_CASES,
    UNREAD_ARGUMENT_CASES,
    UNUSED_FUNCTION_CASES,
} from '#tests/data/checks/bash/function-checks.ts';
import {
    NODE_EMBEDS,
    SAFETY_SOURCES,
    BASH_SAFETY_CASES,
    SCOPE_READER_FILES,
    INLINE_SCRIPT_CASES,
    SCRIPT_LAYOUT_CASES,
    RIGHT_CLEANUP_SOURCE,
    WRONG_CLEANUP_SOURCE,
    SCOPE_READER_SETTINGS,
} from '#tests/data/checks/bash/script-checks.ts';

test.each([...NODE_EMBEDS])(
    'inline-scripts: inline Node (%s) is reported once, by bash/inline-scripts',
    async (source) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['bash'], { level: 'all' }),
            'source.sh': source,
        });
        const result = await checkReport(sandbox.path, [
            'check',
            '--only',
            'bash/forwarders',
            'bash/inline-scripts',
            '--json',
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(1);
        expect(result.report.checks.find(({ check }) => check === 'bash/forwarders')).toMatchObject({
            status: 'passed',
            findings: [],
        });
        expect(result.report.checks.find(({ check }) => check === 'bash/inline-scripts')?.findings).toMatchObject([
            { file: 'source.sh', line: 1, rule: 'runtime-embed' },
        ]);
        expect(result.report.checks.flatMap(({ findings }) => findings)).toHaveLength(1);
    },
);
test.each([...SAFETY_SOURCES])(
    'safety: a trap that removes its own temporary file is allowed and other recursive removals are reported: $source',
    async ({ source, unsafeLines }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['bash']),
            'source.sh': '#!/usr/bin/env bash\nset -euo pipefail\n' + source,
        });
        const result = await checkReport(sandbox.path, ['check', '--only', 'bash/safety', '--json']);
        expect(result.code, result.stdout + result.stderr).toBe(unsafeLines.length === 0 ? 0 : 1);
        expect(result.report.checks[0]?.findings.map(({ file, line, rule }) => ({ file, line, rule }))).toStrictEqual(
            unsafeLines.map((line) => ({ file: 'source.sh', line, rule: 'recursive-remove' })),
        );
    },
);

test('safety: the Bash contract and safety agree on the specific temporary path that a trap removes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['bash'], { level: 'all' }),
        'source.sh': WRONG_CLEANUP_SOURCE,
    });
    commitAll(sandbox.path);
    await markExecutable(sandbox.path, 'source.sh');
    const command = ['check', '--only', 'bash/script-layout', 'bash/safety', '--json'];
    const wrong = await checkReport(sandbox.path, command);
    expect(wrong.code, wrong.stdout + wrong.stderr).toBe(1);
    expect(
        wrong.report.checks.flatMap(({ findings }) => findings.map(({ rule, line }) => ({ rule, line }))),
    ).toStrictEqual([
        { rule: 'mktemp-trap', line: 3 },
        { rule: 'recursive-remove', line: 4 },
    ]);
    await Bun.write(join(sandbox.path, 'source.sh'), RIGHT_CLEANUP_SOURCE);
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks.map(({ status, findings }) => ({ status, findings }))).toStrictEqual([
        { status: 'passed', findings: [] },
        { status: 'passed', findings: [] },
    ]);
});
test('script-layout: script-layout permits top-level commands in an environment reader declared only by its scope', async () => {
    await using sandbox = await testdir({
        ...SCOPE_READER_FILES,
        'gspot.toml': buildSettingsText(['bash'], { level: 'all', tables: SCOPE_READER_SETTINGS }),
    });
    expect(await checkFindings(sandbox.path, 'bash/script-layout', { scope: 'tools' })).toStrictEqual([]);
});

let bashSandbox: Sandbox;
registerBashSandbox((sandbox) => {
    bashSandbox = sandbox;
});
test.each([
    ...DOC_COMMENT_CASES,
    ...INLINE_SCRIPT_CASES,
    ...BASH_SAFETY_CASES,
    ...SCRIPT_LAYOUT_CASES,
    ...UNREAD_ARGUMENT_CASES,
    ...UNUSED_FUNCTION_CASES,
    ...SINGLE_CALL_CASES,
])('$check reports $expected.rule and passes after the fix', async (entry) => {
    const result = await runBashSample(bashSandbox, entry);
    expect(summarizeSample(result)).toStrictEqual(expectedSummary(entry));
});
