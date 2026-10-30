import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { unlink, writeFile } from 'node:fs/promises';
import { LEVELS } from '#cli/config/manifests/names.ts';
import { runGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    IGNORE_CASES,
    SCOPE_IMPORT_FILES,
    SCOPE_IMPORT_TABLES,
    ESLINT_OVERRIDES_SETTINGS,
    RESTRICTED_IMPORT_FINDINGS,
    RESTRICTED_IMPORT_SETTINGS,
} from '#tests/config/generation/configurations/language/javascript/eslint/overrides.ts';

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

    const eslint = await createEslint(sandbox.path);
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

        const eslint = await createEslint(sandbox.path);
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

test('an override of no-restricted-imports is refused with its owning setting', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript'], RESTRICTED_IMPORT_SETTINGS),
        'package.json': '{"private":true,"type":"module"}\n',
        'app/source.js':
            "import lodash from 'lodash';\nimport moment from 'moment';\nexport const both = [lodash, moment];\n",
        'other.js':
            "import lodash from 'lodash';\nimport moment from 'moment';\nexport const both = [lodash, moment];\n",
    });

    const refused = await runGspot(sandbox.path, ['apply']);
    expect(refused.code).toBe(2);
    expect({ stdout: refused.stdout, stderr: refused.stderr }).toStrictEqual({
        stdout: '',
        stderr: 'gspot.toml:8: tools.eslint.override.0.rules.no-restricted-imports: gspot writes the options of no-restricted-imports from tools.eslint.restricted_imports. Change that setting instead: gspot set tools.eslint.restricted_imports <value>, with --reason when you raise it.\n',
    });
});

test.each([...LEVELS])(
    "a scope's tools.eslint.restricted_imports ban reports the import only in that scope (%s)",
    async (level) => {
        await using sandbox = await createGitSandbox({
            ...SCOPE_IMPORT_FILES,
            'gspot.toml': buildSandboxSettings(['javascript'], { level, tables: SCOPE_IMPORT_TABLES }),
        });
        const eslint = await createEslint(sandbox.path);
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                ['source.js', 'sibling', 'app', 'state'],
                ['no-restricted-imports'],
            ),
        ).toStrictEqual([...RESTRICTED_IMPORT_FINDINGS]);
    },
);

test('a JavaScript child applies its import restrictions under a Python root', async () => {
    await using sandbox = await createGitSandbox({
        'app/source.js': SCOPE_IMPORT_FILES['app/source.js'],
        'gspot.toml': buildSandboxSettings(['python'], {
            scopes: [{ path: 'app', configurations: ['javascript'] }],
            tables: '[scope.tools.eslint]\nrestricted_imports = [{ name = "node:fs", message = "Use the storage service." }]\n',
        }),
    });
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.js'], ['no-restricted-imports'])).toStrictEqual([
        { file: 'app/source.js', rule: 'no-restricted-imports', line: 1 },
    ]);
});
