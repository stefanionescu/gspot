import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { REPLACED_FILE_CASES } from '#tests/data/checks/gspot/replaced-files.ts';

test.each([...REPLACED_FILE_CASES])(
    'gspot/replaced-files at level %s reports the settings file of each tool gspot runs',
    async (level, expected) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['commits'], { level }),
            '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
        });
        runGitStep(sandbox.path, ['init', '-q']);
        const findings = await runSandboxCheck(sandbox.path, 'gspot/replaced-files');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([...expected]);
    },
);

test('gspot/replaced-files reports a settings file at a project root, and no source file that shares its name', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'knip.json': '{}\n',
        'main.js': 'export const value = 1;\n',
        'src/tools/knip.js': 'export const knip = 1;\n',
    });
    runGitStep(sandbox.path, ['init', '-q']);
    const findings = await runSandboxCheck(sandbox.path, 'gspot/replaced-files');
    expect(findings.map(({ file }) => file)).toStrictEqual(['knip.json']);
});
