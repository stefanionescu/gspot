import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { LEVELS } from '#cli/config/manifests.ts';
import { STANDALONE_BLOCK_FILES } from '#tests/config/configurations/javascript/base-selectors.ts';
import { EXPRESS_SCOPE_SETTINGS, SUPABASE_FOLDER_SETTINGS } from '#tests/config/configurations/javascript/selectors.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('a block that stands alone is reported at level all and not at basic', async () => {
    for (const [level, lines] of [
        ['all', [2, 6]],
        ['basic', []],
    ] as const) {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], { level }),
            ...STANDALONE_BLOCK_FILES,
        });
        const eslint = await buildEslint(sandbox.path);
        expect(await listLintFindings(eslint, sandbox.path, ['source.js'], ['gspot/restricted-syntax'])).toStrictEqual(
            lines.map((line) => ({ file: 'source.js', rule: 'gspot/restricted-syntax', line })),
        );
    }
});

test.each([...LEVELS])(
    '%s reports a label on a block, and a for loop without a counter only at level all',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['javascript'], { level }),
            'package.json': '{"private":true,"type":"module"}',
            'label.js': 'outer: { run(); }',
            'loop.js': 'for (; ready; ) run();',
            'allowed.js':
                'outer: while (ready) run(); doLoop: do { run(); } while (ready); forLoop: for (let i = 0; ready; i++) run(); inLoop: for (const key in value) run(); ofLoop: for (const item of values) run(); switchLabel: switch (value) { case 1: run(); } for (;;) break; for (let i = 0; ready;) run(); for (;ready;i++) run();',
        });
        const eslint = await buildEslint(sandbox.path);
        const files = ['label.js', 'loop.js', 'allowed.js'];
        expect(await listLintFindings(eslint, sandbox.path, files, ['gspot/restricted-syntax'])).toStrictEqual([
            { file: 'label.js', rule: 'gspot/restricted-syntax', line: 1 },
            ...(level === 'all' ? [{ file: 'loop.js', rule: 'gspot/restricted-syntax', line: 1 }] : []),
        ]);
    },
);

const SELECTOR_FILES = {
    'native/App.jsx':
        'const list = <FlatList data={items} />;\nconst scroll = <ScrollView>{items.map(renderItem)}</ScrollView>;\n',
    'forms/Fields.jsx': `const checkbox = <input type="checkbox" value="a" {...register("choice")} />;
const radio = <input type="radio" value="a" {...register("choice")} />;
const text = <input type="text" value="a" {...register("choice")} />;
const memberCheckbox = <input type="checkbox" value="a" {...form.register("choice")} />;
const memberRadio = <input type="radio" value="a" {...form.register("choice")} />;
const memberText = <input type="text" value="a" {...form.register("choice")} />;
`,
} as const;

test('form validation and list security run at level basic', async () => {
    await using sandbox = await testdir({
        ...SELECTOR_FILES,
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'basic',
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

const JWT_SCOPE_FILES = {
    'package.json': '{"private":true}',
    'source.js': 'jwt.decode(token);\n',
    'jwt/package.json': '{"private":true,"dependencies":{"jsonwebtoken":"9.0.2"}}',
    'jwt/source.js': `jwt.verify(token, key);
jwt.verify(token, key, { algorithms: ["RS256"] });
jwt.verify(token, key, { issuer });
jwt.decode(token);
`,
    'jwt/child/source.js': 'jwt.decode(token);\n',
    'other/package.json': '{"private":true}',
    'other/source.js': 'jwt.decode(token);\n',
} as const;

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

const EXPRESS_SCOPE_FILES = {
    'app/package.json': '{"name":"security-app","private":true,"dependencies":{"express":"0.0.0-test"}}',
    'source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
    'app/source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
    'app/child/source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
    'sibling/source.js': 'db.query(`SELECT * FROM users WHERE id = ${req.body.id}`);\n',
} as const;

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

const SUPABASE_FOLDER_FILES = Object.fromEntries(
    ['api/edge/cors.js', 'api/other/cors.js', 'sibling/edge/cors.js'].map((path) => [
        path,
        'export const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" };\n',
    ]),
);

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

const UNCHECKED_ROUTER_FILES: string[] = [
    'routers/default.ts',
    'inherited/routers/action.ts',
    'outside/action.ts',
    'child/custom/action.ts',
    'plain/routers/action.ts',
];

test('tRPC procedures need an input schema in router role files of each scope at basic', async () => {
    await using sandbox = await testdir();
    const checked = new Set(['custom/action.ts', 'child/handlers/action.ts']);
    const unchecked = [...UNCHECKED_ROUTER_FILES];
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSandboxSettings(['trpc', 'typescript'], {
            level: 'basic',
            tables: '[trpc]\nrouter_files = [ "custom/**", "child/handlers/**" ]\n\n[[scope]]\npath = "child"\n\n[[scope]]\npath = "inherited"\n\n[[scope]]\npath = "plain"\nremoved_configurations = { trpc = "This scope does not expose a tRPC router." }\n',
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
    const eslint = await buildEslint(sandbox.path);
    for (const file of [...checked, ...unchecked]) {
        expect(await listLintFindings(eslint, sandbox.path, [file], ['gspot/restricted-syntax']), file).toStrictEqual(
            checked.has(file) ? [{ file, rule: 'gspot/restricted-syntax', line: 1 }] : [],
        );
    }
});

test('a selector whose paths setting is empty is not planned', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['trpc', 'typescript'], { tables: '[trpc]\nrouter_files = []\n' }),
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}',
        'routers/a.ts': 'publicProcedure.query(resolve);\n',
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['routers/a.ts'], ['gspot/restricted-syntax'])).toStrictEqual(
        [],
    );
});

test('a JSON import attribute is accepted where your import extensions need a suffix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            level: 'all',
            tables: '[javascript]\nimport_extension = "js"\n\n',
            scopes: [{ path: 'app', configurations: ['javascript'] }],
        }),
        'package.json': '{"private":true,"type":"module","imports":{"#data/*":"./*.json"}}\n',
        'main.js': '',
        'app/main.js': '',
    });

    const eslint = await buildEslint(sandbox.path);
    for (const filePath of ['main.js', 'app/main.js']) {
        await createFileTree(sandbox.path, { [filePath]: 'import manifest from "#data/package";' });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['gspot/restricted-syntax'])).toStrictEqual([
            { file: filePath, rule: 'gspot/restricted-syntax', line: 1 },
        ]);
        await createFileTree(sandbox.path, {
            [filePath]: 'import manifest from "#data/package" with { type: "json" };',
        });
        expect(await listLintFindings(eslint, sandbox.path, [filePath], ['gspot/restricted-syntax'])).toStrictEqual([]);
    }
});
