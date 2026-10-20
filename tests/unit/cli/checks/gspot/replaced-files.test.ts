import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { readGitOutput } from '#tests/setup/git.ts';
import { checkReport } from '#tests/setup/run-gspot.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';

test.each([
    ['recommended', []],
    [
        'all',
        [
            {
                file: '.commitlintrc.json',
                rule: 'replaced-file',
                message:
                    'gspot writes the settings for commitlint, so .commitlintrc.json no longer applies. Delete it, and move any rule you need into gspot.toml.',
            },
        ],
    ],
] as const)(
    'gspot/replaced-files at level %s reports the settings file of each tool gspot runs',
    async (level, expected) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSettingsText(['commits'], { level }),
            '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
        });
        readGitOutput(sandbox.path, ['init', '-q']);
        const { report } = await checkReport(sandbox.path, ['check', '--only', 'gspot/replaced-files', '--json']);
        expect(
            report.checks.flatMap(({ findings }) =>
                findings.map(({ file, rule, message }) => ({ file, rule, message })),
            ),
        ).toStrictEqual([...expected]);
    },
);

test('gspot/replaced-files reports a settings file at a project root, and no source file that shares its name', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'knip.json': '{}\n',
        'main.js': 'export const value = 1;\n',
        'src/tools/knip.js': 'export const knip = 1;\n',
    });
    readGitOutput(sandbox.path, ['init', '-q']);
    const { report } = await checkReport(sandbox.path, ['check', '--only', 'gspot/replaced-files', '--json']);
    expect(report.checks.flatMap(({ findings }) => findings.map(({ file }) => file))).toStrictEqual(['knip.json']);
});
