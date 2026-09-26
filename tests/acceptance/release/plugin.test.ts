import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import pluginPackage from '#plugin-package' with { type: 'json' };
import { runProcess as run } from '#tests/support/cli/command.ts';
import { startRegistry } from '#tests/support/registry/lifecycle.ts';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const RELEASE_TIMEOUT_MS = 180_000;
const CONSUMER = String.raw`
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ESLint } from 'eslint';
import plugin from '@gspot/eslint-plugin';
const require = createRequire(import.meta.url);
const commonjs = require('@gspot/eslint-plugin');
for (const published of [plugin, commonjs.default ?? commonjs]) {
    for (const level of ['recommended', 'all']) {
        const eslint = new ESLint({ overrideConfigFile: true, overrideConfig: [published.configs[level]] });
        const invalid = await eslint.lintText('const source = 1;\nexport const alias = source;\n', { filePath: 'example.js' });
        assert.equal(invalid.length, 1);
        assert.deepEqual(invalid[0].messages.map(({ ruleId, line, column, message }) => ({ ruleId, line, column, message })), level === 'recommended' ? [] : [{
            ruleId: 'gspot/no-exported-alias-constants', line: 2, column: 14,
            message: 'alias only renames source. Export the source value directly instead of an alias.',
        }]);
        const defect = await eslint.lintText("'use client';\nconsole.log(process.env.SECRET);\n", { filePath: 'client.js' });
        assert.deepEqual(defect[0].messages.filter(({ ruleId }) => ruleId === 'gspot/no-client-environment').map(({ line, column, messageId }) => ({ line, column, messageId })), [{line: 2, column: 13, messageId: 'private'}]);
        const corrected = await eslint.lintText('export const source = 1;\n', { filePath: 'example.js' });
        assert.equal(corrected.length, 1);
        assert.deepEqual(corrected[0].messages, []);
        const layout = await eslint.lintText('export const value = 1;\nconst internal = 2;\nconsole.log(internal);\n', { filePath: 'example.js' });
        assert.deepEqual(layout[0].messages.filter(({ ruleId }) => ruleId === 'gspot/private-before-public').map(({ ruleId, line }) => ({ ruleId, line })), level === 'recommended' ? [] : [{ ruleId: 'gspot/private-before-public', line: 2 }]);
        const forwarding = await eslint.lintText('function forward(value) { return build(value); }\n', { filePath: 'example.js' });
        assert.equal(forwarding.length, 1);
        assert.deepEqual(forwarding[0].messages.map(({ ruleId }) => ruleId).sort(), ['gspot/no-trivial-files', 'gspot/no-trivial-functions']);
        assert.equal(forwarding[0].messages.find(({ ruleId }) => ruleId === 'gspot/no-trivial-functions').message, 'This function has 1 executable statements, at most 2. Inline it or explain its required API with a narrow suppression.');
    }
    const server = new ESLint({ overrideConfigFile: true, overrideConfig: [{
        files: ['**/server.js'], plugins: { gspot: published }, rules: { 'gspot/require-server-only': 'error' },
    }] });
    const invalidServer = await server.lintText('export const secret = 1;', { filePath: 'server.js' });
    assert.equal(invalidServer.length, 1);
    assert.deepEqual(invalidServer[0].messages.map(({ ruleId, line, column, message }) => ({ ruleId, line, column, message })), [{
        ruleId: 'gspot/require-server-only', line: 1, column: 1,
        message: 'Mark this server module with import "server-only" so a client bundle can never include it.',
    }]);
    const ordinary = await server.lintText('export const value = 1;', { filePath: 'ordinary.js' });
    assert.equal(ordinary.length, 1);
    assert.deepEqual(ordinary[0].messages, []);
    const correctedServer = await server.lintText('import "server-only"; export const secret = 1;', { filePath: 'server.js' });
    assert.equal(correctedServer.length, 1);
    assert.deepEqual(correctedServer[0].messages, []);
 }
const readmeCases = [
    { config: './readme-0.mjs', file: 'client.js', broken: "'use client';\nconsole.log(process.env.SECRET);", fixed: "'use client';\nconsole.log('public');", rule: 'gspot/no-client-environment' },
    { config: './readme-3.mjs', file: 'server/example.js', broken: 'export const value = 1;', fixed: "import 'server-only'; export const value = 1;", rule: 'gspot/require-server-only' },
];
for (const example of readmeCases) {
    const config = await import(example.config);
    const eslint = new ESLint({overrideConfigFile: true, overrideConfig: config.default});
    const failed = await eslint.lintText(example.broken, {filePath: example.file});
    assert.deepEqual(failed[0].messages.map(({ruleId}) => ruleId), [example.rule]);
    const corrected = await eslint.lintText(example.fixed, {filePath: example.file});
    assert.deepEqual(corrected[0].messages, []);
}
`;
const DECLARATIONS = `
import plugin from '@gspot/eslint-plugin';
import type { TSESLint } from '@typescript-eslint/utils';
const configs: TSESLint.FlatConfig.Config[] = [plugin.configs.recommended, plugin.configs.all];
const rule: TSESLint.RuleModule<string, readonly unknown[]> | undefined = plugin.rules['no-trivial-functions'];
console.log(configs, rule);
`;

