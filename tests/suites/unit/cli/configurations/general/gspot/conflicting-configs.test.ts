import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { CONFLICTING_CONFIG_CASES } from '#tests/config/checks/general/gspot/gspot.ts';

test.each([...CONFLICTING_CONFIG_CASES])(
    'gspot/conflicting-configs at level %s reports the settings file of each tool gspot runs',
    async (level, expected) => {
        await using sandbox = await createGitSandbox({
            'gspot.toml': buildSandboxSettings(['commits'], { level }),
            '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
        });
        const findings = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
        expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([...expected]);
    },
);

test('gspot/conflicting-configs reports a settings file at a project root, and no source file that shares its name', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'knip.json': '{}\n',
        'main.js': 'export const value = 1;\n',
        'src/tools/knip.js': 'export const knip = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
    expect(findings.map(({ file }) => file)).toStrictEqual(['knip.json']);
});

test('a conflicting config file that .gitattributes marks linguist-generated is not reported', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['commits'], { level: 'all' }),
        '.gitattributes': '.commitlintrc.json linguist-generated\n',
        '.commitlintrc.json': '{"extends":["@commitlint/config-conventional"]}\n',
    });
    expect(await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs')).toStrictEqual([]);
    await writeFile(join(sandbox.path, '.gitattributes'), '');
    const conflicts = await runSandboxCheck(sandbox.path, 'gspot/conflicting-configs');
    expect(
        conflicts.map(({ file, rule }) => ({
            file,
            rule,
        })),
    ).toStrictEqual([{ file: '.commitlintrc.json', rule: 'conflicting-config' }]);
});
