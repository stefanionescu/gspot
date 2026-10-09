import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';
import { SORT_CASES, SORT_RULES, SORT_LEVELS } from '#tests/config/cli/generation/eslint/layout.ts';

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

test.each(SORT_LEVELS)(
    'native sorting fixes $level root and child imports and exports',
    async ({ level, severity, enabled }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[scope."app"]\nconfigurations = ["typescript"]\n',
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'app/tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
            'src/source.ts': '',
            'app/src/source.ts': '',
        });
        const eslint = await createEslint(sandbox.path, {
            fix: ({ ruleId }) => SORT_RULES.includes(ruleId ?? '') || ruleId === 'gspot/header-first',
        });
        for (const prefix of ['', 'app/']) {
            const filePath = `${prefix}src/source.ts`;
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(filePath));
            expect(SORT_RULES.map((rule) => config.rules[rule]?.[0] ?? 0)).toStrictEqual(
                SORT_RULES.map(() => severity),
            );
            expect(config.rules['gspot/sort-imports']).toBeUndefined();
            expect(config.rules['gspot/sort-exports']).toBeUndefined();
            for (const { source, fixed } of SORT_CASES) {
                const [result] = await eslint.lintText(source, { filePath });
                expect(result?.fatalErrorCount).toBe(0);
                expect(result?.output ?? source).toBe(enabled ? fixed : source);
                expect(result!.messages.filter(({ ruleId }) => SORT_RULES.includes(ruleId ?? ''))).toStrictEqual([]);
            }
        }
    },
);
