import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { getSuggestions } from '#cli/commands/doctor/suggestions.ts';
import type { RuntimeConfiguration } from '#tests/types/generation/configuration-files.ts';

import {
    FRAMEWORK_FILES,
    REMOVED_ZOD_RULES,
    ALL_SECURITY_RULES,
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
