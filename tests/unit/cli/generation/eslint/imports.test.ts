import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import type { EslintConfiguration } from '#tests/types/tool-output.ts';
import { createEslint, collectLintFindings } from '#tests/setup/tool-files.ts';
import { SORT_CASES, SORT_RULES } from '#tests/data/generation/eslint/sorting.ts';

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
    expect(await collectLintFindings(eslint, sandbox.path, ['source.js'], rules)).toStrictEqual([
        { file: 'source.js', rule: 'n/file-extension-in-import', line: 1 },
    ]);
    expect(await collectLintFindings(eslint, sandbox.path, ['app/source.js'], rules)).toStrictEqual([]);
});

test.each([...LEVELS])(
    'imports and exports are sorted at level all only, in root and child scopes ($level)',
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
            const config = (await eslint.calculateConfigForFile(filePath)) as EslintConfiguration;
            expect(SORT_RULES.map((rule) => config.rules[rule]?.[0] ?? 0)).toStrictEqual(
                SORT_RULES.map(() => (level === 'all' ? 2 : 0)),
            );
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
        'app/lib.mjs': 'export const lib = 1;\n',
        'app/source.js': '',
        'app/tool.mjs': '',
    });

    const eslint = await createEslint(sandbox.path, { fix: true });
    const rules = ['n/file-extension-in-import'];
    const bundled =
        'import "./styles.css";\nimport data from "./data.json" with { type: "json" };\nimport { value } from "./value";\nexport { data, value };\n';
    const script = 'import { lib } from "./lib.mjs";\nexport { lib };\n';
    await createFileTree(sandbox.path, { 'app/source.js': bundled, 'app/tool.mjs': script });
    expect(await collectLintFindings(eslint, sandbox.path, ['app/source.js', 'app/tool.mjs'], rules)).toStrictEqual([]);
    const [fixed] = await eslint.lintText('import { value } from "./value.js";\nexport { value };\n', {
        filePath: 'app/source.js',
    });
    expect(fixed?.output).toBe('import { value } from "./value";\nexport { value };\n');
    const [kept] = await eslint.lintText('import { lib } from "./lib";\nexport { lib };\n', {
        filePath: 'app/tool.mjs',
    });
    expect(kept?.output).toBe('import { lib } from "./lib.mjs";\nexport { lib };\n');
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

test('import-x never parses a gitignored bundle that code imports', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript']),
        '.gitignore': 'node_modules/\n.open-next/\n',
        'worker.js': '',
    });

    readGitOutput(sandbox.path, ['init', '-q']);
    readGitOutput(sandbox.path, ['add', '--', '.gitignore', 'worker.js', 'gspot.toml']);
    const eslint = await createEslint(sandbox.path);
    const config = (await eslint.calculateConfigForFile('worker.js')) as { settings: Record<string, unknown> };
    const ignored = (config.settings['import-x/ignore'] as string[]).map((source) => new RegExp(source, 'u'));
    expect(ignored.some((pattern) => pattern.test(`${sandbox.path}/.open-next/worker.js`))).toBe(true);
    expect(ignored.some((pattern) => pattern.test(`${sandbox.path}/worker.js`))).toBe(false);
});
