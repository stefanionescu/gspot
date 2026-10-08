import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';

test.each(['recommended', 'all'] as const)(
    '%s native import fixes preserve executable Node ESM paths',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'lib/index.js': 'export const value = 42;\n',
            'source.js': "import { value } from './lib/index.js';\nexport const result = value;\n",
            'redundant.js': "import { value } from './lib/../lib/index.js';\nexport const result = value;\n",
        });
        const eslint = await createEslint(sandbox.path);
        const before = await eslint.lintFiles(['source.js', 'redundant.js']);
        expect(
            before.flatMap(({ filePath, messages }) =>
                messages.flatMap(({ ruleId, line, severity, fix }) =>
                    ruleId === 'import-x/no-useless-path-segments'
                        ? [{ file: filePath.slice(sandbox.path.length + 1), line, severity, fix: fix?.text }]
                        : [],
                ),
            ),
        ).toStrictEqual([{ file: 'redundant.js', line: 1, severity: 2, fix: '"./lib/index.js"' }]);
        const fixing = await createEslint(sandbox.path, { fix: true });
        await ESLint.outputFixes(await fixing.lintFiles(['source.js', 'redundant.js']));
        const corrected = await eslint.lintFiles(['source.js', 'redundant.js']);
        expect(
            corrected.flatMap(({ messages }) =>
                messages.filter(({ ruleId, fatal }) => ruleId === 'import-x/no-useless-path-segments' || fatal),
            ),
        ).toStrictEqual([]);
        for (const path of ['source.js', 'redundant.js']) {
            expect(await Bun.file(join(sandbox.path, path)).text()).toContain('./lib/index.js');
            const runtime = await runTestCommand(
                [
                    'node',
                    '--input-type=module',
                    '-e',
                    `import assert from 'node:assert/strict'; import { result } from './${path}'; assert.equal(result, 42);`,
                ],
                { cwd: sandbox.path },
            );
            expect(runtime.code, runtime.stdout + runtime.stderr).toBe(0);
        }
    },
);
