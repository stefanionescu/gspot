import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { unlink, writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { SELECTOR_FILES } from '#tests/config/eslint/framework.ts';
import { selectorGroups } from '#cli/generation/eslint/selectors.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { ESLINT_OVERRIDES_SETTINGS } from '#tests/config/eslint/overrides.ts';
import { STORE, RAW_SQL, INJECTED, PROCEDURE } from '#tests/config/eslint/selectors.ts';

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

test('general selectors form one group for every code file, in first-mention order', () => {
    expect(selectorGroups([STORE, PROCEDURE])).toStrictEqual([{ selectors: [STORE, PROCEDURE] }]);
});

test('an allowed path set gets its own group without the selector that allows it', () => {
    const groups = selectorGroups([STORE, { ...RAW_SQL, except: ['db/migrations/**'] }]);
    expect(groups).toStrictEqual([
        { files: [['db/migrations/**']], selectors: [STORE] },
        { ignores: ['db/migrations/**'], selectors: [STORE, RAW_SQL] },
    ]);
});

test('a selector with files applies there together with the general ones', () => {
    const controllers = ['**/*.controller.ts'];
    const routers = ['**/routers/**/*.ts'];
    const groups = selectorGroups([
        STORE,
        { ...INJECTED, files: controllers },
        { ...PROCEDURE, files: routers },
        { ...RAW_SQL, files: controllers },
    ]);
    expect(groups).toStrictEqual([
        { files: [['**/*.controller.ts', '**/routers/**/*.ts']], selectors: [STORE, INJECTED, PROCEDURE, RAW_SQL] },
        { files: [['**/*.controller.ts']], ignores: routers, selectors: [STORE, INJECTED, RAW_SQL] },
        { files: [['**/routers/**/*.ts']], ignores: controllers, selectors: [STORE, PROCEDURE] },
        { ignores: [...controllers, ...routers], selectors: [STORE] },
    ]);
});

test('an empty allowed list adds no group', () => {
    expect(selectorGroups([{ ...RAW_SQL, except: [] }])).toStrictEqual([{ selectors: [RAW_SQL] }]);
});
