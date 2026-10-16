import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { openSession } from '#cli/commands/session.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { buildManifest } from '#tests/setup/manifest.ts';
import { SELECTOR_FILES } from '#tests/config/eslint/framework.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { SELECTOR_GROUP_CASES } from '#tests/config/eslint/selectors.ts';
import { fragmentSelectorGroups } from '#cli/generation/eslint/selectors.ts';
import { ESLINT_OVERRIDES_SETTINGS } from '#tests/config/eslint/overrides.ts';

test('an ignore of an ESLint rule applies after your rule options', async () => {
    await using directory = await testdir();
    const settings = settingsText(['javascript'], {
        level: 'all',
        tables: '[tools.eslint.rules]\n"no-console" = [{allow = ["warn"]}]\n',
    });
    await createFileTree(directory.path, {
        'gspot.toml': settings,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'console.log("example");\n',
    });
    for (const ignored of [false, true]) {
        await writeFile(
            join(directory.path, 'gspot.toml'),
            settings +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "This sandbox accepts the native console finding."\n'
                    : ''),
        );
        const eslint = await createEslint(directory.path);
        expect(await lintFindings(eslint, directory.path, ['source.js'], ['no-console'])).toStrictEqual(
            ignored ? [] : [{ file: 'source.js', rule: 'no-console', line: 1 }],
        );
    }
});

test('ESLint override blocks keep their order, nested scope limits, later files and path ignores', async () => {
    await using directory = await testdir();
    const source = 'export const matches = (value) => value == null;\n';
    await createFileTree(directory.path, {
        'gspot.toml': ESLINT_OVERRIDES_SETTINGS,
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': source,
        'tests/unit.js': source,
        'tests/exempt.js': source,
        'apps/web/page.js': source,
        'apps/web/exempt.js': source,
        'apps/web/admin/page.js': source,
    });
    for (const ignored of [false, true]) {
        await writeFile(
            join(directory.path, 'gspot.toml'),
            ESLINT_OVERRIDES_SETTINGS +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\npaths = ["tests"]\nreason = "These authored tests intentionally exercise native equality."\n'
                    : ''),
        );
        const eslint = await createEslint(directory.path);
        await writeFile(join(directory.path, 'tests/future.js'), source);
        const files = ['source.js', 'tests', 'apps'];
        const output = await lintFindings(eslint, directory.path, files, ['eqeqeq']);
        const results = await eslint.lintFiles(files);
        await unlink(join(directory.path, 'tests/future.js'));
        const expected = [
            { file: 'apps/web/admin/page.js', rule: 'eqeqeq', line: 1 },
            { file: 'apps/web/exempt.js', rule: 'eqeqeq', line: 1 },
            ...(ignored
                ? []
                : [
                      { file: 'tests/future.js', rule: 'eqeqeq', line: 1 },
                      { file: 'tests/unit.js', rule: 'eqeqeq', line: 1 },
                  ]),
        ];
        expect(output).toStrictEqual(expected);
        expect(
            results.flatMap(({ messages }) =>
                messages.filter(({ ruleId }) => ruleId === 'eqeqeq').map(({ severity }) => severity),
            ),
        ).toStrictEqual(expected.map(() => 2));
    }
});

test.each([...LEVELS])(
    'React Native and react-hook-form syntax selectors report only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...SELECTOR_FILES,
            'gspot.toml': `level = "${level}"\nconfigurations = ["javascript"]\n[[scope]]\npath = "native"\nconfigurations = ["react-native"]\n[[scope]]\npath = "forms"\nconfigurations = ["react", "react-hook-form"]\n`,
        });
        const eslint = await createEslint(sandbox.path);
        expect(
            await lintFindings(eslint, sandbox.path, ['native/App.jsx', 'forms/Fields.jsx'], ['no-restricted-syntax']),
        ).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'forms/Fields.jsx', rule: 'no-restricted-syntax', line: 3 },
                      { file: 'native/App.jsx', rule: 'no-restricted-syntax', line: 2 },
                  ]
                : [],
        );
    },
);

test.each(SELECTOR_GROUP_CASES)('generated selector blocks: $name', async ({ selectors, expected }) => {
    await using sandbox = await testdir({ 'gspot.toml': settingsText(['javascript'], { level: 'all' }) });
    const session = await openSession(sandbox.path);
    const declaration = buildManifest('synthetic', { tables: stringify({ eslint: { selectors } }) });
    const groups = fragmentSelectorGroups(
        [{ ...session.scopes[0]!, selected: [{ ...declaration, tools: [] }] }],
        true,
        'none',
    );
    const selected = new Set<string>(selectors.map((entry) => entry.selector));
    expect(
        groups.map(({ scope: _scope, ignoredScopes: _ignoredScopes, ...group }) => ({
            ...group,
            selectors: group.selectors.filter((entry) => selected.has(entry.selector)),
        })),
    ).toStrictEqual(expected);
});
