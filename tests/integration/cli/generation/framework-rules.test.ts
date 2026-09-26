// A framework turns a shared rule off only in its manifest: the generated ESLint configuration of a React Native scope has no accessibility rule for DOM elements, and a React scope keeps it.
import { ESLint } from 'eslint';
import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { emitAll } from '#cli/generation/render.ts';
import { openSession } from '#cli/execution/session.ts';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';

const modules = join(import.meta.dir, '../../../../node_modules');

async function accessibilityLevel(configuration: string): Promise<unknown> {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': `version = 1\nlevel = "all"\nconfigurations = ["${configuration}", "typescript"]\n[rules]\ninstall = false\n`,
        'package.json': '{"name":"planted","private":true,"type":"module","dependencies":{"react":"19.1.1"}}\n',
        'tsconfig.json': '{"compilerOptions":{"strict":true,"jsx":"react-jsx"},"include":["src"]}\n',
        'src/App.tsx': 'export const App = (): string => "app";\n',
    });
    symlinkSync(modules, join(sandbox.path, 'node_modules'), 'dir');
    mkdirSync(join(sandbox.path, '.gspot/config'), { recursive: true });
    // The generated configuration imports its plugins from the private installation.
    symlinkSync(modules, join(sandbox.path, '.gspot/node_modules'), 'dir');
    const session = await openSession(sandbox.path);
    const config = emitAll(session.policyFiles.policy, session.repository, session.scopes, {
        version: session.version,
        packageManager: session.packageManager,
    }).files.find((file) => file.path === '.gspot/config/eslint.config.mjs')!;
    writeFileSync(join(sandbox.path, config.path), config.content);
    const eslint = new ESLint({ cwd: sandbox.path, overrideConfigFile: join(sandbox.path, config.path) });
    const resolved = (await eslint.calculateConfigForFile('src/App.tsx')) as { rules: Record<string, unknown[]> };
    return resolved.rules['jsx-a11y/alt-text']?.[0];
}

test('the accessibility rules read DOM elements: on for React, off for React Native', async () => {
    expect(await accessibilityLevel('react')).toBe(2);
    expect(await accessibilityLevel('react-native')).toBe(0);
});
