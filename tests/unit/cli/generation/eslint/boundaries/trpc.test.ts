import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { settingsText } from '#tests/setup/settings.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';
import { TRPC_FILES, TRPC_TYPES, TRPC_IMPORTS, TRPC_MODULES, TRPC_FAILURES } from '#tests/config/trpc.ts';

test('the generated native tRPC rule composes server value boundaries', async () => {
    await using sandbox = await testdir();
    const settings = settingsText(['trpc', 'typescript'], {
        level: 'all',
        tables: `${TRPC_MODULES.replace('paths = ["private/**", "app/api/trpc/**"]', 'paths = ["private/**", "app/api/trpc/**", "app/private/**", "app/child/private/**", "flat/router.ts"]')}
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
    expect(await lintFindings(eslint, sandbox.path, paths, ['boundaries/dependencies'])).toStrictEqual(
        [...expected]
            .map(([file, line]) => ({ file, rule: 'boundaries/dependencies', line }))
            .toSorted((left, right) => left.file.localeCompare(right.file) || left.line - right.line),
    );
    for (const file of TRPC_IMPORTS.map((_, index) => `form${String(index)}.ts`)) {
        await createFileTree(sandbox.path, { [file]: TRPC_TYPES });
        expect(await lintFindings(eslint, sandbox.path, [file], ['boundaries/dependencies'])).toStrictEqual([]);
    }
    await createFileTree(sandbox.path, { 'form0.ts': 'import { broken from "./private/router.js";\n' });
    expect(await lintFindings(eslint, sandbox.path, ['form0.ts'], ['boundaries/dependencies'])).toStrictEqual([
        { file: 'form0.ts', rule: null, line: 1 },
    ]);
});
