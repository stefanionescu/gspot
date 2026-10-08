import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { getSuggestions } from '#cli/commands/doctor/contracts.ts';
import type { RuntimeConfiguration } from '#tests/types/generation/configuration-files.ts';

import {
    FRAMEWORK_FILES,
    REMOVED_ZOD_RULES,
    ALL_SECURITY_RULES,
    COMPONENT_PARSER_FILES,
} from '#tests/config/cli/generation/eslint/framework.ts';

test.each(['recommended', 'all'] as const)(
    'framework selectors preserve native conventions and security levels: %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...FRAMEWORK_FILES,
            'gspot.toml': `level = "${level}"\nconfigurations = ["javascript"]\n[scope.native]\nconfigurations = ["react-native"]\n[scope.forms]\nconfigurations = ["react", "react-hook-form"]\n[scope.schema]\nconfigurations = ["zod"]\n[scope.app]\nconfigurations = ["nextjs"]\n`,
        });
        const eslint = await createEslint(sandbox.path);
        const root = (await eslint.calculateConfigForFile('source.js')) as RuntimeConfiguration;
        for (const rule of ALL_SECURITY_RULES) expect(root.rules[rule]![0], rule).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['sonarjs/no-hardcoded-passwords']![0]).toBe(0);
        expect(root.rules['sonarjs/no-hardcoded-secrets']![0]).toBe(0);
        const schema = (await eslint.calculateConfigForFile('schema/source.js')) as RuntimeConfiguration;
        for (const rule of REMOVED_ZOD_RULES) expect(schema.rules[rule], rule).toBeUndefined();
        const results = await eslint.lintFiles(['native/App.jsx', 'forms/Fields.jsx']);
        expect(
            results.map(({ messages }) =>
                messages.filter(({ ruleId }) => ruleId === 'no-restricted-syntax').map(({ line }) => line),
            ),
        ).toStrictEqual(level === 'all' ? [[2], [3]] : [[], []]);
    },
);

test('Next.js server-only rules use the retained explicit server paths', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...FRAMEWORK_FILES,
        'gspot.toml': 'level = "all"\nconfigurations = ["javascript"]\n[scope.app]\nconfigurations = ["nextjs"]\n',
    });
    const eslint = await createEslint(sandbox.path);
    const suggestions = getSuggestions(await openSession(sandbox.path)).suggested.map(
        ({ configuration }) => configuration,
    );
    expect(suggestions).toContain('css');
    expect(suggestions).not.toContain('i18n');
    const results = await eslint.lintFiles([
        'app/lib/widget/server.js',
        'app/lib/widget/data.server.js',
        'app/server/data.js',
    ]);
    expect(
        results.map(({ messages }) =>
            messages.filter(({ ruleId }) => ruleId === 'gspot/require-server-only').map(({ line }) => line),
        ),
    ).toStrictEqual([[], [1], [1]]);
});

test.each(['recommended', 'all'] as const)(
    '%s tRPC procedure checks use declared router roles without crossing scopes',
    async (level) => {
        await using sandbox = await testdir();
        const checked = new Set([
            'custom/action.ts',
            'routers/default.ts',
            'child/handlers/action.ts',
            'inherited/routers/action.ts',
        ]);
        const unchecked = [
            'outside/action.ts',
            'child/custom/action.ts',
            'inherited/custom/action.ts',
            'plain/routers/action.ts',
        ];
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['trpc', 'typescript'], {
                level,
                tables: `[agent_rules]
enabled = false
[architecture.roles]
routers = ["custom/**"]
[scope.child.architecture.roles]
routers = ["handlers/**"]
[scope.inherited]
[scope.plain]
removed_configurations = ["trpc"]
`,
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true,"noEmit":true},"include":["**/*.ts"]}',
            ...Object.fromEntries(
                [...checked, ...unchecked].map((file) => [
                    file,
                    'procedure.query(() => 1);\nprocedure.input(schema).query(() => 1);\n',
                ]),
            ),
        });
        const eslint = await createEslint(sandbox.path);
        for (const file of [...checked, ...unchecked]) {
            const results = await eslint.lintFiles([file]);
            expect(
                results.flatMap((result) => result.messages).filter(({ fatal }) => fatal),
                file,
            ).toStrictEqual([]);
            expect(
                results
                    .flatMap((result) => result.messages)
                    .filter(
                        ({ message }) =>
                            message ===
                            'Give the procedure an input schema before its resolver, even when the input is nothing.',
                    )
                    .map(({ line }) => line),
                file,
            ).toStrictEqual(level === 'all' && checked.has(file) ? [1] : []);
        }
    },
);

test.each(['recommended', 'all'] as const)(
    '%s component extension declarations select native parsers without plain-scope rule leakage',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildPolicy(['javascript', 'typescript', 'vue', 'svelte', 'astro'], {
                level,
                tables: '[scope.app]\n[scope.plain]\nremoved_configurations = ["vue", "svelte", "astro"]\n',
            }),
            'package.json': '{"private":true,"type":"module"}',
            'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["**/*"]}',
            ...COMPONENT_PARSER_FILES,
            ...Object.fromEntries(Object.entries(COMPONENT_PARSER_FILES).map(([path, text]) => [`app/${path}`, text])),
            'plain/Card.vue': COMPONENT_PARSER_FILES['Card.vue'],
            'plain/source.js': COMPONENT_PARSER_FILES['source.js'],
        });
        const eslint = await createEslint(sandbox.path);
        for (const prefix of ['', 'app/']) {
            const results = await eslint.lintFiles(
                Object.keys(COMPONENT_PARSER_FILES).map((path) => `${prefix}${path}`),
            );
            expect(results.flatMap(({ messages }) => messages.filter(({ fatal }) => fatal))).toStrictEqual([]);
            const vue = (await eslint.calculateConfigForFile(`${prefix}Card.vue`)) as RuntimeConfiguration;
            expect(vue.rules['vue/no-v-html']).toBeDefined();
        }
        const plain = (await eslint.calculateConfigForFile('plain/Card.vue')) as RuntimeConfiguration;
        expect(
            Object.entries(plain.rules).filter(([name, rule]) => name.startsWith('vue/') && rule[0] !== 0),
        ).toStrictEqual([]);
        const script = (await eslint.calculateConfigForFile('plain/source.js')) as RuntimeConfiguration;
        expect(
            Object.entries(script.rules).filter(
                ([name, rule]) => /^(?:vue|svelte|astro)\//u.test(name) && rule[0] !== 0,
            ),
        ).toStrictEqual([]);
    },
);

test.each(['3.25.76', '4.6.2'])(
    'Zod %s omits the three removed rules and keeps retained schema rules',
    async (version) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'level = "all"\nconfigurations = ["zod"]\n',
            'package.json': JSON.stringify({ private: true, dependencies: { zod: version } }),
            'source.js': 'import { z } from "zod";\nexport const schema = z.object({ value: z.any() });\n',
        });
        const eslint = await createEslint(sandbox.path);
        const computed = (await eslint.calculateConfigForFile('source.js')) as RuntimeConfiguration;
        for (const rule of REMOVED_ZOD_RULES) expect(computed.rules[rule], rule).toBeUndefined();
        expect(computed.rules['zod/no-any-schema']![0]).toBe(2);
        expect(computed.rules['zod/prefer-strict-object']![0]).toBe(2);
        const results = await eslint.lintFiles(['source.js']);
        expect(
            results.flatMap(({ messages }) =>
                messages.filter(({ ruleId }) => ruleId?.startsWith('zod/') === true).map(({ ruleId }) => ruleId),
            ),
        ).toStrictEqual(['zod/no-any-schema']);
    },
);
