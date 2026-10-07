import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { APP_JEST } from '#tests/config/cli/generation/eslint/jest.ts';

test.each([
    ['recommended', 'bun:test', 2],
    ['all', 'bun:test', 2],
    ['recommended', '@jest/globals', 1],
    ['all', '@jest/globals', 1],
] as const)('generated %s lint validates the native expect arguments of %s', async (level, runtime, maximum) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['jest'], { tables: `[tools.jest]\nglobals_module = "${runtime}"\n`, level: level }),
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
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

test.each(['@jest/globals', 'bun:test'])('generated ESLint reports a focused test for %s', async (globalPackage) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['jest'], {
            tables: `[agent_rules]\nenabled = false\n[tools.jest]\nglobals_module = "${globalPackage}"\n`,
            level: 'all',
        }),
        'package.json': '{"private":true,"type":"module"}\n',
        'sample.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const prefix = `import { test, expect } from '${globalPackage}';\n`;
    const failed = await eslint.lintText(`${prefix}test.only("counts", () => { expect(1).toBe(1); });`, {
        filePath: 'sample.test.js',
    });
    expect(
        failed.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'jest/no-focused-tests'),
    ).toMatchObject([{ line: 2, severity: 2 }]);
});

test.each(['js', 'jsx'])('Jest rules apply only to their declared scope for %s', async (extension) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': APP_JEST,
        'package.json': '{"private":true,"type":"module"}\n',
        'root.test.js': '',
        'app/sample.test.js': '',
    });
    const eslint = await createEslint(sandbox.path);
    const focused = "import { test, expect } from 'bun:test';\ntest.only('counts', () => { expect(1).toBe(1); });\n";
    const root = await eslint.lintText(focused, { filePath: `root.test.${extension}` });
    expect(
        root.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId?.startsWith('jest/') === true),
    ).toStrictEqual([]);
    const nested = await eslint.lintText(focused, { filePath: `app/sample.test.${extension}` });
    expect(
        nested.flatMap((file) => file.messages).filter(({ ruleId }) => ruleId === 'jest/no-focused-tests'),
    ).toMatchObject([{ line: 2 }]);
});
