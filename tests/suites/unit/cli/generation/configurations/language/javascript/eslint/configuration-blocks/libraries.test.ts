import { test, expect } from 'bun:test';
import { compareText } from '#cli/system/text.ts';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    TRPC_FILES,
    TRPC_TYPES,
    TRPC_IMPORTS,
    TRPC_MODULES,
    TRPC_FAILURES,
    ZUSTAND_FILES,
    DRIZZLE_SCOPE_SETTINGS,
    UNCHECKED_ROUTER_FILES,
} from '#tests/config/generation/configurations/language/javascript/eslint/configuration-blocks/libraries.ts';

test('Drizzle reports delete and update without where only for its client names', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['drizzle'], DRIZZLE_SCOPE_SETTINGS),
        'source.js':
            'db.delete(table);\nother.delete(table);\nnew Map().delete(key);\nnew Set().delete(key);\nnew Headers().delete("header");\nnew URLSearchParams().delete("query");\n',
        'app/source.js': 'connection.update(table).set({ value: 1 });\nother.update(table).set({ value: 1 });\n',
    });

    const eslint = await createEslint(sandbox.path);
    const rules = ['drizzle/enforce-delete-with-where', 'drizzle/enforce-update-with-where'];
    expect(await listLintFindings(eslint, sandbox.path, ['source.js', 'app/source.js'], rules)).toStrictEqual([
        { file: 'app/source.js', rule: 'drizzle/enforce-update-with-where', line: 1 },
        { file: 'source.js', rule: 'drizzle/enforce-delete-with-where', line: 1 },
    ]);
    await createFileTree(sandbox.path, {
        'app/source.js': 'connection.update(table).set({ value: 1 }).where(condition);\n',
    });
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.js'], rules)).toStrictEqual([]);
});

test.each([...LEVELS])(
    'the translations configuration reports literal UI text outside the test files of each scope at %s',
    async (level) => {
        await using sandbox = await testdir();
        const tested = ['qa/entry.jsx', 'app/qa/entry.jsx', 'app/verification/entry.jsx', 'app/deep/qa/entry.jsx'];
        const ordinary = new Set(['source.jsx', 'app/source.jsx', 'app/deep/source.jsx']);
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSandboxSettings(['translations', 'react'], {
                level,
                tables: 'test_files = [ "**/qa/**" ]\n\n[[scope]]\npath = "app"\ntest_files = [ "app/verification/**" ]\n\n[[scope]]\npath = "app/deep"\n\n[[scope]]\npath = "sibling"\nremoved_configurations = { value = [ "translations" ], reason = "This scope does not translate its UI text." }\n',
            }),
            'package.json': '{"private":true,"type":"module"}\n',
            ...Object.fromEntries(
                [...tested, ...ordinary, 'sibling/source.jsx'].map((path) => [
                    path,
                    'export const element = <p>Hello there</p>;\n',
                ]),
            ),
        });
        const eslint = await createEslint(sandbox.path);
        for (const file of [...tested, ...ordinary, 'sibling/source.jsx']) {
            expect(
                await listLintFindings(eslint, sandbox.path, [file], ['i18next/no-literal-string']),
                file,
            ).toStrictEqual(
                level === 'all' && ordinary.has(file) ? [{ file, rule: 'i18next/no-literal-string', line: 1 }] : [],
            );
        }
    },
);

test.each([...LEVELS])(
    'at %s, Zustand store files keep your import restrictions and other files get the Zustand restriction',
    async (level) => {
        await using sandbox = await testdir({
            ...ZUSTAND_FILES,
            'gspot.toml': buildSandboxSettings(['javascript', 'zustand'], {
                tables: `[tools.eslint]
restricted_imports = [{ name = "node:fs", message = "Use the storage service." }]
[zustand]
store_files = { value = ["**/store.js"], reason = "This test sets the allowed locations explicitly." }
`,
                level,
            }),
        });

        const eslint = await createEslint(sandbox.path);
        const files = ['src/widget.js', 'src/store.js'];
        expect(await listLintFindings(eslint, sandbox.path, files, ['no-restricted-imports'])).toStrictEqual([
            { file: 'src/store.js', rule: 'no-restricted-imports', line: 2 },
            { file: 'src/widget.js', rule: 'no-restricted-imports', line: 1 },
            { file: 'src/widget.js', rule: 'no-restricted-imports', line: 2 },
            { file: 'src/widget.js', rule: 'no-restricted-imports', line: 3 },
        ]);
        const results = await eslint.lintFiles(files);
        for (const result of results) {
            expect(
                result.messages.find(({ ruleId, line }) => ruleId === 'no-restricted-imports' && line === 2)?.message,
            ).toBe("'node:fs' import is restricted from being used. Use the storage service.");
        }
    },
);

test('a file outside tRPC server_files may not import a server value, and type-only imports pass', async () => {
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
            .toSorted((left, right) => compareText(left.file, right.file) || left.line - right.line),
    );
    for (const index of TRPC_IMPORTS.keys()) {
        const file = `form${String(index)}.ts`;
        await createFileTree(sandbox.path, { [file]: TRPC_TYPES });
        expect(await listLintFindings(eslint, sandbox.path, [file], ['boundaries/dependencies'])).toStrictEqual([]);
    }
    await createFileTree(sandbox.path, { 'form0.ts': 'import { broken from "./private/router.js";\n' });
    expect(await listLintFindings(eslint, sandbox.path, ['form0.ts'], ['boundaries/dependencies'])).toStrictEqual([
        { file: 'form0.ts', rule: null, line: 1 },
    ]);
});

test.each([...LEVELS])(
    'tRPC procedures need an input schema in router role files of each scope at %s',
    async (level) => {
        await using sandbox = await testdir();
        const checked = new Set(['custom/action.ts', 'child/handlers/action.ts']);
        const unchecked = [...UNCHECKED_ROUTER_FILES];
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
                    'publicProcedure.query(() => 1);\npublicProcedure.input(schema).query(() => 1);\n',
                ]),
            ),
        });
        const eslint = await createEslint(sandbox.path);
        for (const file of [...checked, ...unchecked]) {
            expect(await listLintFindings(eslint, sandbox.path, [file], ['no-restricted-syntax']), file).toStrictEqual(
                checked.has(file) ? [{ file, rule: 'no-restricted-syntax', line: 1 }] : [],
            );
        }
    },
);

test('TanStack Query rules report only in the scope that selects tanstack-query', async () => {
    const source =
        "import { useQuery } from '@tanstack/react-query';\nconst { data, ...rest } = useQuery({ queryKey: ['todos'], queryFn: load });\n";
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'app', configurations: ['tanstack-query'] }],
        }),
        'source.js': source,
        'app/source.js': source,
    });
    const eslint = await createEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['source.js', 'app/source.js'],
            ['@tanstack/query/no-rest-destructuring'],
        ),
    ).toStrictEqual([{ file: 'app/source.js', rule: '@tanstack/query/no-rest-destructuring', line: 2 }]);
});
