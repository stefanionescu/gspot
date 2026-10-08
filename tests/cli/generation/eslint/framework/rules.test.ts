// Framework manifests own shared-rule overrides. React Native disables DOM accessibility rules while React retains them.
import { test, expect } from 'bun:test';
import type { ESLint, Linter } from 'eslint';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/harness/generated.ts';
import type { ComputedEslint } from '#tests/types/generation/configuration-files.ts';

async function configuredRules(policy: string, files: string[]): Promise<Record<string, Record<string, unknown[]>>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"\n${policy}\n[agent_rules]\nenabled = false\n`,
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"react":"19.1.1"}}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"},"include":["src"]}\n',
        ...Object.fromEntries(files.map((file) => [file, 'export const App = (): string => "app";\n'])),
    });
    const eslint = await createEslint(sandbox.path);
    const results: Record<string, Record<string, unknown[]>> = {};
    for (const file of files) {
        const computed = (await eslint.calculateConfigForFile(file)) as ComputedEslint;
        results[file] = computed.rules;
    }
    return results;
}

// The Testing Library rules a lint reports, with their lines.
function testingLibraryMessages(results: ESLint.LintResult[]): Pick<Linter.LintMessage, 'ruleId' | 'line'>[] {
    return results.flatMap(({ messages }) =>
        messages
            .filter(({ ruleId }) => ruleId?.startsWith('testing-library/') === true)
            .map(({ ruleId, line }) => ({ ruleId, line })),
    );
}

test('React Native turns off DOM accessibility rules only inside its scope', async () => {
    const rules = await configuredRules(
        'configurations = ["react-dom", "typescript"]\n[scope."native"]\nconfigurations = ["react-native"]',
        ['native/App.tsx', 'web/App.tsx'],
    );
    expect(rules['native/App.tsx']!['jsx-a11y/alt-text']).toBeUndefined();
    expect(rules['web/App.tsx']!['jsx-a11y/alt-text']![0]).toBe(2);
});

test.each(['none', 'index-only'])(
    'Next.js entry exclusions respect reexports = %s and nested scope ownership',
    async (reexports) => {
        const rules = await configuredRules(
            `configurations = ["typescript"]\n[structure]\nreexports = "${reexports}"\n[scope."app"]\nconfigurations = ["nextjs"]`,
            ['app/page.tsx', 'app/format.ts', 'library/page.tsx'],
        );
        expect(rules['app/page.tsx']!['gspot/no-trivial-files']![0]).toBe(0);
        expect(
            rules['app/page.tsx']!['no-restricted-syntax']!.some(
                (entry) =>
                    typeof entry === 'object' &&
                    entry !== null &&
                    'selector' in entry &&
                    entry.selector === 'ExportAllDeclaration',
            ),
        ).toBe(reexports !== 'index-only');
        // A component may be small, but a plain module of the scope keeps the rule.
        expect(rules['app/format.ts']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test.each([
    ['react', '@testing-library/react', '19.1.1'],
    ['vue', '@testing-library/vue', '3.5.22'],
    ['svelte', '@testing-library/svelte', '5.57.0'],
])(
    'the Testing Library rules of %s report a debugging call in a test file and nowhere else',
    async (framework, library, version) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `level = "all"\nconfigurations = ["javascript", "${framework}"]\n[agent_rules]\nenabled = false\n`,
            'package.json': JSON.stringify({
                name: 'example',
                private: true,
                type: 'module',
                dependencies: { [framework]: version, [library]: '1.0.0' },
            }),
        });
        const eslint = await createEslint(sandbox.path);
        const opening = `// A test test.\nimport { render, screen } from '${library}';\n\nrender({});\n`;
        const debugged = `${opening}screen.debug();\n`;
        expect(
            testingLibraryMessages(await eslint.lintText(debugged, { filePath: 'src/greeting.test.js' })),
        ).toStrictEqual([{ ruleId: 'testing-library/no-debugging-utils', line: 5 }]);
        expect(testingLibraryMessages(await eslint.lintText(debugged, { filePath: 'src/debugging.js' }))).toStrictEqual(
            [],
        );
    },
);

test.each(['react', 'vue', 'svelte'])(
    'the Testing Library dependency condition remains inside its actual %s project',
    async (framework) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `configurations = ["${framework}"]\n[scope.child]\nconfigurations = ["${framework}"]\n`,
            'package.json': JSON.stringify({
                private: true,
                dependencies: { [`@testing-library/${framework}`]: '1.0.0' },
            }),
            'child/package.json': '{"private":true,"dependencies":{}}\n',
            'source.test.js': '',
            'child/source.test.js': '',
        });
        const eslint = await createEslint(sandbox.path);
        const source = `import { screen } from '@testing-library/${framework}';\nscreen.debug();\n`;
        expect(testingLibraryMessages(await eslint.lintText(source, { filePath: 'source.test.js' }))).toStrictEqual([
            { ruleId: 'testing-library/no-debugging-utils', line: 2 },
        ]);
        expect(
            testingLibraryMessages(await eslint.lintText(source, { filePath: 'child/source.test.js' })),
        ).toStrictEqual([]);
    },
);

test.each(['astro', 'expo', 'react', 'react-native', 'svelte', 'vue'])(
    'the %s bundler uses extensionless paths while the Node.js parent keeps JavaScript suffixes',
    async (framework) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': `configurations = ["javascript"]\n[scope.app]\nconfigurations = ["${framework}"]\n`,
            'source.js': '',
            'value.js': 'export const value = 1;\n',
            'app/source.js': '',
            'app/value.js': 'export const value = 1;\n',
        });
        const eslint = await createEslint(sandbox.path);
        const source = 'import { value } from "./value";\n';
        const root = await eslint.lintText(source, { filePath: 'source.js' });
        const nested = await eslint.lintText(source, { filePath: 'app/source.js' });
        expect(
            root.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'n/file-extension-in-import')),
        ).toMatchObject([{ line: 1 }]);
        expect(
            nested.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId === 'n/file-extension-in-import')),
        ).toStrictEqual([]);
    },
);

test.each(['recommended', 'all'] as const)('Drizzle guards only its declared clients at %s', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "${level}"\nconfigurations = ["drizzle"]\n[scope.app]\nconfigurations = ["drizzle"]\n[scope.app.drizzle]\nclient_names = ["connection"]\n`,
        'source.js': 'db.delete(table);\nother.delete(table);\n',
        'app/source.js': 'connection.update(table).set({ value: 1 });\nother.update(table).set({ value: 1 });\n',
    });
    const eslint = await createEslint(sandbox.path);
    const results = await eslint.lintFiles(['source.js', 'app/source.js']);
    expect(
        results.map(({ messages }) =>
            messages
                .filter(({ ruleId }) => ruleId?.startsWith('drizzle/') === true)
                .map(({ ruleId, line }) => ({ ruleId, line })),
        ),
    ).toStrictEqual([
        [{ ruleId: 'drizzle/enforce-delete-with-where', line: 1 }],
        [{ ruleId: 'drizzle/enforce-update-with-where', line: 1 }],
    ]);
    const corrected = await eslint.lintText('connection.update(table).set({ value: 1 }).where(condition);\n', {
        filePath: 'app/source.js',
    });
    expect(
        corrected.flatMap(({ messages }) => messages.filter(({ ruleId }) => ruleId?.startsWith('drizzle/') === true)),
    ).toStrictEqual([]);
});