describe('the installed ESLint plugin', () => {
    test(
        'exposes usable modules and declarations and enforces both levels',
        async () => {
            const built = await run([process.execPath, 'packages/eslint-plugin/build.ts'], {
                cwd: root,
                timeoutMs: RELEASE_TIMEOUT_MS,
            });
            expect(built.code, built.stdout + built.stderr).toBe(0);
            const registry = await startRegistry();
            try {
                registry.assertRunning();
                const published = await run(
                    [
                        'npm',
                        'publish',
                        join(root, 'packages/eslint-plugin'),
                        '--ignore-scripts',
                        '--registry',
                        registry.url,
                        '--userconfig',
                        registry.npmrc,
                    ],
                    { cwd: registry.work, timeoutMs: RELEASE_TIMEOUT_MS },
                );
                expect(published.code, published.stdout + published.stderr).toBe(0);
                const consumer = join(registry.work, 'consumer');
                mkdirSync(consumer);
                writeFileSync(
                    join(consumer, 'package.json'),
                    '{"name":"plugin-consumer","private":true,"type":"module"}\n',
                );
                // Route only the candidate scope to the owned registry. Tool dependencies use npm.
                writeFileSync(
                    join(consumer, '.npmrc'),
                    `registry=https://registry.npmjs.org/\n@gspot:registry=${registry.url}\n`,
                );
                registry.assertRunning();
                const installed = await run(
                    [
                        'npm',
                        'install',
                        `@gspot/eslint-plugin@${pluginPackage.version}`,
                        `eslint@${pluginPackage.devDependencies.eslint}`,
                        `typescript@${pluginPackage.devDependencies.typescript}`,
                        '--ignore-scripts',
                        '--no-audit',
                        '--no-fund',
                    ],
                    { cwd: consumer, timeoutMs: RELEASE_TIMEOUT_MS },
                );
                expect(installed.code, installed.stdout + installed.stderr).toBe(0);
                expect(lstatSync(join(consumer, 'node_modules', '@gspot', 'eslint-plugin')).isSymbolicLink()).toBe(
                    false,
                );
                const installedPlugin = join(consumer, 'node_modules', '@gspot', 'eslint-plugin');
                expect(readFileSync(join(installedPlugin, 'dist/LICENSE.md'), 'utf8')).toBe(
                    readFileSync(join(root, 'LICENSE.md'), 'utf8'),
                );
                expect(existsSync(join(installedPlugin, 'NOTICE.md'))).toBe(false);
                expect(readFileSync(join(installedPlugin, 'README.md'), 'utf8')).toBe(
                    readFileSync(join(root, 'packages/eslint-plugin/README.md'), 'utf8'),
                );
                const documentation = readFileSync(join(installedPlugin, 'README.md'), 'utf8');
                for (const [index, match] of [...documentation.matchAll(/```javascript\n([\s\S]*?)```/gu)].entries()) {
                    writeFileSync(join(consumer, `readme-${String(index)}.mjs`), match[1]!);
                }
                writeFileSync(join(consumer, 'consumer.mjs'), CONSUMER);
                writeFileSync(join(consumer, 'consumer.mts'), DECLARATIONS);
                const checked = await run(['node', 'consumer.mjs'], { cwd: consumer, timeoutMs: RELEASE_TIMEOUT_MS });
                expect(checked.code, checked.stdout + checked.stderr).toBe(0);
                const typed = await run(
                    [
                        'node',
                        'node_modules/typescript/bin/tsc',
                        '--noEmit',
                        '--strict',
                        '--module',
                        'NodeNext',
                        '--target',
                        'ES2022',
                        'consumer.mts',
                    ],
                    { cwd: consumer, timeoutMs: RELEASE_TIMEOUT_MS },
                );
                expect(typed.code, typed.stdout + typed.stderr).toBe(0);
            } finally {
                await registry.stop();
                expect(existsSync(registry.work)).toBe(false);
            }
        },
        RELEASE_TIMEOUT_MS,
    );
});
