import { join } from 'node:path';
import { testdir } from 'testdirs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runProcess as run } from '#tests/support/cli/command.ts';
import { environment, RELEASE_TIMEOUT_MS } from '#tests/support/release/packages.ts';

export async function createConsumer(registry: { url: string; npmrc: string }, version: string) {
    const workspace = await testdir();
    try {
        const consumer = join(workspace.path, 'consumer');
        mkdirSync(consumer);
        writeFileSync(join(consumer, 'package.json'), '{"name":"consumer","private":true}\n');
        const editorconfig = 'root = true\n[*]\nindent_size = 2\n[*.json]\nindent_size = 4\n';
        writeFileSync(join(consumer, '.editorconfig'), editorconfig, { mode: 0o640 });
        const formatter =
            'console.log("formatter stdout"); console.error("formatter stderr"); export default { semi: false };\n';
        writeFileSync(join(consumer, 'prettier.config.mjs'), formatter);
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
        const launcherDirectory = join(consumer, 'node_modules', 'gspot');
        const command = ['node', join(launcherDirectory, 'gspot.js')];
        const options = {
            cwd: consumer,
            env: {
                ...environment,
                NO_COLOR: '1',
                CI: '1',
                HTTP_PROXY: 'http://127.0.0.1:1',
                HTTPS_PROXY: 'http://127.0.0.1:1',
                ALL_PROXY: 'http://127.0.0.1:1',
                NO_PROXY: '',
                http_proxy: undefined,
                https_proxy: undefined,
                all_proxy: undefined,
                no_proxy: undefined,
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
            editorconfig,
            formatter,
            workspace: workspace.path,
            [Symbol.asyncDispose]: async () => {
                await workspace[Symbol.asyncDispose]();
            },
        };
    } catch (error) {
        await workspace[Symbol.asyncDispose]();
        throw error;
    }
}
