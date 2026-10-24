import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations/names.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { HOST_MODULE } from '#tests/config/generation/configurations/language/javascript/samples.ts';

import {
    SORT_CASES,
    SORT_RULES,
} from '#tests/config/generation/configurations/language/javascript/eslint/blocks/imports.ts';

test('a bundler scope uses extensionless imports while the Node.js parent keeps .js suffixes', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            rules: true,
            scopes: [{ path: 'app', configurations: ['react'] }],
        }),
        'source.js': '',
        'value.js': 'export const value = 1;\n',
        'app/source.js': '',
        'app/value.js': 'export const value = 1;\n',
    });

    const eslint = await createEslint(sandbox.path);
    const source = 'import { value } from "./value";\n';
    await createFileTree(sandbox.path, { 'source.js': source, 'app/source.js': source });
    const rules = ['n/file-extension-in-import'];
    expect(await listLintFindings(eslint, sandbox.path, ['source.js'], rules)).toStrictEqual([
        { file: 'source.js', rule: 'n/file-extension-in-import', line: 1 },
    ]);
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.js'], rules)).toStrictEqual([]);
});

test.each([...LEVELS])(
    'imports and exports are sorted at level all only, in root and child scopes (%s)',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript'], {
                level,
                scopes: [{ path: 'app', configurations: ['typescript'] }],
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'app/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/source.ts': '',
            'app/src/source.ts': '',
        });

        const eslint = await createEslint(sandbox.path, {
            fix: ({ ruleId }) =>
                (ruleId !== null && new Set<string>(SORT_RULES).has(ruleId)) ||
                ruleId === 'gspot/no-comments-in-imports',
        });
        for (const prefix of ['', 'app/']) {
            const filePath = `${prefix}src/source.ts`;
            for (const { source, fixed } of SORT_CASES) {
                const [result] = await eslint.lintText(source, { filePath });
                expect(result?.fatalErrorCount).toBe(0);
                expect(result?.output ?? source).toBe(level === 'all' ? fixed : source);
                expect(
                    result!.messages.find(({ ruleId }) => ruleId !== null && new Set<string>(SORT_RULES).has(ruleId)),
                ).toBeUndefined();
            }
        }
    },
);

test('a bundler scope drops only code suffixes, and its Node scripts keep every suffix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            rules: true,
            scopes: [{ path: 'app', configurations: ['react'] }],
        }),
        'app/value.js': 'export const value = 1;\n',
        'app/styles.css': '.card { color: red; }\n',
        'app/data.json': '{"value":1}\n',
        'app/library.mjs': 'export const library = 1;\n',
        'app/source.js': '',
        'app/tool.mjs': '',
    });

    const eslint = await createEslint(sandbox.path, { fix: true });
    const rules = ['n/file-extension-in-import'];
    const bundled =
        'import "./styles.css";\nimport data from "./data.json" with { type: "json" };\nimport { value } from "./value";\nexport { data, value };\n';
    const script = 'import { library } from "./library.mjs";\nexport { library };\n';
    await createFileTree(sandbox.path, { 'app/source.js': bundled, 'app/tool.mjs': script });
    expect(await listLintFindings(eslint, sandbox.path, ['app/source.js', 'app/tool.mjs'], rules)).toStrictEqual([]);
    const [fixed] = await eslint.lintText('import { value } from "./value.js";\nexport { value };\n', {
        filePath: 'app/source.js',
    });
    expect(fixed?.output).toBe('import { value } from "./value";\nexport { value };\n');
    const [kept] = await eslint.lintText('import { library } from "./library";\nexport { library };\n', {
        filePath: 'app/tool.mjs',
    });
    expect(kept?.output).toBe('import { library } from "./library.mjs";\nexport { library };\n');
});

test('a Node script imports through package.json imports, never through TypeScript paths', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module","imports":{"#src/*":"./src/*"}}',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"paths":{"@/*":["./src/*"]}},"include":["src/**/*.ts"]}',
        'src/app/value.mjs': 'export const value = 1;\n',
        'src/app/entry.ts': '',
        'tools/run/tool.mjs': '',
    });

    const eslint = await createEslint(sandbox.path, { fix: ({ ruleId }) => ruleId === 'gspot/import-boundaries' });
    const [fixed] = await eslint.lintText('import { value } from "../../src/app/value.mjs";\nexport { value };\n', {
        filePath: 'tools/run/tool.mjs',
    });
    expect(fixed?.output).toBe('import { value } from "#src/app/value.mjs";\nexport { value };\n');
});

test('an import of a javascript.externals path gets no gspot/import-boundaries finding', async () => {
    const scopes = [{ path: 'web', configurations: ['javascript'] }];
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all', scopes }),
        'package.json': '{"private":true,"type":"module"}\n',
        'web/package.json': '{"private":true,"type":"module"}\n',
        'web/src/a.js': `import '${HOST_MODULE}';\n`,
    });
    const rules = ['gspot/import-boundaries'];
    const eslint = await createEslint(sandbox.path);
    expect(await listLintFindings(eslint, sandbox.path, ['web/src/a.js'], rules)).toStrictEqual([
        { file: 'web/src/a.js', rule: 'gspot/import-boundaries', line: 1 },
    ]);
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['javascript'], {
            level: 'all',
            scopes,
            tables: `[javascript]\nexternals = ["${HOST_MODULE}"]\n`,
        }),
    );
    const external = await createEslint(sandbox.path);
    expect(await listLintFindings(external, sandbox.path, ['web/src/a.js'], rules)).toStrictEqual([]);
});

test('javascript.import_boundaries keeps relative imports inside each folder, and --fix writes the alias', async () => {
    const files = {
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"paths":{"@/*":["./src/*"]}},"include":["src/**/*.ts"]}',
        'src/features/auth/session.ts': 'export const session = 1;\n',
        'src/features/account/page.ts': '',
    };
    const source = 'import { session } from "../auth/session.ts";\nexport { session };\n';
    const target = { filePath: 'src/features/account/page.ts' };
    const fix = { fix: ({ ruleId }: { ruleId: string | null }) => ruleId === 'gspot/import-boundaries' };
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
        ...files,
    });
    const open = await createEslint(sandbox.path, fix);
    const [unbounded] = await open.lintText(source, target);
    expect(unbounded?.output).toBeUndefined();
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['typescript'], {
            level: 'all',
            tables: '[javascript]\nimport_boundaries = ["src/features/*"]\n',
        }),
    );
    const bounded = await createEslint(sandbox.path, fix);
    const [fixed] = await bounded.lintText(source, target);
    expect(fixed?.output).toBe('import { session } from "@/features/auth/session.ts";\nexport { session };\n');
});
