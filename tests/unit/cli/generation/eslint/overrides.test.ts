import { join } from 'node:path';
import picomatch from 'picomatch';
import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { stringify } from '@decimalturn/toml-patch';
import { unlink, writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildManifest } from '#tests/setup/builders.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { buildFilePatterns } from '#cli/generation/eslint/files.ts';
import { SELECTOR_FILES } from '#tests/data/generation/eslint/framework.ts';
import { groupFragmentSelectors } from '#cli/generation/eslint/selectors.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { SELECTOR_GROUP_CASES } from '#tests/data/generation/eslint/selectors.ts';

import {
    SCOPE_IMPORT_FILES,
    SCOPE_IMPORT_TABLES,
    ESLINT_OVERRIDES_SETTINGS,
} from '#tests/data/generation/eslint/overrides.ts';

test.each([false, true])(
    'blocks > an ignore of an ESLint rule applies after your rule options (%j)',
    async (ignored) => {
        await using folder = await testdir();
        const settings = buildSettingsText(['javascript'], {
            level: 'all',
            tables: '[tools.eslint.rules]\n"no-console" = [{allow = ["warn"]}]\n',
        });
        await createFileTree(folder.path, {
            'gspot.toml': settings,
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': 'console.log("example");\n',
        });

        await writeFile(
            join(folder.path, 'gspot.toml'),
            settings +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "This sandbox accepts the native console finding."\n'
                    : ''),
        );
        const eslint = await createEslint(folder.path);
        expect(await collectLintFindings(eslint, folder.path, ['source.js'], ['no-console'])).toStrictEqual(
            ignored ? [] : [{ file: 'source.js', rule: 'no-console', line: 1 }],
        );
    },
);

test.each([false, true])(
    'blocks > ESLint override blocks keep their order, nested scope limits, later files and path ignores (%j)',
    async (ignored) => {
        await using folder = await testdir();
        const source = 'export const matches = (value) => value == null;\n';
        await createFileTree(folder.path, {
            'gspot.toml': ESLINT_OVERRIDES_SETTINGS,
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': source,
            'tests/unit.js': source,
            'tests/exempt.js': source,
            'apps/web/page.js': source,
            'apps/web/exempt.js': source,
            'apps/web/admin/page.js': source,
        });

        await writeFile(
            join(folder.path, 'gspot.toml'),
            ESLINT_OVERRIDES_SETTINGS +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\npaths = ["tests"]\nreason = "These authored tests intentionally exercise native equality."\n'
                    : ''),
        );
        const eslint = await createEslint(folder.path);
        await writeFile(join(folder.path, 'tests/future.js'), source);
        const files = ['source.js', 'tests', 'apps'];
        const output = await collectLintFindings(eslint, folder.path, files, ['eqeqeq']);
        const results = await eslint.lintFiles(files);
        await unlink(join(folder.path, 'tests/future.js'));
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
    },
);

test.each([...LEVELS])(
    'blocks > React Native and react-hook-form syntax selectors report only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...SELECTOR_FILES,
            'gspot.toml': `level = "${level}"\nconfigurations = ["javascript"]\n[[scope]]\npath = "native"\nconfigurations = ["react-native"]\n[[scope]]\npath = "forms"\nconfigurations = ["react", "react-hook-form"]\n`,
        });
        const eslint = await createEslint(sandbox.path);
        expect(
            await collectLintFindings(
                eslint,
                sandbox.path,
                ['native/App.jsx', 'forms/Fields.jsx'],
                ['no-restricted-syntax'],
            ),
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

test.each(SELECTOR_GROUP_CASES)('blocks > generated selector blocks: $name', async ({ selectors, expected }) => {
    await using sandbox = await testdir({ 'gspot.toml': buildSettingsText(['javascript'], { level: 'all' }) });
    const session = await openSession(sandbox.path);
    const declaration = buildManifest('synthetic', { tables: stringify({ eslint: { selectors } }) });
    const groups = groupFragmentSelectors(
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

test('files > Node file patterns match a filename with a backslash and not its neighbor', () => {
    const file = String.raw`scripts/run\name`;
    const patterns = buildFilePatterns({ components: [], tests: [], scripts: [], nodeFiles: [file] }).code;
    const matches = picomatch(patterns, { dot: true, windows: false });
    expect(matches(file)).toBe(true);
    expect(matches('scripts/runname')).toBe(false);
});

test('blocks > an override of no-restricted-imports keeps the bans of tools.eslint.restricted_imports', async () => {
    await using folder = await testdir();
    await createFileTree(folder.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            tables: `[[tools.eslint.restricted_imports]]
name = "lodash"
message = "Use the built-in methods."

[[tools.eslint.override]]
paths = ["app/**"]
rules = { "no-restricted-imports" = [{ paths = [{ name = "moment", message = "Use Temporal." }] }] }
`,
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'app/source.js':
            "import lodash from 'lodash';\nimport moment from 'moment';\nexport const both = [lodash, moment];\n",
        'other.js':
            "import lodash from 'lodash';\nimport moment from 'moment';\nexport const both = [lodash, moment];\n",
    });
    const eslint = await createEslint(folder.path);
    expect(
        await collectLintFindings(eslint, folder.path, ['app/source.js', 'other.js'], ['no-restricted-imports']),
    ).toStrictEqual([
        { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
        { file: 'app/source.js', rule: 'no-restricted-imports', line: 2 },
        { file: 'other.js', rule: 'no-restricted-imports', line: 1 },
    ]);
});

test.each([...LEVELS])(
    "a scope's tools.eslint.restricted_imports ban reports the import only in that scope (%s)",
    async (level) => {
        await using folder = await testdir({
            ...SCOPE_IMPORT_FILES,
            'gspot.toml': buildSettingsText(['javascript'], { level, tables: SCOPE_IMPORT_TABLES }),
        });
        const eslint = await createEslint(folder.path);
        expect(
            await collectLintFindings(
                eslint,
                folder.path,
                ['source.js', 'sibling', 'app', 'state'],
                ['no-restricted-imports'],
            ),
        ).toStrictEqual([
            { file: 'app/deep/source.js', rule: 'no-restricted-imports', line: 1 },
            { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
            { file: 'sibling/source.js', rule: 'no-restricted-imports', line: 2 },
            { file: 'source.js', rule: 'no-restricted-imports', line: 2 },
            { file: 'state/store.js', rule: 'no-restricted-imports', line: 1 },
            { file: 'state/widget.js', rule: 'no-restricted-imports', line: 1 },
            { file: 'state/widget.js', rule: 'no-restricted-imports', line: 3 },
        ]);
    },
);

test('a JavaScript child applies its import restrictions under a Python root', async () => {
    await using folder = await testdir({
        'app/source.js': SCOPE_IMPORT_FILES['app/source.js'],
        'gspot.toml': buildSettingsText(['python'], {
            tables: `[[scope]]
path = "app"
configurations = ["javascript"]
[scope.tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]
`,
        }),
    });
    const eslint = await createEslint(folder.path);
    expect(await collectLintFindings(eslint, folder.path, ['app/source.js'], ['no-restricted-imports'])).toStrictEqual([
        { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    ]);
});
