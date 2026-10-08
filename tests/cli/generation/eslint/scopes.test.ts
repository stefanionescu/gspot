// A root without TypeScript selection uses its shared ESLint configuration for the API scope.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { SCOPES_SOURCE } from '#tests/config/cli/generation/eslint/scopes.ts';
import { STRICT_COMPILER_OPTIONS } from '#tests/config/samples/typescript.ts';

test('the shared ESLint configuration reads TypeScript selected only in an API scope', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            level: 'all',
            tables: '[agent_rules]\nenabled = false\n[scope."api"]\nconfigurations = ["typescript"]\n',
        }),
        'package.json': '{"name":"example","private":true,"type":"module","workspaces":["api"]}\n',
        'api/package.json': '{"name":"api","private":true,"type":"module"}\n',
        'api/tsconfig.json': JSON.stringify({ compilerOptions: STRICT_COMPILER_OPTIONS, include: ['src'] }) + '\n',
        'api/src/port.ts': SCOPES_SOURCE,
    });
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['api/src/port.ts']);
    expect(results.flatMap(({ messages }) => messages.map(({ ruleId, line }) => ({ ruleId, line })))).toStrictEqual([
        { ruleId: '@typescript-eslint/no-unnecessary-type-assertion', line: 4 },
    ]);
    await Bun.write(join(sandbox.path, 'api/src/port.ts'), SCOPES_SOURCE.replace(' as number', ''));
    const corrected = await eslint.lintFiles(['api/src/port.ts']);
    expect(corrected.flatMap(({ messages }) => messages)).toStrictEqual([]);
});
