import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import {
    ESLINT_OVERRIDES_SETTINGS,
    IGNORE_CASES,
    RESTRICTED_IMPORT_FINDINGS,
    SCOPE_IMPORT_FILES,
    SCOPE_IMPORT_TABLES,
} from '#tests/config/configurations/javascript/overrides.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test.each(IGNORE_CASES)('an ignore of an ESLint rule applies after your rule options ($name)', async ({ ignored }) => {
    const settings = buildSandboxSettings(['javascript'], {
        level: 'all',
        tables: '[tools.eslint.rules]\n"no-console" = [{allow = ["warn"]}]\n',
    });
    await using sandbox = await createGitSandbox({
        'gspot.toml':
            settings +
            (ignored
                ? '\n[[ignore]]\ncheck = "javascript/eslint"\nrule = "no-console"\nreason = "This sandbox accepts the native console finding."\n'
                : ''),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js': 'console.log("example");\n',
    });

    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['no-console'])).toStrictEqual(
        ignored ? [] : [{ file: 'source.js', rule: 'no-console', line: 1 }],
    );
});

test.each(IGNORE_CASES)(
    'ESLint override blocks keep their order, nested scope limits, later files and path ignores ($name)',
    async ({ ignored }) => {
        const source = 'export const matches = (value) => value == null;\n';
        await using sandbox = await createGitSandbox({
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

        const eslint = await buildEslint(sandbox.path);
        await writeFile(join(sandbox.path, 'tests/future.js'), source);
        const files = ['source.js', 'tests', 'apps'];
        const output = await listLintFindings(eslint, sandbox.path, files, ['eqeqeq']);
        const results = await eslint.lintFiles(files);
        await unlink(join(sandbox.path, 'tests/future.js'));
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

test("a scope's javascript.banned_imports ban reports the import only in that scope", async () => {
    await using sandbox = await createGitSandbox({
        ...SCOPE_IMPORT_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: SCOPE_IMPORT_TABLES }),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['source.js', 'sibling', 'app', 'state'],
            ['no-restricted-imports'],
        ),
    ).toStrictEqual([...RESTRICTED_IMPORT_FINDINGS]);
});

test('a JavaScript child applies its import restrictions under a Python root', async () => {
    await using sandbox = await createGitSandbox({
        'app/source.js': SCOPE_IMPORT_FILES['app/source.js'],
        'gspot.toml': buildSandboxSettings(['python'], {
            scopes: [{ path: 'app', configurations: ['javascript'] }],
            tables: '[scope.javascript]\nbanned_imports = [{ name = "node:fs", message = "Use the storage service." }]\n',
        }),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.js'], ['no-restricted-imports'])).toStrictEqual([
        { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    ]);
});

test('an ignore of a package-json rule for one file keeps the finding in other files', async () => {
    const packageJson = { name: 'example', version: '0.0.0', type: 'module' };
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            tables: '[[ignore]]\ncheck = "javascript/eslint"\nrule = "package-json/require-exports"\npaths = ["cli/package.json"]\nreason = "The command package exposes no module API."\n',
        }),
        'package.json': JSON.stringify({ ...packageJson, private: true }),
        'cli/package.json': JSON.stringify(packageJson),
        'library/package.json': JSON.stringify(packageJson),
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['cli/package.json', 'library/package.json'],
            ['package-json/require-exports'],
        ),
    ).toStrictEqual([{ file: 'library/package.json', rule: 'package-json/require-exports', line: 1 }]);
});

test('a scope with rule options whose folder is missing still builds', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            tables: '[[scope]]\npath = "missing"\ntools.eslint.rules = { eqeqeq = ["always"] }\n',
        }),
        'source.js': 'export const ready = true;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['eqeqeq'])).toStrictEqual([]);
});
