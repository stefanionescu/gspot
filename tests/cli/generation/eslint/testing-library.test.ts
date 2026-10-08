import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

for (const level of ['recommended', 'all'] as const)
    test(`Testing Library at ${level} reports a native finding only for selected dependency-owned test files`, async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript', 'testing-library'], {
                level,
                tables: '[scope.child]\n[scope.neighbor]\nremoved_configurations = ["testing-library"]\n',
            }),
            'package.json': '{"private":true,"dependencies":{"@testing-library/react":"1.0.0"}}\n',
            'child/package.json': '{"private":true,"dependencies":{}}\n',
            'neighbor/package.json': '{"private":true,"dependencies":{"@testing-library/react":"1.0.0"}}\n',
            'source.test.js': '',
            'child/source.test.js': '',
            'neighbor/source.test.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const source = "import { screen } from '@testing-library/react';\nscreen.debug();\n";
        for (const path of ['source.test.js', 'source.js', 'child/source.test.js', 'neighbor/source.test.js']) {
            const lint = await eslint.lintText(source, { filePath: path });
            const found = lint.flatMap(({ messages }) =>
                messages
                    .filter(({ ruleId }) => ruleId === 'testing-library/no-debugging-utils')
                    .map(({ ruleId, line }) => ({ ruleId, line })),
            );
            expect(found).toStrictEqual(
                path === 'source.test.js' ? [{ ruleId: 'testing-library/no-debugging-utils', line: 2 }] : [],
            );
        }
        const fixed = "import { screen } from '@testing-library/react';\nscreen.getByRole('button');\n";
        const lint = await eslint.lintText(fixed, { filePath: 'source.test.js' });
        expect(
            lint.flatMap(({ messages }) =>
                messages.filter(({ ruleId }) => ruleId === 'testing-library/no-debugging-utils'),
            ),
        ).toStrictEqual([]);
    });
