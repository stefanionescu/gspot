import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { generatedEslint } from '#tests/harness/cli/generated.ts';

const APP_JEST = policyOf(
    ['javascript'],
    '[rules]\ninstall = false\n[architecture.roles]\nruntime = ["src/**"]\nharness = "tests/fixtures"\n[[scope]]\npath = "app"\nkits = ["jest"]\n[scope.tools.jest]\ntest_module = "bun:test"\n',
    'all',
);

test.each([
    ['recommended', 'bun:test', 2],
    ['all', 'bun:test', 2],
    ['recommended', '@jest/globals', 1],
    ['all', '@jest/globals', 1],
] as const)('generated %s lint validates the native expect arguments of %s', async (level, runtime, maximum) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': policyOf(['jest'], `[tools.jest]\ntest_module = "${runtime}"\n`, level),
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    const eslint = await generatedEslint(sandbox.path);
    const args = ['value', '"A custom failure message."', '"Unexpected argument."'];
    const defect = await eslint.lintText(
        `import { test, expect } from '${runtime}';\ntest('checks the value', () => { const value = 1; expect(${args.slice(0, maximum + 1).join(', ')}).toBe(1); });\n`,
        { filePath: 'sample.test.js' },
    );
    expect(
        defect.flatMap((file) => file.messages).filter((diagnostic) => diagnostic.ruleId === 'jest/valid-expect'),
    ).toHaveLength(1);
    const corrected = await eslint.lintText(
        `import { test, expect } from '${runtime}';\ntest('checks the value', () => { const value = 1; expect(${args.slice(0, maximum).join(', ')}).toBe(1); });\n`,
        { filePath: 'sample.test.js' },
    );
    expect(
        corrected.flatMap((file) => file.messages).filter((diagnostic) => diagnostic.ruleId === 'jest/valid-expect'),
    ).toStrictEqual([]);
});

test.each(['@jest/globals', 'bun:test'])(
    'generated ESLint reports a focused test for %s and accepts its correction',
    async (globalPackage) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': policyOf(
                ['jest'],
                `[rules]\ninstall = false\n[tools.jest]\ntest_module = "${globalPackage}"\n`,
                'all',
            ),
            'package.json': '{"private":true,"type":"module"}\n',
            'sample.test.js': '',
        });
        const eslint = await generatedEslint(sandbox.path);
        const prefix = `import { test, expect } from '${globalPackage}';\n`;
        const failed = await eslint.lintText(`${prefix}test.only("counts", () => { expect(1).toBe(1); });`, {
            filePath: 'sample.test.js',
        });
        expect(
            failed.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'jest/no-focused-tests'),
        ).toMatchObject([{ line: 2, severity: 2 }]);
        const fixed = await eslint.lintText(`${prefix}test("counts", () => { expect(1).toBe(1); });`, {
            filePath: 'sample.test.js',
        });
        expect(
            fixed
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'jest/no-focused-tests' || fatal),
        ).toStrictEqual([]);
    },
);

test.each(['js', 'jsx'])(
    'Jest rules and the harness folder apply only to their declared scope for %s',
    async (extension) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': APP_JEST,
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
        expect(
            root.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId?.startsWith('jest/') === true),
        ).toStrictEqual([]);
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
        ).toMatchObject([{ message: textContaining('app/tests/fixtures') }]);
        const harnessResults = await eslint.lintFiles(['app/tests/fixtures/helpers.js']);
        expect(
            harnessResults
                .flatMap((file) => file.messages)
                .filter(({ ruleId, fatal }) => ruleId === 'gspot/tests-directory-contents' || fatal),
        ).toStrictEqual([]);
        const runtime = await eslint.lintFiles(['app/src/runtime.js']);
        expect(
            runtime.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'gspot/import-direction'),
        ).toMatchObject([{ message: textContaining('Runtime code imports test code') }]);
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
