import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import pluginPackage from '#plugin-package' with { type: 'json' };
import { runProcess as run } from '#tests/support/cli/command.ts';
import { startRegistry } from '#tests/support/registry/lifecycle.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/constants/support/release.ts';
import { CONSUMER, DECLARATIONS } from '#tests/constants/acceptance/release.ts';
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../..', import.meta.url));
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
