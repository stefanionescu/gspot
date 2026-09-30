import { join } from 'node:path';
import { testdir } from 'testdirs';
import { run } from '#cli/platform/spawn.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { environment } from '#tests/support/package/packages.ts';
import type { CreateConsumerResult } from '#tests/types/results.ts';
import { RELEASE_TIMEOUT_MS, OFFLINE_ENVIRONMENT } from '#tests/inputs/package.ts';

// The authored configuration the consumer starts from.
const EDITORCONFIG = 'root = true\n[*]\nindent_size = 2\n[*.json]\nindent_size = 4\n';
const FORMATTER =
    'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n';

export async function createConsumer(
    registry: { url: string; npmrc: string },
    version: string,
): Promise<CreateConsumerResult> {
    const workspace = await testdir();
    try {
        const consumer = join(workspace.path, 'consumer');
        mkdirSync(consumer);
        writeFileSync(join(consumer, 'package.json'), '{"name":"consumer","private":true}\n');
        writeFileSync(join(consumer, '.editorconfig'), EDITORCONFIG, { mode: 0o640 });
        writeFileSync(join(consumer, 'prettier.config.mjs'), FORMATTER);
        writeFileSync(join(consumer, 'source.js'), 'const greeting="hello";');
        writeFileSync(join(consumer, 'broken.sh'), 'if then\n');
        writeFileSync(join(consumer, 'authored.txt'), 'Preserve this authored file.\n');
        const installed = await run(
            [
                'npm',
                'install',
                `gspot@${version}`,
                '--ignore-scripts',
                '--registry',
                registry.url,
                '--no-audit',
                '--no-fund',
            ],
            {
                cwd: consumer,
                env: { ...environment, NPM_CONFIG_USERCONFIG: registry.npmrc },
                timeoutMs: RELEASE_TIMEOUT_MS,
            },
        );
        const command = ['node', join(consumer, 'node_modules', 'gspot', 'dist', 'gspot.js')];
        const options = {
            cwd: consumer,
            env: {
                ...environment,
                NO_COLOR: '1',
                CI: '1',
                ...OFFLINE_ENVIRONMENT,
            },
            timeoutMs: RELEASE_TIMEOUT_MS,
        };
        const setupOptions = { ...options, env: { ...environment, NO_COLOR: '1', CI: '1' } };
        return {
            installed,
            consumer,
            command,
            options,
            setupOptions,
            editorconfig: EDITORCONFIG,
            formatter: FORMATTER,
            workspace: workspace.path,
            [Symbol.asyncDispose]: workspace[Symbol.asyncDispose].bind(workspace),
        };
    } catch (error) {
        await workspace[Symbol.asyncDispose]();
        throw error;
    }
}
