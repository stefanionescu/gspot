// Framework manifests own shared-rule overrides. React Native disables DOM accessibility rules while React retains them.
import { ESLint } from 'eslint';
import { join } from 'node:path';
import type { Linter } from 'eslint';
import { test, expect } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import type { ResolvedEslint } from '#tests/types/generation/configuration-files.ts';

async function configuredRules(policy: string, files: string[]): Promise<Record<string, Record<string, unknown[]>>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"\n${policy}\n[agent_rules]\nenabled = false\n`,
        'package.json': '{"name":"example","private":true,"type":"module","dependencies":{"react":"19.1.1"}}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"},"include":["src"]}\n',
        ...Object.fromEntries(files.map((file) => [file, 'export const App = (): string => "app";\n'])),
    });
    linkInstalledModules(join(sandbox.path, 'node_modules'));
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    // The generated configuration imports its plugins from the private installation.
    linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const session = await openSession(sandbox.path);
    const config = emitAll(session).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    writeFileSync(join(sandbox.path, config.path), config.content);
    const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
    const results: Record<string, Record<string, unknown[]>> = {};
    for (const file of files) {
        const resolved = (await eslint.calculateConfigForFile(file)) as ResolvedEslint;
        results[file] = resolved.rules;
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

test('DOM accessibility rules belong only to their web scope', async () => {
    const rules = await configuredRules(
        'configurations = ["react-dom", "typescript"]\n[[scope]]\npath = "native"\nconfigurations = ["react-native"]',
        ['native/App.tsx', 'web/App.tsx'],
    );
    expect(rules['native/App.tsx']!['jsx-a11y/alt-text']).toBeUndefined();
    expect(rules['web/App.tsx']!['jsx-a11y/alt-text']![0]).toBe(2);
});

test.each(['none', 'index-only'])(
    'Next.js entry exclusions respect reexports = %s and nested scope ownership',
    async (reexports) => {
        const rules = await configuredRules(
            `configurations = ["typescript"]\n[structure]\nreexports = "${reexports}"\n[[scope]]\npath = "app"\nconfigurations = ["nextjs"]`,
            ['app/page.tsx', 'app/format.ts', 'library/page.tsx'],
        );
        expect(rules['app/page.tsx']!['gspot/no-trivial-files']![0]).toBe(0);
        expect(rules['app/page.tsx']!['gspot/no-reexports']![0]).toBe(reexports === 'index-only' ? 0 : 2);
        // A component may be small, but a plain module of the scope keeps the rule.
        expect(rules['app/format.ts']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test('package rule exceptions retain neighboring violations and corrected success', async () => {
    await using sandbox = await testdir();
    const manifest = { name: 'example', version: '0.0.0', type: 'module' };
    await createFileTree(sandbox.path, {
        'gspot.toml': `level = "all"
configurations = ["typescript"]
[[ignore]]
check = "javascript/eslint"
rule = "package-json/require-exports"
paths = ["cli/package.json"]
reason = "The command package exposes no module API."
[agent_rules]
enabled = false
`,
        'package.json': JSON.stringify({ ...manifest, private: true }),
        'cli/package.json': JSON.stringify(manifest),
        'library/package.json': JSON.stringify(manifest),
    });
    const eslint = await createEslint(sandbox.path);
    const before = await eslint.lintFiles(['cli/package.json', 'library/package.json']);
    const violations = before.flatMap((result) =>
        result.messages
            .filter((diagnostic) => diagnostic.ruleId === 'package-json/require-exports')
            .map(() => result.filePath),
    );
    expect(violations).toStrictEqual([join(sandbox.path, 'library/package.json')]);
    writeFileSync(join(sandbox.path, 'library/package.json'), JSON.stringify({ ...manifest, exports: './index.js' }));
    const after = await eslint.lintFiles(['library/package.json']);
    expect(
        after.flatMap((result) =>
            result.messages.filter((diagnostic) => diagnostic.ruleId === 'package-json/require-exports'),
        ),
    ).toStrictEqual([]);
});

test.each([
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
                dependencies: { [framework]: version },
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
        const corrected = `${opening}screen.getByText('hello');\n`;
        expect(
            testingLibraryMessages(await eslint.lintText(corrected, { filePath: 'src/greeting.test.js' })),
        ).toStrictEqual([]);
    },
);
