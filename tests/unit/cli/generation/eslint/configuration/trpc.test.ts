import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

test.each([...LEVELS])(
    'tRPC procedures need an input schema in router role files of each scope at %s',
    async (level) => {
        await using sandbox = await testdir();
        const checked = new Set([
            'custom/action.ts',
            'routers/default.ts',
            'child/handlers/action.ts',
            'inherited/routers/action.ts',
        ]);
        const unchecked = [
            'outside/action.ts',
            'child/custom/action.ts',
            'inherited/custom/action.ts',
            'plain/routers/action.ts',
        ];
        await createFileTree(sandbox.path, {
            'gspot.toml': settingsText(['trpc', 'typescript'], {
                level,
                tables: '[architecture.roles]\nrouters = [ "custom/**", "child/handlers/**" ]\n\n[[scope]]\npath = "child"\n\n[[scope]]\npath = "inherited"\n\n[[scope]]\npath = "plain"\nremoved_configurations = [ "trpc" ]\n',
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}',
            ...Object.fromEntries(
                [...checked, ...unchecked].map((file) => [
                    file,
                    'procedure.query(() => 1);\nprocedure.input(schema).query(() => 1);\n',
                ]),
            ),
        });
        const eslint = await createEslint(sandbox.path);
        for (const file of [...checked, ...unchecked]) {
            expect(await lintFindings(eslint, sandbox.path, [file], ['no-restricted-syntax']), file).toStrictEqual(
                level === 'all' && checked.has(file) ? [{ file, rule: 'no-restricted-syntax', line: 1 }] : [],
            );
        }
    },
);
