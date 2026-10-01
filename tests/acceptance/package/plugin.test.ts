import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/package.ts';
import pluginPackage from '#plugin-package' with { type: 'json' };
import { startRegistry } from '#tests/support/registry/lifecycle.ts';
import { CONSUMER, DECLARATIONS } from '#tests/inputs/acceptance/package.ts';
import { lstatSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../..', import.meta.url));

function expectPluginPayload(consumer: string): void {
    const installedPlugin = join(consumer, 'node_modules', '@gspothq/eslint-plugin');
    expect(readFileSync(join(installedPlugin, 'dist/LICENSE.md'), 'utf8')).toBe(
        readFileSync(join(root, 'LICENSE.md'), 'utf8'),
    );
    expect(existsSync(join(installedPlugin, 'NOTICE.md'))).toBe(false);
    expect(readFileSync(join(installedPlugin, 'README.md'), 'utf8')).toBe(
        readFileSync(join(root, 'packages/eslint-plugin/README.md'), 'utf8'),
    );
}

async function expectPluginExports(consumer: string): Promise<void> {
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
}

test(
    'the installed ESLint plugin holds its license and documentation, loads as both module kinds, and enforces both levels',
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
            // The owned registry serves the candidate packages and proxies every other package to npm.
            writeFileSync(join(consumer, '.npmrc'), `registry=${registry.url}\n`);
            registry.assertRunning();
            const installed = await run(
                [
                    'npm',
                    'install',
                    `@gspothq/eslint-plugin@${pluginPackage.version}`,
                    `eslint@${pluginPackage.devDependencies.eslint}`,
                    '--ignore-scripts',
                    '--no-audit',
                    '--no-fund',
                ],
                { cwd: consumer, timeoutMs: RELEASE_TIMEOUT_MS },
            );
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            expect(lstatSync(join(consumer, 'node_modules', '@gspothq/eslint-plugin')).isSymbolicLink()).toBe(false);
            expectPluginPayload(consumer);
            await expectPluginExports(consumer);
        } finally {
            await registry.stop();
            expect(existsSync(registry.work)).toBe(false);
        }
    },
    RELEASE_TIMEOUT_MS,
);
