import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/tool-files.ts';
import { TRPC_FILES, TRPC_TYPES, TRPC_IMPORTS, TRPC_MODULES, TRPC_FAILURES } from '#tests/data/checks/trpc.ts';

describe('trpc', () => {
    test('the generated tRPC rule composes server value boundaries', async () => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['trpc', 'typescript'], {
            level: 'all',
            tables: `${TRPC_MODULES}
[[scope]]
path = "app"
[[scope]]
path = "app/child"
[[scope]]
path = "flat"
`,
        });
        const files = {
            ...TRPC_FILES,
            'gspot.toml': settings,
            ...Object.fromEntries(
                TRPC_IMPORTS.map(({ source }, index) => [`form${String(index)}.ts`, `// Router boundary\n${source}\n`]),
            ),
        };
        await createFileTree(sandbox.path, files);
        const eslint = await createEslint(sandbox.path);
        const paths = [
            'public.ts',
            'form-value.js',
            'flat/client.ts',
            'comment.ts',
            'app/api/trpc/route.ts',
            'client/blocked.ts',
            'client/check.test.ts',
            'client/storage.test.ts',
            'app/client.ts',
            'app/child/client.ts',
            ...TRPC_IMPORTS.map((_, index) => `form${String(index)}.ts`),
        ];
        const expected = new Map([
            ...Object.entries(TRPC_FAILURES),
            ...TRPC_IMPORTS.map(({ line }, index): [string, number] => [`form${String(index)}.ts`, line]),
        ]);
        expect(await listLintFindings(eslint, sandbox.path, paths, ['boundaries/dependencies'])).toStrictEqual(
            [...expected]
                .map(([file, line]) => ({ file, rule: 'boundaries/dependencies', line }))
                .toSorted((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
        );
        for (const file of TRPC_IMPORTS.map((_, index) => `form${String(index)}.ts`)) {
            await createFileTree(sandbox.path, { [file]: TRPC_TYPES });
            expect(await listLintFindings(eslint, sandbox.path, [file], ['boundaries/dependencies'])).toStrictEqual([]);
        }
        await createFileTree(sandbox.path, { 'form0.ts': 'import { broken from "./private/router.js";\n' });
        expect(await listLintFindings(eslint, sandbox.path, ['form0.ts'], ['boundaries/dependencies'])).toStrictEqual([
            { file: 'form0.ts', rule: null, line: 1 },
        ]);
    });
});
describe('trpc', () => {
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
                'gspot.toml': buildSandboxSettings(['trpc', 'typescript'], {
                    level,
                    tables: '[trpc]\nrouter_files = [ "custom/**", "child/handlers/**" ]\n\n[[scope]]\npath = "child"\n\n[[scope]]\npath = "inherited"\n\n[[scope]]\npath = "plain"\nremoved_configurations = { value = [ "trpc" ], reason = "This scope does not expose a tRPC router." }\n',
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
                expect(
                    await listLintFindings(eslint, sandbox.path, [file], ['no-restricted-syntax']),
                    file,
                ).toStrictEqual(
                    level === 'all' && checked.has(file) ? [{ file, rule: 'no-restricted-syntax', line: 1 }] : [],
                );
            }
        },
    );
});
