import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';

test.each(ESLINT_LEVEL_CASES)('%s reports invalid literal calls and template tags in %s', async (level, extension) => {
    const expressions = ['[]', 'class {}', '{}', '42', '"text"', 'true', 'null', '/pattern/', '`text`'];
    const invalid = expressions.flatMap((expression) => [`(${expression})();`, `(${expression})\`text\`;`]);
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`literal.${extension}`]: invalid.join('\n'),
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['gspot/restricted-syntax'];
    expect(await listLintFindings(eslint, sandbox.path, [`literal.${extension}`], rules)).toStrictEqual(
        invalid.map((_, index) => ({
            file: `literal.${extension}`,
            rule: 'gspot/restricted-syntax',
            line: index + 1,
        })),
    );
    await createFileTree(sandbox.path, {
        [`literal.${extension}`]: [
            '(function() {})();',
            '(() => {})();',
            'new (class {})();',
            'call();',
            'receiver.call();',
            'tag`text`;',
            '[call][0]();',
        ].join('\n'),
    });
    expect(await listLintFindings(eslint, sandbox.path, [`literal.${extension}`], rules)).toStrictEqual([]);
});

test.each(ESLINT_LEVEL_CASES)('%s reports package entry-point imports in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`imports.${extension}`]: 'import value from "./node_modules/example/private";',
        [`require.${extension}`]: 'const value = require("./node_modules/example/private");',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`imports.${extension}`, `require.${extension}`];
    const rules = ['gspot/restricted-syntax'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `imports.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
        { file: `require.${extension}`, rule: 'gspot/restricted-syntax', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`imports.${extension}`]: 'import value from "example";',
        [`require.${extension}`]: 'const value = require("example");',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
