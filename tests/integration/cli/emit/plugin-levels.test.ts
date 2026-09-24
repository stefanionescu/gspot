import { join } from 'node:path';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { ESLint } from 'eslint';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/emit/targets.ts';
import { openSession } from '#cli/run/session.ts';

const modules = join(import.meta.dir, '../../../../node_modules');

test.each(['recommended', 'all'])('generated %s lint enforces size limits in test files', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[limits]\nfile_lines = 8\nfunction_lines = 5\nstatements = 3\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    const config = emitAll(await openSession(sandbox.path)).files.find(
        (file) => file.path === '.gspot/config/eslint.config.mjs',
    )!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
    const rules = ['max-lines', 'max-lines-per-function', 'max-statements'];
    const source = `export function count() {\n${Array.from({ length: 9 }, (_, index) => `    const value${index} = ${index};`).join('\n')}\n    return value0;\n}\n`;
    const defect = await eslint.lintText(source, { filePath: 'sample.test.js' });
    for (const rule of rules)
        expect(defect.flatMap((file) => file.messages).some((message) => message.ruleId === rule)).toBe(true);
    const corrected = await eslint.lintText('export function count() { return 1; }\n', {
        filePath: 'sample.test.js',
    });
    expect(
        corrected.flatMap((file) => file.messages).filter((message) => rules.includes(message.ruleId ?? '')),
    ).toEqual([]);
});

test.each([
    ['recommended', 'bun:test', 2],
    ['all', 'bun:test', 2],
    ['recommended', '@jest/globals', 1],
    ['all', '@jest/globals', 1],
] as const)('generated %s lint validates the native expect arguments of %s', async (level, runtime, maximum) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["jest"]\n[tools.jest]\nglobal_package = "${runtime}"\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    const config = emitAll(await openSession(sandbox.path)).files.find(
        (file) => file.path === '.gspot/config/eslint.config.mjs',
    )!;
    await Bun.write(join(sandbox.path, config.path), config.content);
    const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
    const args = ['value', '"A custom failure message."', '"Unexpected argument."'];
    const source = (count: number) =>
        `import { test, expect } from '${runtime}';\ntest('checks the value', () => { const value = 1; expect(${args.slice(0, count).join(', ')}).toBe(1); });\n`;
    const defect = await eslint.lintText(source(maximum + 1), { filePath: 'sample.test.js' });
    expect(
        defect.flatMap((file) => file.messages).filter((message) => message.ruleId === 'jest/valid-expect'),
    ).toHaveLength(1);
    const corrected = await eslint.lintText(source(maximum), { filePath: 'sample.test.js' });
    expect(
        corrected.flatMap((file) => file.messages).filter((message) => message.ruleId === 'jest/valid-expect'),
    ).toEqual([]);
});

