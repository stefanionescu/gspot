import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { compareText } from '#cli/system/text/order.ts';
import { packageJsonSchema } from '#cli/schemas/parsers.ts';
import { unlink, readFile, writeFile } from 'node:fs/promises';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { APP_SCOPE_SETTINGS } from '#tests/config/setup/sandboxes.ts';
import { buildEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

import {
    TRPC_TYPES,
    TRPC_IMPORTS,
    TRPC_MODULES,
    IMPORT_RULE_CASES,
    IMPORT_RULE_FILES,
    TEST_IMPORT_CASES,
    IMPORT_RULE_TABLES,
    COMPONENT_IMPORT_CASES,
    STYLESHEET_IMPORT_CASES,
    TEST_IMPORT_RULE_TABLES,
} from '#tests/config/configurations/javascript/blocks.ts';

test.each(COMPONENT_IMPORT_CASES)(
    '$configuration component imports obey their import rule',
    async ({ configuration, file, opening, closing }) => {
        const path = `app/${file}`;
        await using sandbox = await testdir({
            ...IMPORT_RULE_FILES,
            'tsconfig.json': '{"compilerOptions":{"strict":true,"types":[]},"include":["**/*"]}',
            'gspot.toml': buildSandboxSettings(['typescript', configuration], { tables: IMPORT_RULE_TABLES.root }),
            [path]: `${opening}\nimport { value } from '../storage/value.js';\nconst result = value;\n${closing}\n`,
        });
        const eslint = await buildEslint(sandbox.path);
        expect(await listLintFindings(eslint, sandbox.path, [path], ['boundaries/dependencies'])).toStrictEqual([
            { file: path, rule: 'boundaries/dependencies', line: 2 },
        ]);
    },
);

test.each([...IMPORT_RULE_CASES])(
    '$level loads eslint-plugin-boundaries for $declarations import rules',
    async ({ level, declarations }) => {
        await using sandbox = await testdir();
        const settings = buildSandboxSettings(['typescript'], { level, tables: IMPORT_RULE_TABLES[declarations] });
        await createFileTree(sandbox.path, { ...IMPORT_RULE_FILES, 'gspot.toml': settings });
        const eslint = await buildEslint(sandbox.path);
        const text = await readFile(join(sandbox.path, GSPOT_PATHS.npmProject), 'utf8');
        const { devDependencies = {} } = packageJsonSchema.parse(JSON.parse(text));
        const isEnabled = level === 'all' || declarations !== 'none';
        expect(Object.hasOwn(devDependencies, 'eslint-plugin-boundaries')).toBe(isEnabled);
        if (!isEnabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                ['app/source.ts', 'apps/api/app/source.ts'],
                ['boundaries/dependencies'],
            ),
        ).toStrictEqual(
            declarations === 'none'
                ? []
                : [
                      {
                          file: declarations === 'root' ? 'app/source.ts' : 'apps/api/app/source.ts',
                          rule: 'boundaries/dependencies',
                          line: 1,
                      },
                  ],
        );
        await Promise.all(
            ['app/source.ts', 'apps/api/app/source.ts'].map((file) =>
                writeFile(
                    join(sandbox.path, file),
                    "import { value } from './value.js';\nexport const result = value;\n",
                ),
            ),
        );
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                ['app/source.ts', 'apps/api/app/source.ts'],
                ['boundaries/dependencies'],
            ),
        ).toStrictEqual([]);
    },
);

test.each(STYLESHEET_IMPORT_CASES)(
    '$name: an import rule owns a stylesheet only when its paths match it',
    async ({ glob, findings }) => {
        const tables = `[[import_rule]]\nname = "app"\npaths = ["app/${glob}"]\n\n[[import_rule]]\nname = "styles"\npaths = ["styles/${glob}"]\n`;
        await using sandbox = await testdir({
            ...IMPORT_RULE_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { tables }),
            'app/source.ts': "import '../styles/global.css';\nimport './source.module.css';\n",
            'app/source.module.css': '.card { color: red; }\n',
            'styles/global.css': 'a { color: red; }\n',
        });
        const eslint = await buildEslint(sandbox.path);
        expect(
            await listLintFindings(eslint, sandbox.path, ['app/source.ts'], ['boundaries/dependencies']),
        ).toStrictEqual([...findings]);
    },
);

const TEST_IMPORT_RULE_CASES = [
    { path: 'app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'app/qa/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'app/verification/check.js', importPath: '../../storage/value.js', count: 1 },
    { path: 'app/example.test.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/source.js', importPath: '../storage/value.js', count: 1 },
    { path: 'apps/api/app/verification/check.js', importPath: '../../storage/value.js', count: 0 },
    { path: 'apps/api/app/example.spec.js', importPath: '../storage/value.js', count: 1 },
] as const;

test('import rules skip your test files in each scope and check other files', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', tables: TEST_IMPORT_RULE_TABLES }),
        'package.json': '{"name":"boundaries","private":true,"type":"module"}',
        'storage/value.js': 'export const value = 1;\n',
        'apps/api/storage/value.js': 'export const value = 1;\n',
        ...Object.fromEntries(
            TEST_IMPORT_RULE_CASES.map(({ path, importPath }) => [
                path,
                `import { value } from '${importPath}';\nconsole.log(value);\n`,
            ]),
        ),
    });

    const eslint = await buildEslint(sandbox.path);
    expect(
        await listLintFindings(
            eslint,
            sandbox.path,
            TEST_IMPORT_RULE_CASES.map(({ path }) => path),
            ['boundaries/dependencies'],
        ),
    ).toStrictEqual(
        TEST_IMPORT_RULE_CASES.flatMap(({ path, count }) =>
            Array.from({ length: count }, () => ({ file: path, rule: 'boundaries/dependencies', line: 1 })),
        ).toSorted((left, right) => compareText(left.file, right.file)),
    );
});

