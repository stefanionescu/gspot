import { join } from 'node:path';
import picomatch from 'picomatch';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { unlink, writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { buildFilePatterns } from '#cli/generation/eslint/files.ts';
import { SELECTOR_FILES } from '#tests/data/generation/eslint/framework.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';

import {
    SCOPE_IMPORT_FILES,
    SCOPE_IMPORT_TABLES,
    ESLINT_OVERRIDES_SETTINGS,
} from '#tests/data/generation/eslint/overrides.ts';

test.each([false, true])(
    'blocks > an ignore of an ESLint rule applies after your rule options (%j)',
    async (ignored) => {
        await using folder = await testdir();
        const settings = buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[tools.eslint.rules]\n"no-console" = [{allow = ["warn"]}]\n',
        });
        await createFileTree(folder.path, {
            'gspot.toml':
                settings +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "This sandbox accepts the native console finding."\n'
                    : ''),
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': 'console.log("example");\n',
        });

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
            'gspot.toml':
                ESLINT_OVERRIDES_SETTINGS +
                (ignored
                    ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "eqeqeq"\npaths = ["tests"]\nreason = "These authored tests intentionally exercise native equality."\n'
                    : ''),
            'package.json': '{"private":true,"type":"module"}\n',
            'source.js': source,
            'tests/unit.js': source,
            'tests/exempt.js': source,
            'apps/web/page.js': source,
            'apps/web/exempt.js': source,
            'apps/web/admin/page.js': source,
        });

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
        await using sandbox = await testdir({
            ...SELECTOR_FILES,
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level: level,
                rules: true,
                scopes: [
                    { path: 'native', configurations: ['react-native'] },
                    { path: 'forms', configurations: ['react', 'react-hook-form'] },
                ],
            }),
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

test('files > Node file patterns match a filename with a backslash and not its neighbor', () => {
    const file = String.raw`scripts/run\name`;
    const patterns = buildFilePatterns({ components: [], scopes: [], nodeFiles: [file] }).code;
    const matches = picomatch(patterns, { dot: true, windows: false });
    expect(matches(file)).toBe(true);
    expect(matches('scripts/runname')).toBe(false);
});

test('an override of no-restricted-imports is refused with its owning setting', async () => {
    await using folder = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
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

    const refused = await runGspot(folder.path, ['apply']);
    expect(refused.code).toBe(2);
    expect(refused.stdout + refused.stderr).toContain(
        'gspot.toml: tools.eslint.override.0.rules.no-restricted-imports: gspot writes the options of no-restricted-imports from tools.eslint.restricted_imports. Change that setting instead: gspot set tools.eslint.restricted_imports <value>, with --reason when you raise it.',
    );
});

test.each([...LEVELS])(
    "a scope's tools.eslint.restricted_imports ban reports the import only in that scope (%s)",
    async (level) => {
        await using folder = await testdir({
            ...SCOPE_IMPORT_FILES,
            'gspot.toml': buildSandboxSettings(['javascript'], { level, tables: SCOPE_IMPORT_TABLES }),
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
        'gspot.toml': buildSandboxSettings(['python'], {
            scopes: [{ path: 'app', configurations: ['javascript'] }],
            tables: '[scope.tools.eslint]\nrestricted_imports = [{ name = "node:fs", message = "Use the storage service." }]\n',
        }),
    });
    const eslint = await createEslint(folder.path);
    expect(await collectLintFindings(eslint, folder.path, ['app/source.js'], ['no-restricted-imports'])).toStrictEqual([
        { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    ]);
});
