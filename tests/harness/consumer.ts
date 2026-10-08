import { join } from 'node:path';
import { testdir } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runTestCommand } from '#tests/harness/command.ts';
import type { Consumer } from '#tests/types/harness/consumer.ts';
import { consumerEnvironment } from '#tests/harness/environment.ts';
import type { PublishedRelease } from '#automation/types/package.ts';
import { OFFLINE_ENVIRONMENT } from '#tests/config/harness/consumer.ts';

/**
 * Install the candidate CLI into a fresh repository containing only its package manifest.
 * @param registry the suite-owned package registry
 * @param version the exact candidate version
 * @returns the owned repository, installed command, and online and offline environments
 */
export async function createConsumer(
    registry: Pick<PublishedRelease['registry'], 'url' | 'npmrc'>,
    version: string,
): Promise<Consumer> {
    const workspace = await testdir();
    try {
        const root = join(workspace.path, 'consumer');
        const env = { ...consumerEnvironment, BUN_INSTALL_CACHE_DIR: join(workspace.path, 'bun-cache') };
        await mkdir(root);
        await writeFile(join(root, 'package.json'), '{"name":"consumer","private":true}\n');
        const installed = await runTestCommand(
            ['npm', 'install', `@gspothq/cli@${version}`, '--ignore-scripts', '--no-audit', '--no-fund'],
            {
                cwd: root,
                env: { ...consumerEnvironment, NPM_CONFIG_USERCONFIG: registry.npmrc },
            },
        );
        if (installed.code !== 0)
            throw new Error(`Consumer package installation failed: ${installed.stdout}${installed.stderr}`);
        const command = ['node', join(root, 'node_modules', '@gspothq/cli', 'dist', 'gspot.js')];
        const offlineOptions = {
            cwd: root,
            env: {
                ...env,
                NO_COLOR: '1',
                CI: '1',
                ...OFFLINE_ENVIRONMENT,
            },
        };
        const onlineOptions = {
            ...offlineOptions,
            env: { ...env, NPM_CONFIG_USERCONFIG: registry.npmrc, NO_COLOR: '1', CI: '1' },
        };
        return {
            root: root,
            command,
            offlineOptions: offlineOptions,
            onlineOptions: onlineOptions,
            workspace: workspace.path,
            [Symbol.asyncDispose]: workspace[Symbol.asyncDispose].bind(workspace),
        };
    } catch (error) {
        await workspace[Symbol.asyncDispose]();
        throw error;
    }
}
