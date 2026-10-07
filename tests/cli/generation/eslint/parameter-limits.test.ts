import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';

for (const language of ['javascript', 'typescript']) {
    test.each([7, 8])(
        `ESLint for ${language} counts declared parameters with maximum %i${language === 'typescript' ? ' and does not count this' : ''}`,
        async (maximum) => {
            await using directory = await testdir();
            const extension = { javascript: 'js', typescript: 'ts' }[language]!;
            const source = [7, 8]
                .map((count) => {
                    const names = Array.from({ length: count }, (_, index) => `value${String(index)}`);
                    const name = count === 7 ? 'seven' : 'eight';
                    const parameters =
                        language === 'typescript' ? ['this: void', ...names.map((name) => `${name}: number`)] : names;
                    return `export function ${name}(${parameters.join(', ')}) { return ${names.join(' + ')}; }`;
                })
                .join('\n');
            // Seven declared parameters is the shipped default; the other row changes it.
            const limits = maximum === 7 ? '' : `[limits.${language}]\nfunction_parameters = ${String(maximum)}\n`;
            await createFileTree(directory.path, {
                'gspot.toml': buildPolicy([language], { tables: limits, level: 'all' }),
                'package.json': '{"private":true,"type":"module"}',
                'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["*.ts"]}',
                [`example.${extension}`]: source,
            });
            const eslint = await createEslint(directory.path);
            const results = await eslint.lintFiles([`example.${extension}`]);
            expect(
                results
                    .flatMap(({ messages }) => messages)
                    .filter(({ ruleId }) => ruleId === 'max-params')
                    .map(({ ruleId, line }) => ({ ruleId, line })),
            ).toStrictEqual(maximum === 7 ? [{ ruleId: 'max-params', line: 2 }] : []);
        },
    );
}
