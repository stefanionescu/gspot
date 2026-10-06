import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

test.each(['recommended', 'all'])('generated %s ESLint configuration selects layout by level', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: level }),
        'package.json': '{"name":"layout-consumer","private":true,"type":"module"}',
        'src/order.ts': 'export const value = 1;\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintText('export const value = 1;\nconst internal = 2;\nconsole.log(internal);\n', {
        filePath: 'src/order.js',
    });
    expect(result?.fatalErrorCount).toBe(0);
    const layout = result!.messages.filter((diagnostic) => diagnostic.ruleId === 'import-x/exports-last');
    // The layout rule belongs to the all level alone.
    expect(layout.map(({ ruleId, line }) => ({ ruleId, line }))).toStrictEqual(
        level === 'recommended' ? [] : [{ ruleId: 'import-x/exports-last', line: 1 }],
    );
});
