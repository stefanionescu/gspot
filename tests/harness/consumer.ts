// The built packages published into an isolated registry, and a fresh consumer that installed them from it.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { mkdir, writeFile } from 'node:fs/promises';
import { runTestCommand } from '#tests/harness/command.ts';
import { buildInitArguments } from '#tests/harness/init.ts';
import { environmentVariables } from '#cli/platform/public.ts';
import type { RunReport } from '#cli/types/execution/check.ts';
import { consumerEnvironment } from '#tests/harness/environment.ts';
import type { SpawnOutcome } from '#tests/types/harness/command.ts';
import type { PublishedRelease } from '#automation/types/package.ts';
import { OFFLINE_ENVIRONMENT } from '#tests/config/harness/consumer.ts';

import type {
    Consumer,
    ConsumerOptions,
    PackageCheckCase,
    PackageCheckOutcome,
} from '#tests/types/harness/consumer.ts';

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

/**
 * Initialize the consumer with Bash, Python, Swift, and automatic general checks, then install its tool projects.
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
            ...buildInitArguments(['bash', 'python', 'swift'], { json: true }).filter(
                (argument) => argument !== '--no-agent-rules',
            ),
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

/**
 * Run one delivered check against a sample, apply its fix, and rerun it within the test budget.
 * @param installation the installed CLI command
 * @param options the isolated repository and command environment
 * @param check the sample and its fix
 * @returns process evidence and parsed reports for assertions in the owning test
 */
export async function runPackageCheck(
    installation: Pick<Consumer, 'command'>,
    options: ConsumerOptions,
    check: PackageCheckCase,
): Promise<PackageCheckOutcome> {
    const args = [...installation.command, 'check', check.path, '--only', check.only, '--json'];
    if (check.sample !== undefined) await writeFile(join(options.cwd, check.path), check.sample);
    const failed = await runTestCommand(args, options);
    const report = JSON.parse(failed.stdout) as RunReport;
    let fixed: SpawnOutcome | undefined;
    if ('fix' in check) fixed = await runTestCommand([...args, '--fix'], options);
    else await writeFile(join(options.cwd, check.path), check.corrected);
    const passed = await runTestCommand(args, options);
    const accepted = JSON.parse(passed.stdout) as RunReport;
    return { failed: { ...failed, report }, fixed, passed: { ...passed, report: accepted } };
}
