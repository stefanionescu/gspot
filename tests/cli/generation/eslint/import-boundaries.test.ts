import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import type { ResolvedEslint } from '#tests/types/generation/configuration-files.ts';
import type { BoundaryResult } from '#tests/types/cli/generation/eslint/import-boundaries.ts';
import { BOUNDARY_CASES, TEST_BOUNDARY_POLICY } from '#tests/config/cli/generation/eslint/import-boundaries.ts';

test('generated JavaScript configuration enables project import boundaries', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'src/task.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('src/task.js')) as ResolvedEslint;
    expect(config.rules['gspot/import-boundaries']?.[0]).toBe(2);
});

test('architecture rules use authored test patterns in each scope and keep checking other files', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], { level: 'all', tables: TEST_BOUNDARY_POLICY }),
        'package.json': '{"name":"boundaries","private":true,"type":"module"}',
        'storage/value.js': 'export const value = 1;\n',
        'apps/api/storage/value.js': 'export const value = 1;\n',
        ...Object.fromEntries(
            BOUNDARY_CASES.map(({ path, importPath }) => [
                path,
                `import { value } from '${importPath}';\nconsole.log(value);\n`,
            ]),
        ),
    });
    const eslint = await createEslint(sandbox.path);
    const linted = await eslint.lintFiles(BOUNDARY_CASES.map(({ path }) => path));
    const results: BoundaryResult[] = linted.map(({ filePath, messages }) => ({
        filePath,
        findings: messages.filter(({ ruleId }) => ruleId === 'boundaries/dependencies'),
    }));
    for (const { path, count } of BOUNDARY_CASES) {
        const result = results.find(({ filePath }) => filePath === join(sandbox.path, path));
        expect(result?.findings, path).toHaveLength(count);
    }
});
