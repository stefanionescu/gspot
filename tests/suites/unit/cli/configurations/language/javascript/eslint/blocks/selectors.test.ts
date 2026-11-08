import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import {
    FRAMEWORK_SELECTOR_CASES,
    SELECTOR_FILES,
    SELECTOR_LIBRARY_FILES,
} from '#tests/config/configurations/javascript/blocks.ts';
import {
    EXPRESS_SCOPE_FILES,
    EXPRESS_SCOPE_SETTINGS,
    EXPRESS_SOURCE_FINDINGS,
    EXPRESS_SOURCES,
    JAVASCRIPT_SELECTOR_FILES,
    JAVASCRIPT_SELECTOR_FINDINGS,
    JWT_SCOPE_FILES,
    NEXT_CONFIG_CASES,
    PLATFORM_FINDINGS,
    PLATFORM_SOURCES,
    SUPABASE_FOLDER_FILES,
    SUPABASE_FOLDER_SETTINGS,
} from '#tests/config/configurations/javascript/selectors.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('a template message to a logger method, including log, is reported, and console.log is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js':
            'export function report(logger, count) {\n    logger.log(`Saved ${count}`);\n    logger.info(`Read ${count}`);\n    console.log(`Printed ${count}`);\n}\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['source.js']);
    expect(
        result?.messages
            .filter(({ ruleId, message }) => ruleId === 'gspot/restricted-syntax' && message.startsWith('Log a stable'))
            .map(({ line }) => line),
    ).toStrictEqual([2, 3]);
});
test('a block that stands alone is reported at the top of a file and inside a function, and a case block is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js':
            'export const first = 1;\n{\n    console.info(first);\n}\nexport function pick(kind) {\n    {\n        console.info(kind);\n    }\n    switch (kind) {\n        case 1: {\n            return 1;\n        }\n        default: {\n            return 0;\n        }\n    }\n}\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['source.js']);
    expect(
        result?.messages
            .filter(
                ({ ruleId, message }) =>
                    ruleId === 'gspot/restricted-syntax' && message.startsWith('A block that stands'),
            )
            .map(({ line }) => line),
    ).toStrictEqual([2, 6]);
});
test.each(['basic'] as const)('form validation and list security run at level %s', async (level) => {
    await using sandbox = await testdir({
        ...SELECTOR_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level,
            rules: true,
            scopes: [
                { path: 'native', configurations: ['react-native'] },
                { path: 'forms', configurations: ['react', 'react-hook-form'] },
            ],
        }),
    });

    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            ['native/App.jsx', 'forms/Fields.jsx'],
            ['gspot/restricted-syntax'],
        ),
    ).toStrictEqual([
        { file: 'forms/Fields.jsx', rule: 'gspot/restricted-syntax', line: 3 },
        { file: 'forms/Fields.jsx', rule: 'gspot/restricted-syntax', line: 6 },
        { file: 'native/App.jsx', rule: 'gspot/restricted-syntax', line: 2 },
    ]);
});

test('store, form and procedure selectors distinguish validated calls and unrelated queries', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'zustand', 'react-hook-form', 'trpc'], {
            tables: '[trpc]\nrouter_files = ["source.js"]\n',
        }),
        'source.js':
            "import { useStore } from 'zustand';\nuseStore(cartStore);\nuseForm(options);\nuseForm({ ...options });\nuseForm({ defaultValues: { nested: { resolver: 1 } } });\npublicProcedure.query(resolve);\nprotectedProcedure.use(logger).query(resolve);\nt.procedure.query(resolve);\npool.query(sql);\nbyId.query(resolve);\ngetClient().query(sql);\npublicProcedure.input(schema).use(logger).mutation(resolve);\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['gspot/restricted-syntax'])).toStrictEqual(
        [2, 5, 6, 7, 8].map((line) => ({ file: 'source.js', rule: 'gspot/restricted-syntax', line })),
    );
});

test('a module-level store in a store file is reported at level all, and a store in a factory is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'zustand'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'cart.store.js':
            "import { createStore } from 'zustand/vanilla';\n\nexport const cartStore = createStore(() => ({}));\n\nexport function buildStore() {\n    return createStore(() => ({}));\n}\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['cart.store.js'], ['gspot/restricted-syntax'])).toStrictEqual([
        { file: 'cart.store.js', line: 3, rule: 'gspot/restricted-syntax' },
    ]);
});

test('a raw sql statement is reported at level all, and a sql fragment inside the query builder is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'drizzle'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js':
            'await db.execute(sql`select 1`);\nawait db.update(orders).set({ total: sql`${orders.total} + 1` });\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['gspot/restricted-syntax'])).toStrictEqual([
        { file: 'source.js', line: 1, rule: 'gspot/restricted-syntax' },
    ]);
});

test('library selectors at level basic report both whole-store reads and accept schema options and unrelated queries', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'zustand', 'react-hook-form', 'trpc'], {
            tables: '[trpc]\nrouter_files = ["router.js"]\n',
        }),
        ...SELECTOR_LIBRARY_FILES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, Object.keys(SELECTOR_LIBRARY_FILES), ['gspot/restricted-syntax']),
    ).toStrictEqual([{ file: 'cart.js', line: 4, rule: 'gspot/restricted-syntax' }]);
});

