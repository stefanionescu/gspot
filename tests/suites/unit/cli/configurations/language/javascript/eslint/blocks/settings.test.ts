import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildEslint, readEslintRules, listLintFindings } from '#tests/setup/eslint/lint.ts';
import { DUPLICATE_RULE_CASES, DUPLICATE_RULE_FILES } from '#tests/config/configurations/javascript/blocks.ts';

test.each([...DUPLICATE_RULE_CASES])(
    'each pair of duplicate rules reports a defect once, from the kept rule ($kept)',
    async ({ file, rules, kept }) => {
        await using sandbox = await testdir({
            ...DUPLICATE_RULE_FILES,
            'gspot.toml': buildSandboxSettings(['typescript'], { level: 'all' }),
            ...Object.fromEntries(DUPLICATE_RULE_CASES.map(({ file, source }) => [file, source])),
        });

        const eslint = await buildEslint(sandbox.path);

        const reports = await listLintFindings(eslint, sandbox.path, [file], rules);
        expect(
            reports.map(({ rule }) => rule),
            file,
        ).toStrictEqual([kept]);
    },
);

test('the src files of a Vite app may read only VITE_ variables, and its other files may read any', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript', 'vue']),
        'package.json': '{"private":true,"type":"module","devDependencies":{"vite":"0.0.0-test"}}',
        'src/main.ts': 'export const value = 1;\n',
        'src/App.vue': '<template><p>Hello</p></template>\n',
        'vite.config.ts': 'export default {};\n',
        'server/src/main.ts': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['src/main.ts', 'src/App.vue', 'vite.config.ts', 'server/src/main.ts']);
    for (const file of ['src/main.ts', 'src/App.vue'])
        expect(rules[file]!['gspot/no-client-env']).toStrictEqual([
            2,
            { client: true, publicPrefixes: ['VITE_'], allowedNames: ['NODE_ENV'] },
        ]);
    expect(rules['vite.config.ts']!['gspot/no-client-env']?.[1]).toMatchObject({ client: false });
    expect(rules['server/src/main.ts']!['gspot/no-client-env']?.[1]).toMatchObject({ client: false });
});

test('only the scope that depends on vite gets the VITE_ prefix', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            scopes: [{ path: 'web', configurations: ['typescript'] }],
        }),
        'package.json': '{"private":true,"type":"module"}',
        'src/main.ts': 'export const value = 1;\n',
        'web/package.json': '{"private":true,"type":"module","devDependencies":{"vite":"0.0.0-test"}}',
        'web/src/main.ts': 'export const value = 1;\n',
    });
    const eslint = await buildEslint(sandbox.path);
    const rules = await readEslintRules(eslint, ['src/main.ts', 'web/src/main.ts']);
    expect(rules['src/main.ts']!['gspot/no-client-env']?.[1]).toMatchObject({ client: false });
    expect(rules['web/src/main.ts']!['gspot/no-client-env']?.[1]).toMatchObject({
        client: true,
        publicPrefixes: ['VITE_'],
    });
});