const TEST_IMPORT_TSCONFIG =
    '{"compilerOptions":{"strict":true,"noEmit":true,"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","baseUrl":".","paths":{"@/*":["./*"]},"types":[]},"include":["**/*.ts"]}';

test('a file outside test_files may not import a test file, in root and child scopes, at all', async () => {
    await using sandbox = await testdir();
    const settings = buildSandboxSettings(['typescript'], {
        level: 'all',
        tables: APP_SCOPE_SETTINGS,
    });
    await createFileTree(sandbox.path, {
        'gspot.toml': settings,
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': TEST_IMPORT_TSCONFIG,
        'app/tsconfig.json': TEST_IMPORT_TSCONFIG,
        ...Object.fromEntries(
            ['', 'app/'].flatMap((prefix) =>
                Object.entries({
                    'src/value.ts': 'export const value = 1;\nexport type Value = number;\n',
                    'tests/value.ts': 'export const value = 1;\nexport type Value = number;\n',
                    'other/value.test.ts': 'export const value = 1;\n',
                } as const).map(([path, source]) => [prefix + path, source]),
            ),
        ),
    });
    const files = ['', 'app/'].flatMap((prefix) =>
        TEST_IMPORT_CASES.map((row, index) => ({
            ...row,
            path: `${prefix}${row.folder}/case${String(index)}.ts`,
        })),
    );
    for (const row of files) await writeFile(join(sandbox.path, row.path), row.source);
    const eslint = await buildEslint(sandbox.path);
    for (const row of files) {
        expect(await listLintFindings(eslint, sandbox.path, [row.path], ['boundaries/dependencies'])).toStrictEqual(
            row.rejected ? [{ file: row.path, rule: 'boundaries/dependencies', line: 1 }] : [],
        );
    }
});

test('each file holds one import rule, the tRPC category comes first, and a refused import names the rules, also one with template braces', async () => {
    await using sandbox = await testdir({
        ...IMPORT_RULE_FILES,
        'gspot.toml': buildSandboxSettings(['trpc', 'typescript'], {
            level: 'all',
            tables: `[trpc]\nserver_files = ["storage/**"]\n\n[[import_rule]]\nname = "{{core}}"\npaths = [ "core/**" ]\n\n${IMPORT_RULE_TABLES.root}`,
        }),
        'app/source.ts': "import type { Value } from '../storage/value.js';\nexport type Result = Value;\n",
        'storage/value.ts': 'export type Value = number;\n',
    });

    const eslint = await buildEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['app/source.ts']);
    const messages = result?.messages
        .filter(({ ruleId }) => ruleId === 'boundaries/dependencies')
        .map(({ message }) => message);
    expect(messages).toHaveLength(1);
    for (const text of ['rule "app"', 'its own files and "{{core}}", not', 'from rule "storage"'])
        expect(messages?.[0]).toContain(text);
});

test('an import of a javascript.externals specifier that resolves to a file passes its import rule, and other specifiers of that file are reported', async () => {
    const tables = `${IMPORT_RULE_TABLES.root}\n[javascript]\nexternals = { value = ["#host/*"], reason = "The host supplies this module." }\n`;
    await using sandbox = await testdir({
        ...IMPORT_RULE_FILES,
        'package.json':
            '{"private":true,"type":"module","imports":{"#host/value":"./storage/value.ts","#own/value":"./storage/value.ts"}}\n',
        'gspot.toml': buildSandboxSettings(['typescript'], { tables }),
        'app/source.ts':
            "import { value } from '#host/value';\nimport { value as own } from '#own/value';\nexport const result = value + own;\n",
    });
    const eslint = await buildEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.ts'], ['boundaries/dependencies'])).toStrictEqual([
        { file: 'app/source.ts', rule: 'boundaries/dependencies', line: 2 },
    ]);
});

const TRPC_FILES = {
    'tsconfig.json':
        '{"compilerOptions":{"allowJs":true,"paths":{"@private/*":["./private/*"]}},"include":["**/*.ts"]}',
    'package.json': '{"name":"routers","private":true,"type":"module","imports":{"#private/*":"./private/*.ts"}}',
    'private/router.ts': 'export const router = {};\n',
    'public/value.ts': 'export const value = 1;\n',
    'public.ts': 'import { value } from "./public/value.js";\n',
    'form-value.js': 'import { router } from "./private/router.js";\n',
    'flat/router.ts': 'export const router = {};\n',
    'flat/client.ts': 'import { router } from "./router.js";\n',
    'comment.ts': '// import { router } from "./private/router.js";\nexport const title = "Public";\n',
    'app/api/trpc/route.ts': 'import { router } from "../../../private/router.js";\nexport const handler = router;\n',
    'client/blocked.ts': 'import { value } from "../storage/value.js";\n',
    'storage/value.ts': 'export const value = 1;\n',
    'client/check.test.ts': 'import { router } from "../private/router.js";\n',
    'client/storage.test.ts': 'import { value } from "../storage/value.js";\n',
    'app/private/router.ts': 'export const router = {};\n',
    'app/client.ts': TRPC_TYPES,
    'app/child/private/router.ts': 'export const router = {};\n',
    'app/child/client.ts': 'import { router } from "./private/router.js";\n',
} as const;

const TRPC_FAILURES = {
    'form-value.js': 1,
    'client/blocked.ts': 1,
    'client/check.test.ts': 1,
    'app/child/client.ts': 1,
    'flat/client.ts': 1,
} as const;

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
    const eslint = await buildEslint(sandbox.path);
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
});
