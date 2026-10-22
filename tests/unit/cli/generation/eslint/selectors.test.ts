import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LEVELS } from '#cli/config/configurations.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { SELECTOR_FILES } from '#tests/data/generation/eslint/selectors.ts';
import { createEslint, listLintFindings } from '#tests/setup/eslint/lint.ts';

test('a template message to a logger method, including log, is reported, and console.log is not', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], { level: 'all' }),
        'package.json': '{"private":true,"type":"module"}\n',
        'source.js':
            'export function report(logger, count) {\n    logger.log(`Saved ${count}`);\n    logger.info(`Read ${count}`);\n    console.log(`Printed ${count}`);\n}\n',
    });

    const eslint = await createEslint(sandbox.path);
    const [result] = await eslint.lintFiles(['source.js']);
    expect(
        result?.messages
            .filter(({ ruleId, message }) => ruleId === 'no-restricted-syntax' && message.startsWith('Log a stable'))
            .map(({ line }) => line),
    ).toStrictEqual([2, 3]);
});
test.each([...LEVELS])(
    'React Native and react-hook-form syntax selectors report only at level all (%s)',
    async (level) => {
        await using sandbox = await testdir({
            ...SELECTOR_FILES,
            'gspot.toml': buildSandboxSettings(['javascript'], {
                level,
                rules: true,
                scopes: [
                    { path: 'native', configurations: ['react-native'] },
                    { path: 'forms', configurations: ['react', 'react-hook-form'] },
                ],
            }),
        });

        const eslint = await createEslint(sandbox.path);
        expect(
            await listLintFindings(
                eslint,
                sandbox.path,
                ['native/App.jsx', 'forms/Fields.jsx'],
                ['no-restricted-syntax'],
            ),
        ).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'forms/Fields.jsx', rule: 'no-restricted-syntax', line: 3 },
                      { file: 'native/App.jsx', rule: 'no-restricted-syntax', line: 2 },
                  ]
                : [],
        );
    },
);
