import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runBashSamples } from '#tests/setup/fixes.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { NODE_EMBEDS, INLINE_SCRIPT_CASES } from '#tests/config/bash/inline-scripts.ts';

runBashSamples(INLINE_SCRIPT_CASES);

test.each([...NODE_EMBEDS])('inline Node (%s) is reported once, by bash/inline-scripts', async (source) => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['bash'], { level: 'all' }),
        'source.sh': source,
    });
    const result = await checkReport(sandbox.path, [
        'check',
        '--only',
        'bash/wrappers',
        'bash/inline-scripts',
        '--json',
    ]);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    expect(result.report.checks.find(({ check }) => check === 'bash/wrappers')).toMatchObject({
        status: 'passed',
        findings: [],
    });
    expect(result.report.checks.find(({ check }) => check === 'bash/inline-scripts')?.findings).toMatchObject([
        { file: 'source.sh', line: 1, rule: 'runtime-embed' },
    ]);
    expect(result.report.checks.flatMap(({ findings }) => findings)).toHaveLength(1);
});
