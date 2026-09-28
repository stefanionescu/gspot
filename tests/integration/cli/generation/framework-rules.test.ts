// Framework manifests own shared-rule overrides. React Native disables DOM accessibility rules while React retains them.
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { openSession } from '#cli/execution/session.ts';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { generatedEslint } from '#tests/support/cli/generated/eslint.ts';

const modules = join(import.meta.dir, '../../../../node_modules');

async function configuredRules(policy: string, files: string[]): Promise<Record<string, Record<string, unknown[]>>> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "all"\n${policy}\n[guides]\ninstall = false\n`,
        'package.json': '{"name":"planted","private":true,"type":"module","dependencies":{"react":"19.1.1"}}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"},"include":["src"]}\n',
        ...Object.fromEntries(files.map((file) => [file, 'export const App = (): string => "app";\n'])),
    });
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    // The generated configuration imports its plugins from the private installation.
    symlinkSync(modules, join(sandbox.path, '.gspot/node_modules'), 'dir');
    const session = await openSession(sandbox.path);
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageClient: session.packageClient,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    writeFileSync(join(sandbox.path, config.path), config.content);
    const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
    const results: Record<string, Record<string, unknown[]>> = {};
    for (const file of files) {
        const resolved = (await eslint.calculateConfigForFile(file)) as { rules: Record<string, unknown[]> };
        results[file] = resolved.rules;
    }
    return results;
}

test('native DOM exclusions remain files to their scope', async () => {
    const rules = await configuredRules(
        'kits = ["react", "typescript"]\n[[scope]]\npath = "native"\nkits = ["react-native"]',
        ['native/App.tsx', 'web/App.tsx'],
    );
    expect(rules['native/App.tsx']!['jsx-a11y/alt-text']![0]).toBe(0);
    expect(rules['web/App.tsx']!['jsx-a11y/alt-text']![0]).toBe(2);
});

test.each(['none', 'index-only'])(
    'Next.js entry exclusions respect reexports = %s and nested scope ownership',
    async (reexports) => {
        const rules = await configuredRules(
            `kits = ["typescript"]\n[structure]\nreexports = "${reexports}"\n[[scope]]\npath = "app"\nkits = ["nextjs"]`,
            ['app/page.tsx', 'app/component.tsx', 'library/page.tsx'],
        );
        expect(rules['app/page.tsx']!['gspot/no-trivial-files']![0]).toBe(0);
        expect(rules['app/page.tsx']!['gspot/no-export-only-files']![0]).toBe(0);
        expect(rules['app/page.tsx']!['gspot/no-reexports']![0]).toBe(reexports === 'index-only' ? 0 : 2);
        expect(rules['app/component.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
        expect(rules['library/page.tsx']!['gspot/no-trivial-files']![0]).toBe(2);
    },
);

test('package rule exceptions retain neighboring violations and corrected success', async () => {
    await using sandbox = await testdir();
    const manifest = { name: 'planted', version: '0.0.0', type: 'module' };
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1
level = "all"
kits = ["typescript"]
[[ignore]]
check = "typescript/eslint"
rule = "package-json/require-exports"
paths = ["cli/package.json"]
reason = "The command package exposes no module API."
[guides]
install = false
`,
        'package.json': JSON.stringify({ ...manifest, private: true }),
        'cli/package.json': JSON.stringify(manifest),
        'library/package.json': JSON.stringify(manifest),
    });
    const eslint = await generatedEslint(sandbox.path);
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
