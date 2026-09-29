// The built packages published into an isolated registry, and a fresh consumer that installed them from it.
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import * as processes from '#cli/platform/spawn.ts';
import type { Registry } from '#tests/types/registry.ts';
import { RELEASE_TIMEOUT_MS } from '#tests/inputs/release.ts';
import { publishTo } from '#tests/support/registry/lifecycle.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { host, root, requireCli, environment, preparePackages } from '#tests/support/release/packages.ts';
import type { PublishedRelease, InstalledConsumer, ConsumerInitialization } from '#tests/types/release.ts';

/**
 * Publishes the built packages and their dependency into the caller-owned registry.
 * @param registry the registry retained for the consumer suite.
 * @returns the registry, the published version, and the tool npmrc
 */
export async function publishRelease(registry: Registry, signal: AbortSignal): Promise<PublishedRelease> {
    const built = await run([join(root, 'dist', host.binary), '--version'], {
        cwd: registry.work,
        env: environment,
        timeoutMs: RELEASE_TIMEOUT_MS,
        cancelSignal: signal,
    });
    if (built.code !== 0) throw new Error(`Built version command failed: ${built.stdout}${built.stderr}`);
    const version = built.stdout.trim();
    const checkout = preparePackages(registry.work);
    const dependency = await run(
        [
            'npm',
            'publish',
            dirname(requireCli.resolve('detect-libc/package.json')),
            '--registry',
            registry.url,
            '--userconfig',
            registry.npmrc,
            '--ignore-scripts',
        ],
        {
            cwd: registry.work,
            env: environment,
            timeoutMs: RELEASE_TIMEOUT_MS,
            cancelSignal: signal,
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        },
    );
    if (dependency.code !== 0)
        throw new Error(`Registry dependency publication failed: ${dependency.stdout}${dependency.stderr}`);
    const published = await publishTo(registry, version, checkout, signal);
    if (published.code !== 0) throw new Error(`Release publication failed: ${published.stdout}${published.stderr}`);
    const toolNpmrc = join(registry.work, 'tools.npmrc');
    writeFileSync(toolNpmrc, `registry=${registry.url}\n${registry.url.replace('http:', '')}/:_authToken=fake\n`, {
        mode: 0o600,
    });
    return { registry, version, toolNpmrc };
}

/**
 * Initializes the consumer with several configurations and installs its private tools.
 * @param release the published release
 * @param installation the installed consumer
 * @returns initialization and tool installation command outcomes.
 */
export async function initializeConsumer(
    release: PublishedRelease,
    installation: InstalledConsumer,
): Promise<ConsumerInitialization> {
    const { registry, toolNpmrc } = release;
    const { command, setupOptions } = installation;
    const initialized = await processes.run(
        [
            ...command,
            'init',
            '--json',
            '--yes',
            '--kits',
            'bash',
            'naming',
            'prose',
            'python',
            'swift',
            'formatting',
            '--no-runner',
            '--no-ci',
            '--no-hooks',
            '--no-install',
        ],
        setupOptions,
    );
    if (initialized.code !== 0)
        throw new Error(`Consumer initialization failed: ${initialized.stdout}${initialized.stderr}`);
    const installedTools = await processes.run([...command, 'install', '--json'], {
        ...setupOptions,
        env: {
            ...setupOptions.env,
            NPM_CONFIG_USERCONFIG: toolNpmrc,
            BUN_INSTALL_CACHE_DIR: join(registry.work, 'tool-cache'),
        },
        timeoutMs: RELEASE_TIMEOUT_MS,
    });
    if (installedTools.code !== 0)
        throw new Error(`Consumer tool installation failed: ${installedTools.stdout}${installedTools.stderr}`);
    return { initialized, installedTools };
}

/** Read the immutable connection details supplied by the release-suite owner. */
export function getPublishedRelease(): PublishedRelease {
    const connection = environmentVariables()['GSPOT_RELEASE_FIXTURE'];
    if (connection === undefined) throw new Error('Run installed acceptance through mise run test:release.');
    return JSON.parse(connection) as PublishedRelease;
}
