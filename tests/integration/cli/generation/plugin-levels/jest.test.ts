import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { generatedEslint } from '#tests/support/cli/generated-eslint.ts';

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
    const eslint = await generatedEslint(sandbox.path);
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
    ).toStrictEqual([]);
});

const JEST_CASES = [
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
    ['expect-expect', 'test("counts", () => { const count = 1; });', 'test("counts", () => { expect(1).toBe(1); });'],
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
test.each(
    ['recommended', 'all'].flatMap((level) =>
        ['@jest/globals', 'bun:test'].flatMap((globalPackage) =>
            JEST_CASES.map(([rule, planted, corrected]) => ({ level, globalPackage, rule, planted, corrected })),
        ),
    ),
)(
    'generated $level ESLint reports jest/$rule for $globalPackage and accepts its correction',
    async ({ level, globalPackage, rule, planted, corrected }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `version = 1\nlevel = "${level}"\nconfigurations = ["jest"]\n[rules]\ninstall = false\n[tools.jest]\nglobal_package = "${globalPackage}"\n`,
            'package.json': '{"private":true,"type":"module"}\n',
            'sample.test.js': '',
        });
        const eslint = await generatedEslint(sandbox.path);
        const prefix = `import { describe, test, expect } from '${globalPackage}';\n`;
        const failed = await eslint.lintText(prefix + planted, { filePath: 'sample.test.js' });
        expect(failed.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === `jest/${rule}`)).toMatchObject(
            [{ line: 2, severity: 2 }],
        );
        const fixed = await eslint.lintText(prefix + corrected, { filePath: 'sample.test.js' });
        expect(
            fixed.flatMap((file) => file.messages).filter(({ ruleId, fatal }) => ruleId === `jest/${rule}` || fatal),
        ).toStrictEqual([]);
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
        const eslint = await generatedEslint(sandbox.path);
        const focused =
            "import { test, expect } from 'bun:test';\ntest.only('counts', () => { expect(1).toBe(1); });\n";
        const root = await eslint.lintText(focused, { filePath: `root.test.${extension}` });
        expect(root.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId?.startsWith('jest/'))).toStrictEqual(
            [],
        );
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
        ).toStrictEqual([]);
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
        ).toStrictEqual([]);
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
        ).toStrictEqual([]);
    },
);
