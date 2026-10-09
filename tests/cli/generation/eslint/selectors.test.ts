import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/harness/generated.ts';
import { selectorGroups } from '#cli/generation/eslint/public.ts';
import type { RuntimeConfiguration } from '#tests/types/cli/generation/configuration-files.ts';

import {
    STORE,
    RAW_SQL,
    INJECTED,
    PROCEDURE,
    LEVEL_RULES,
    ALIAS_IMPORT,
    RESPONSE_MESSAGES,
} from '#tests/config/cli/generation/eslint/selectors.ts';

test('general selectors form one group for every code file, in first-mention order', () => {
    expect(selectorGroups([STORE, PROCEDURE])).toStrictEqual([{ selectors: [STORE, PROCEDURE] }]);
});

test('an allowed path set gets its own group without the selector that allows it', () => {
    const groups = selectorGroups([STORE, { ...RAW_SQL, except: ['db/migrations/**'] }]);
    expect(groups).toStrictEqual([
        { files: [['db/migrations/**']], selectors: [STORE] },
        { ignores: ['db/migrations/**'], selectors: [STORE, RAW_SQL] },
    ]);
});

test('a selector with files applies there together with the general ones', () => {
    const controllers = ['**/*.controller.ts'];
    const routers = ['**/routers/**/*.ts'];
    const groups = selectorGroups([
        STORE,
        { ...INJECTED, files: controllers },
        { ...PROCEDURE, files: routers },
        { ...RAW_SQL, files: controllers },
    ]);
    expect(groups).toStrictEqual([
        { files: [['**/*.controller.ts', '**/routers/**/*.ts']], selectors: [STORE, INJECTED, PROCEDURE, RAW_SQL] },
        { files: [['**/*.controller.ts']], ignores: routers, selectors: [STORE, INJECTED, RAW_SQL] },
        { files: [['**/routers/**/*.ts']], ignores: controllers, selectors: [STORE, PROCEDURE] },
        { ignores: [...controllers, ...routers], selectors: [STORE] },
    ]);
});

test('an empty allowed list adds no group', () => {
    expect(selectorGroups([{ ...RAW_SQL, except: [] }])).toStrictEqual([{ selectors: [RAW_SQL] }]);
});

test.each(['recommended', 'all'] as const)(
    'Express selectors and native rule owners retain their level: %s',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "${level}"\nconfigurations = ["javascript"]\n[tools.eslint]\nimport_extensions = {"**/*" = "js"}\n[scope.api]\nconfigurations = ["express"]\n`,
            'package.json': '{"private":true,"type":"module","imports":{"#owner":"./owner.js"}}',
            'owner.js': 'export const value = 1;',
            'source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
            'api/source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
            'api/child/source.js': ALIAS_IMPORT + RESPONSE_MESSAGES,
        });
        const eslint = await createEslint(sandbox.path);
        const root = (await eslint.calculateConfigForFile('source.js')) as RuntimeConfiguration;
        const express = (await eslint.calculateConfigForFile('api/source.js')) as RuntimeConfiguration;
        for (const [name, severity] of Object.entries(LEVEL_RULES)) expect(root.rules[name]![0], name).toBe(severity);
        expect(root.rules['security/detect-buffer-noassert']).toBeUndefined();
        expect(root.rules['security/detect-no-csrf-before-method-override']).toBeUndefined();
        expect(express.rules['security/detect-no-csrf-before-method-override']![0]).toBe(2);
        expect(root.rules['no-param-reassign']![0]).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['security/detect-child-process']![0]).toBe(level === 'all' ? 2 : 0);
        expect(root.rules['security/detect-possible-timing-attacks']![0]).toBe(level === 'all' ? 2 : 0);
        const results = await eslint.lintFiles(['source.js', 'api/source.js', 'api/child/source.js']);
        expect(
            results.map(({ messages }) =>
                messages.filter(({ ruleId }) => ruleId === 'no-restricted-syntax').map(({ line }) => line),
            ),
        ).toStrictEqual(
            level === 'all'
                ? [
                      [1, 3],
                      [1, 2, 3],
                      [1, 2, 3],
                  ]
                : [[1], [1], [1]],
        );
    },
);
