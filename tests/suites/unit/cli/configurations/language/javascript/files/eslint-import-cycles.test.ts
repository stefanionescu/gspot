import { ESLint } from 'eslint';
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildEslint } from '#tests/setup/eslint/lint.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { getManifestTarget } from '#tests/setup/cli/generated-files.ts';

test('the import-cycles config parses TypeScript files and resolves their imports through the projects', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"paths":{"@/*":["./src/*"]}},"include":["src/**/*.ts"]}',
        'src/first.ts': "import { second } from '@/second.ts';\nexport const first: number = second + 1;\n",
        'src/second.ts': "import { first } from './first.ts';\nexport const second: number = first - 1;\n",
    });
    await buildEslint(sandbox.path);
    const eslint = new ESLint({
        cwd: sandbox.path,
        overrideConfigFile: join(sandbox.path, getManifestTarget('javascript', 'eslint/import-cycles.mjs')),
    });
    const results = await eslint.lintFiles(['src/first.ts', 'src/second.ts']);
    expect(results.flatMap(({ messages }) => messages.map(({ ruleId, line }) => ({ ruleId, line })))).toStrictEqual([
        { ruleId: 'import-x/no-cycle', line: 1 },
        { ruleId: 'import-x/no-cycle', line: 1 },
    ]);
});