test.each([...FRAMEWORK_SELECTOR_CASES])(
    '$configuration selectors report their sample lines at level all',
    async (sample) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings([sample.language, sample.configuration], { level: 'all' }),
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"experimentalDecorators":true},"include":["*.ts"]}\n',
            [sample.file]: sample.source,
        });
        const eslint = await buildEslint(sandbox.path);
        expect(await listLintFindings(eslint, sandbox.path, [sample.file], ['gspot/restricted-syntax'])).toStrictEqual(
            sample.lines.map((line) => ({ file: sample.file, rule: 'gspot/restricted-syntax', line })),
        );
    },
);

test('the next-intl import bans apply only in a project that declares next-intl', async () => {
    const source = "import Link from 'next/link';\nimport { useRouter, useParams } from 'next/navigation';\n";
    const listFindings = async (dependencies: Record<string, string>): Promise<unknown[]> => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript', 'translations']),
            'package.json': JSON.stringify({ private: true, type: 'module', dependencies }),
            'page.js': source,
        });
        const eslint = await buildEslint(sandbox.path);
        return await listLintFindings(eslint, sandbox.path, ['page.js'], ['gspot/restricted-syntax']);
    };
    expect(await listFindings({ 'next-intl': '4.0.0' })).toStrictEqual([
        { file: 'page.js', rule: 'gspot/restricted-syntax', line: 1 },
        { file: 'page.js', rule: 'gspot/restricted-syntax', line: 2 },
    ]);
    expect(await listFindings({})).toStrictEqual([]);
});

test('the JavaScript security selectors report unsafe sinks and pass fixed forms', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        'package.json': '{"private":true,"type":"module"}\n',
        ...JAVASCRIPT_SELECTOR_FILES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, Object.keys(JAVASCRIPT_SELECTOR_FILES), [
            'gspot/restricted-syntax',
        ]),
    ).toStrictEqual(
        Object.entries(JAVASCRIPT_SELECTOR_FINDINGS).flatMap(([file, lines]) =>
            lines.map((line) => ({ file, line, rule: 'gspot/restricted-syntax' })),
        ),
    );
});

test('the JWT selectors run only where the nearest package.json names jsonwebtoken', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'jwt' }, { path: 'jwt/child' }, { path: 'other' }],
        }),
        ...JWT_SCOPE_FILES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            Object.keys(JWT_SCOPE_FILES).filter((path) => path.endsWith('.js')),
            ['gspot/restricted-syntax'],
        ),
    ).toStrictEqual([
        { file: 'jwt/child/source.js', line: 1, rule: 'gspot/restricted-syntax' },
        ...[1, 3, 4].map((line) => ({ file: 'jwt/source.js', line, rule: 'gspot/restricted-syntax' })),
    ]);
});

test('the Express selectors report request data in sinks and accept parameters and JSON', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['express']),
        'package.json': '{"private":true,"type":"module","dependencies":{"express":"0.0.0-test"}}\n',
        ...EXPRESS_SOURCES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, Object.keys(EXPRESS_SOURCES), ['gspot/restricted-syntax']),
    ).toStrictEqual(EXPRESS_SOURCE_FINDINGS.map((row) => ({ ...row, rule: 'gspot/restricted-syntax' })));
});

test('the Express selectors stay within the scopes that inherit Express', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: EXPRESS_SCOPE_SETTINGS }),
        ...EXPRESS_SCOPE_FILES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            Object.keys(EXPRESS_SCOPE_FILES).filter((path) => path.endsWith('.js')),
            ['gspot/restricted-syntax'],
        ),
    ).toStrictEqual([
        { file: 'app/child/source.js', line: 1, rule: 'gspot/restricted-syntax' },
        { file: 'app/source.js', line: 1, rule: 'gspot/restricted-syntax' },
    ]);
});

test.each([...NEXT_CONFIG_CASES])('the Next.js selectors read next.config: $name', async ({ source, expected }) => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['nextjs']),
        'tsconfig.json': '{"include":["*.ts"]}\n',
        'next.config.ts': source,
        'settings.ts': 'export const settings = { env: { API_TOKEN: "text" } };\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, ['next.config.ts', 'settings.ts'], ['gspot/restricted-syntax']),
    ).toStrictEqual(expected.map((line) => ({ file: 'next.config.ts', line, rule: 'gspot/restricted-syntax' })));
});

test('the Cloudflare and Supabase selectors report wildcard origins and raw filters', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript', 'supabase', 'cloudflare'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"include":["supabase"]}\n',
        'wrangler.toml': 'name = "example"\ncompatibility_date = "2026-01-01"\n',
        'supabase/config.toml': 'project_id = "example"\n',
        ...PLATFORM_SOURCES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, Object.keys(PLATFORM_SOURCES), ['gspot/restricted-syntax']),
    ).toStrictEqual(PLATFORM_FINDINGS.map((row) => ({ ...row, rule: 'gspot/restricted-syntax' })));
});

test('a selector that a folder setting limits reads the folder of its scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { tables: SUPABASE_FOLDER_SETTINGS }),
        'api/supabase/config.toml': 'project_id = "example"\n',
        ...SUPABASE_FOLDER_FILES,
    });
    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(eslint, sandbox.path, Object.keys(SUPABASE_FOLDER_FILES), ['gspot/restricted-syntax']),
    ).toStrictEqual([{ file: 'api/edge/cors.js', line: 1, rule: 'gspot/restricted-syntax' }]);
});
