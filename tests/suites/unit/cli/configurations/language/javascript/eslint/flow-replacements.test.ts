import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/generation/configurations/language/javascript/eslint/replacements.ts';

test.each(ESLINT_LEVEL_CASES)('%s preserves discarded postfix checks in %s', async (level, extension) => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [`assignment.${extension}`]: 'let count = 0; count = count++; read(count);',
        [`return.${extension}`]: 'function read(count) { const observe = () => count; return count++; }',
    });
    const eslint = await buildEslint(sandbox.path);
    const files = [`assignment.${extension}`, `return.${extension}`];
    const rules = ['gspot/no-discarded-postfix', 'sonarjs/no-useless-increment'];
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([
        { file: `assignment.${extension}`, rule: 'gspot/no-discarded-postfix', line: 1 },
        { file: `return.${extension}`, rule: 'gspot/no-discarded-postfix', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        [`assignment.${extension}`]: 'let count = 0; count += 1; read(count);',
        [`return.${extension}`]:
            'function read(count) { const observe = () => count; const previous = count; count += 1; return previous; }',
    });
    expect(await listLintFindings(eslint, sandbox.path, files, rules)).toStrictEqual([]);
});
