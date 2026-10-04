// The built packages published into an isolated registry, and a fresh consumer that installed them from it.
import { join } from 'node:path';
import { runTestCommand } from '#tests/harness/command.ts';
import type { Consumer } from '#tests/types/harness/consumer.ts';
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import type { PublishedRelease } from '#automation/types/package.ts';

/**
 * Initialize the consumer with Bash, naming, prose, Python, Swift, and formatting, then install its private tools.
 * @param release the published release
 * @param installation the installed consumer
 * @returns the initialization report, after successful tool installation
 */
export async function initializeConsumer(release: PublishedRelease, installation: Consumer): Promise<SpawnOutcome> {
    const { registry } = release;
    const { command, onlineOptions: setupOptions } = installation;
    const initialized = await runTestCommand(
        [
            ...command,
            'init',
            '--json',
            '--yes',
            '--configurations',
            'bash',
            'naming',
            'prose',
            'python',
            'swift',
            'format',
            '--no-task',
            '--no-ci',
            '--no-hooks',
            '--no-install',
        ],
        setupOptions,
    );
    if (initialized.code !== 0)
        throw new Error(`Consumer initialization failed: ${initialized.stdout}${initialized.stderr}`);
    const installedTools = await runTestCommand([...command, 'install', '--json'], {
        ...setupOptions,
        env: {
            ...setupOptions.env,
            NPM_CONFIG_USERCONFIG: registry.npmrc,
            BUN_INSTALL_CACHE_DIR: join(registry.work, 'tool-cache'),
        },
        timeoutMs: NATIVE_TEST_TIMEOUT_MS,
    });
    if (installedTools.code !== 0)
        throw new Error(`Consumer tool installation failed: ${installedTools.stdout}${installedTools.stderr}`);
    return initialized;
}

/** Read the immutable connection details supplied by the release-suite owner. */
export function getPublishedRelease(): PublishedRelease {
    const connection = environmentVariables()['GSPOT_PACKAGE_RELEASE'];
    if (connection === undefined) throw new Error('Run installed acceptance through mise run test:package.');
    return JSON.parse(connection) as PublishedRelease;
}
