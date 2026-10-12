import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { textContaining } from '#tests/setup/matchers.ts';
import { UNUSED_NAME_CASES, MISMATCHED_SETTINGS, ALLOWED_NAME_SETTINGS } from '#tests/config/naming/settings.ts';

const command = ['check', '--only', 'naming/settings', '--json'];

test.each([...UNUSED_NAME_CASES])('$name', async ({ files, settings, unusedNames }) => {
    await using sandbox = await testdir();
    const text = stringify({ level: 'all', ...settings });
    await createFileTree(sandbox.path, { ...files, 'gspot.toml': text });
    const result = await checkReport(sandbox.path, command);
    expect(result.code, result.stdout + result.stderr).toBe(1);
    const findings = result.report.checks.flatMap(({ findings }) => findings);
    expect(findings).toHaveLength(unusedNames.length);
    for (const [index, name] of unusedNames.entries()) {
        expect(findings[index]).toMatchObject({
            file: 'gspot.toml',
            rule: 'unused-entry',
            message: textContaining(`"${name}"`),
        });
    }
});

test('allowed_names that no identifier in the override paths uses are reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': ALLOWED_NAME_SETTINGS,
        'entry.sh': 'echo ready\n',
        'web/source.js': 'export const remoteRecord = 1;\n',
        'worker/source.py': 'remote_record = 1\n',
    });
    const accepted = await checkReport(sandbox.path, command);
    expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
    await Bun.write(join(sandbox.path, 'gspot.toml'), MISMATCHED_SETTINGS);
    const mismatched = await checkReport(sandbox.path, command);
    expect(mismatched.code, mismatched.stdout + mismatched.stderr).toBe(1);
    expect(mismatched.report.checks.flatMap(({ findings }) => findings)).toMatchObject([
        { file: 'gspot.toml', rule: 'unused-entry', message: textContaining('allowed_names includes "remoteRecord"') },
    ]);
    await Bun.write(join(sandbox.path, 'gspot.toml'), ALLOWED_NAME_SETTINGS);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const localRecord = 1;\n');
    const unused = await checkReport(sandbox.path, command);
    expect(unused.code, unused.stdout + unused.stderr).toBe(1);
    expect(unused.report.checks.flatMap(({ findings }) => findings)).toHaveLength(2);
    await Bun.write(join(sandbox.path, 'web/source.js'), 'export const remoteRecord = 1;\n');
    const corrected = await checkReport(sandbox.path, command);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(corrected.report.checks).toMatchObject([{ check: 'naming/settings', status: 'passed', findings: [] }]);
});
