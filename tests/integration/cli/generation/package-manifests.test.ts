// ESLint reads every package.json through the package-json rules. A manifest under a test folder gets no code rule.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

test.each(['vitest', 'jest'])(
    'every package.json gets the package-json rules and no code rule, beside %s',
    async (runner) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "all"\nkits = ["typescript", "${runner}"]\n[guides]\ninstall = false\n`,
            'package.json': '{"name":"planted","version":"1.0.0","private":true,"type":"module"}\n',
            'tests/package.json':
                '{"name":"planted-tests","version":"1.0.0","private":true,"dependencies":{"b":"1.0.0","a":"1.0.0"}}\n',
        });
        const eslint = await generatedEslint(sandbox.path);
        const results = await eslint.lintFiles(['package.json', 'tests/package.json']);
        const found = results.flatMap((result) =>
            result.messages.map((entry) => ({
                file: result.filePath.endsWith('tests/package.json') ? 'tests' : 'root',
                rule: entry.ruleId ?? entry.message,
            })),
        );
        expect(found).toContainEqual({ file: 'tests', rule: 'package-json/sort-collections' });
        expect(found.filter((entry) => !entry.rule.startsWith('package-json/'))).toStrictEqual([]);
    },
);