test.each([
    ['recommended', 'client.js'],
    ['recommended', 'app/client.js'],
    ['all', 'client.js'],
    ['all', 'app/client.js'],
] as const)('generated %s ESLint retains client defects and makes aliases opt-in for %s', async (level, filePath) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = []\n`,
        'package.json': '{"private":true,"type":"module"}\n',
        'client.js': '',
        'other.js': '',
        'app/client.js': '',
    });
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    const output = emitAll(await openSession(sandbox.path));
    const config = output.files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    writeFileSync(join(sandbox.path, config.path), config.content);
    const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
    const finding = await eslint.lintText("'use client';\nexport const value = process.env.SECRET;\n", {
        filePath,
    });
    expect(
        finding.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/no-client-environment'),
    ).toMatchObject([{ line: 2, messageId: 'private' }]);
    const alias = await eslint.lintText('const source = 1;\nexport const publicName = source;\n', {
        filePath,
    });
    expect(
        alias
            .flatMap((file) => file.messages)
            .filter(({ ruleId }) => ruleId === 'gspot/no-exported-alias-constants')
            .map(({ line, column, messageId }) => ({ line, column, messageId })),
    ).toEqual(level === 'recommended' ? [] : [{ line: 2, column: 14, messageId: 'alias' }]);
    const corrected = await eslint.lintText("'use client';\nexport const value = 'public';\n", {
        filePath,
    });
    expect(
        corrected
            .flatMap((file) => file.messages)
            .filter(
                ({ ruleId }) =>
                    ruleId === 'gspot/no-client-environment' || ruleId === 'gspot/no-exported-alias-constants',
            ),
    ).toEqual([]);
});

test.each(['recommended', 'all'])(
    'generated %s ESLint permits JavaScript type documentation and rejects duplicate TypeScript type tags',
    async (level) => {
        await using sandbox = await testdir();
        const description =
            '/**\n * Measure the input.\n * @param {string} value The input text.\n * @returns {number} The input length.\n */\n';
        const typescript = 'export function measure(value: string): number { return value.length; }\n';
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["typescript"]\n[rules]\ninstall = false\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["client.ts"]}\n',
            'client.ts': description + typescript,
            'client.js': description + 'export function measure(value) { return value.length; }\n',
        });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const config = emitAll(await openSession(sandbox.path)).files.find(
            (file) => file.path === '.gspot/config/eslint.config.mjs',
        )!;
        mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(sandbox.path, config.path), config.content);
        const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
        const javascript = await eslint.lintFiles(['client.js']);
        expect(
            javascript
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jsdoc/no-types' || fatal),
        ).toEqual([]);
        const planted = await eslint.lintFiles(['client.ts']);
        expect(
            planted.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'jsdoc/no-types'),
        ).toMatchObject([{ line: 3 }, { line: 4 }]);
        const corrected = await eslint.lintText(
            description.replace('{string} ', '').replace('{number} ', '') + typescript,
            { filePath: 'client.ts' },
        );
        expect(
            corrected
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jsdoc/no-types' || fatal),
        ).toEqual([]);
    },
);

test.each(['recommended', 'all'])(
    'generated %s Jest rules report each required defect for Jest and Bun imports',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["jest"]\n[rules]\ninstall = false\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'sample.test.js': '',
        });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
        const cases = [
            [
                'no-focused-tests',
                'test.only("counts", () => { expect(1).toBe(1); });',
                'test("counts", () => { expect(1).toBe(1); });',
            ],
            [
                'no-disabled-tests',
                'test.skip("counts", () => { expect(1).toBe(1); });',
                'test("counts", () => { expect(1).toBe(1); });',
            ],
            [
                'no-identical-title',
                'test("counts", () => { expect(1).toBe(1); }); test("counts", () => { expect(2).toBe(2); });',
                'test("counts one", () => { expect(1).toBe(1); }); test("counts two", () => { expect(2).toBe(2); });',
            ],
            ['no-standalone-expect', 'expect(1).toBe(1);', 'test("counts", () => { expect(1).toBe(1); });'],
            [
                'no-commented-out-tests',
                '// test("counts", () => { expect(1).toBe(1); });',
                'test("counts", () => { expect(1).toBe(1); });',
            ],
            [
                'expect-expect',
                'test("counts", () => { const count = 1; });',
                'test("counts", () => { expect(1).toBe(1); });',
            ],
            [
                'valid-describe-callback',
                'describe("counting", async () => { test("counts", () => { expect(1).toBe(1); }); });',
                'describe("counting", () => { test("counts", () => { expect(1).toBe(1); }); });',
            ],
            [
                'no-conditional-expect',
                'test("counts", () => { if (Date.now() > 0) expect(1).toBe(1); });',
                'test("counts", () => { expect(1).toBe(1); });',
            ],
            ['valid-expect', 'test("counts", () => { expect(1); });', 'test("counts", () => { expect(1).toBe(1); });'],
            [
                'prefer-strict-equal',
                'test("counts", () => { expect({ count: 1 }).toEqual({ count: 1 }); });',
                'test("counts", () => { expect({ count: 1 }).toStrictEqual({ count: 1 }); });',
            ],
        ] as const;
        for (const globalPackage of ['@jest/globals', 'bun:test']) {
            writeFileSync(
                join(sandbox.path, 'gspot.toml'),
                `version = 1\nlevel = "${level}"\nconfigurations = ["jest"]\n[rules]\ninstall = false\n[tools.jest]\nglobal_package = "${globalPackage}"\n`,
            );
            const config = emitAll(await openSession(sandbox.path)).files.find(
                (file) => file.path === '.gspot/config/eslint.config.mjs',
            )!;
            const path = join(
                sandbox.path,
                '.gspot',
                globalPackage === 'bun:test' ? 'bun-eslint.config.mjs' : 'jest-eslint.config.mjs',
            );
            writeFileSync(path, config.content);
            const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: path });
            for (const [rule, planted, corrected] of cases) {
                const prefix = `import { describe, test, expect } from '${globalPackage}';\n`;
                const failed = await eslint.lintText(prefix + planted, { filePath: 'sample.test.js' });
                expect(
                    failed.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === `jest/${rule}`),
                    `${globalPackage}: ${rule}`,
                ).not.toEqual([]);
                const fixed = await eslint.lintText(prefix + corrected, { filePath: 'sample.test.js' });
                expect(
                    fixed
                        .flatMap((file) => file.messages)
                        .filter(({ ruleId, fatal }) => ruleId === `jest/${rule}` || fatal),
                    `${globalPackage}: ${rule}`,
                ).toEqual([]);
            }
        }
    },
);

test.each(['js', 'jsx'])(
    'Jest rules and support-directory settings apply only to their declared scope for %s',
    async (extension) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml':
                'version = 1\nlevel = "all"\nconfigurations = ["javascript"]\n[rules]\ninstall = false\n[[scope]]\npath = "app"\nconfigurations = ["jest"]\n[scope.tools.jest]\nglobal_package = "bun:test"\nharness_directory = "tests/fixtures"\n',
            'package.json': '{"private":true,"type":"module"}\n',
            'root.test.js': '',
            'app/sample.test.js': '',
            'app/tests/fixtures/helpers.js': 'export const value = 1;\n',
            'app/tests/fixtures/example.test.js': '',
            'app/tests/unit/helpers.js': 'export const value = 1;\n',
            'app/tests/unit/example.test.js': '',
            'app/src/runtime.js':
                'import { value } from "../tests/fixtures/helpers.js"; export const result = value + 1;\n',
        });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const config = emitAll(await openSession(sandbox.path)).files.find(
            (file) => file.path === '.gspot/config/eslint.config.mjs',
        )!;
        mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
        writeFileSync(join(sandbox.path, config.path), config.content);
        const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
        const focused =
            "import { test, expect } from 'bun:test';\ntest.only('counts', () => { expect(1).toBe(1); });\n";
        const root = await eslint.lintText(focused, { filePath: `root.test.${extension}` });
        expect(root.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId?.startsWith('jest/'))).toEqual([]);
        const nested = await eslint.lintText(focused, { filePath: `app/sample.test.${extension}` });
        expect(
            nested.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'jest/no-focused-tests'),
        ).toMatchObject([{ line: 2 }]);
        const corrected = await eslint.lintText(focused.replace('test.only(', 'test('), {
            filePath: `app/sample.test.${extension}`,
        });
        expect(
            corrected
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jest/no-focused-tests' || fatal),
        ).toEqual([]);
        const misplaced = await eslint.lintFiles(['app/tests/unit/helpers.js']);
        expect(
            misplaced
                .flatMap((file) => file.messages)
                .filter(({ ruleId }) => ruleId === 'gspot/tests-directory-contents'),
        ).toMatchObject([{ message: expect.stringContaining('app/tests/fixtures') }]);
        const support = await eslint.lintFiles(['app/tests/fixtures/helpers.js']);
        expect(
            support
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'gspot/tests-directory-contents' || fatal),
        ).toEqual([]);
        const runtime = await eslint.lintFiles(['app/src/runtime.js']);
        expect(
            runtime.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/import-direction'),
        ).toMatchObject([{ message: expect.stringContaining('Runtime code imports test code') }]);
        const correctedRuntime = await eslint.lintText('export const result = 2;\n', {
            filePath: 'app/src/runtime.js',
        });
        expect(
            correctedRuntime
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'gspot/import-direction' || fatal),
        ).toEqual([]);
    },
);

test.each(['recommended', 'all'])(
    'generated %s structural rules include declared root and nested entries',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["javascript"]\n[tools.knip]\nentry = ["main.js"]\n[[scope]]\npath = "app"\nconfigurations = []\n[scope.tools.knip]\nentry = ["main.js"]\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'main.js': '',
            'app/main.js': '',
        });
        symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
        const config = emitAll(await openSession(sandbox.path)).files.find(
            (file) => file.path === '.gspot/config/eslint.config.mjs',
        )!;
        await Bun.write(join(sandbox.path, config.path), config.content);
        const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
        for (const filePath of ['main.js', 'app/main.js']) {
            const defect = await eslint.lintText('export function start() { return launch(); }', { filePath });
            const rules = defect.flatMap((file) => file.messages).map((message) => message.ruleId);
            expect(rules).toContain('gspot/no-trivial-files');
            expect(rules).toContain('gspot/no-trivial-functions');
            const corrected = await eslint.lintText(
                'export function start() { const app = launch(); app.configure(); return app.run(); }',
                { filePath },
            );
            expect(
                corrected
                    .flatMap((file) => file.messages)
                    .filter(
                        ({ ruleId }) => ruleId === 'gspot/no-trivial-files' || ruleId === 'gspot/no-trivial-functions',
                    ),
            ).toEqual([]);
        }
    },
);
