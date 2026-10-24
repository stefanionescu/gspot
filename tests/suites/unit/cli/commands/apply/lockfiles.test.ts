import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGitStep } from '#tests/setup/system/git.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runGspot, parseCheckReport } from '#tests/setup/cli/commands.ts';

test('a lockfile-only dry run names install as the repair', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'source.js': 'export {};\n',
    });
    runGitStep(sandbox.path, ['init', '-q']);
    const applied = await runGspot(sandbox.path, ['apply']);
    expect(applied.code).toBe(0);
    const preview = await runGspot(sandbox.path, ['apply', '--dry-run']);
    expect(preview.stdout).toContain('Run gspot install to write the tool lockfiles.');
    expect(preview.stdout).not.toContain('Run gspot apply to write these files.');
    const checked = parseCheckReport(
        await runGspot(sandbox.path, ['check', '--only', 'gspot/generated-files', '--json']),
    );
    expect(
        checked.report.checks
            .flatMap(({ findings }) => findings)
            .filter(({ file }) => /\.gspot\/.*lock/u.test(file))
            .every(({ help }) => help?.includes('gspot install') === true),
    ).toBe(true);
});
