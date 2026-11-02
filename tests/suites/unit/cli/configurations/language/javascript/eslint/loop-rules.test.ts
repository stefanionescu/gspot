import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { ESLINT_LEVEL_CASES } from '#tests/config/configurations/javascript/configuration-blocks.ts';

test.each(ESLINT_LEVEL_CASES)('%s reports a jump at the end of a loop in %s', async (level, extension) => {
    const file = `jump.${extension}`;
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([extension === 'js' ? 'javascript' : 'typescript'], { level }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
        'package.json': '{"private":true,"type":"module"}',
        [file]: 'for (const item of items) { use(item); continue; }',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = ['gspot/restricted-syntax'];
    expect(await listLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([
        { file, rule: 'gspot/restricted-syntax', line: 1 },
    ]);
    await createFileTree(sandbox.path, { [file]: 'for (const item of items) { use(item); }' });
    expect(await listLintFindings(eslint, sandbox.path, [file], rules)).toStrictEqual([]);
});
