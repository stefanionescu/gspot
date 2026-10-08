// Run source commands and native suites with this run's packed workspace packages.
import { testdir } from 'testdirs';
import { stringify } from 'smol-toml';
import { writeFileSync } from 'node:fs';
import { CLI_PINS } from '#cli/config/pins.ts';
import { join, resolve, delimiter } from 'node:path';
import { workspaceRoot } from '#automation/workspace.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { ARGUMENT_START } from '#automation/config/paths.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import pluginManifest from '#plugin-package' with { type: 'json' };
import { run, environmentVariables } from '#cli/platform/public.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { installSuitePythonTools } from '#tests/harness/python-installation.ts';
import { TERMINATED_EXIT, INTERRUPTED_EXIT } from '#automation/config/plugin.ts';
import { misePins, configurationManifests } from '#cli/configurations/public.ts';
import { SUITE_PYTHON_FOLDER } from '#tests/config/harness/python-installation.ts';
import { packRegistryPackages, createPackageRegistry } from '#tests/harness/registry.ts';

/**
 * Install the manifest pins once and share their executable paths with either native suite.
 * @param work the suite's temporary directory
 * @param execute the cancellation-aware command runner
 * @param cancelSignal the suite run cancellation
 * @returns the PATH containing every applicable native pin
 */
async function installSuiteTools(work: string, execute: typeof run, cancelSignal: AbortSignal): Promise<string> {
    const manifests = [...configurationManifests().values()];
    const tools = Object.fromEntries(
        misePins(manifests).map(
            (pin) =>
                [
                    pin.name,
                    { version: pin.version, ...(pin.os === undefined ? {} : { os: pin.os }), ...pin.options },
                ] as const,
        ),
    );
    const config = join(work, 'mise.toml');
    writeFileSync(
        config,
        stringify({ min_version: CLI_PINS.mise.version, settings: { npm: { package_manager: 'npm' } }, tools }),
    );
    const trusted = await execute(['mise', 'trust', config], { cwd: work });
    if (trusted.code !== 0) throw new Error(`Test tools configuration failed: ${trusted.stderr}`);
    const installed = await execute(['mise', 'install'], {
        cwd: work,
        onStderr: (chunk) => {
            process.stderr.write(chunk);
        },
    });
    if (installed.code !== 0) throw new Error(`Test tools installation failed: ${installed.stderr}`);
    const bins = await execute(['mise', 'bin-paths'], { cwd: work });
    if (bins.code !== 0) throw new Error(`Test tools paths failed: ${bins.stderr}`);
    const path = [...bins.stdout.trim().split(/\r?\n/u), buildToolsPath([])].join(delimiter);
    const previous = environmentVariables()['PATH'];
    setEnvironmentVariable('PATH', path);
    try {
        return await installSuitePythonTools(join(work, SUITE_PYTHON_FOLDER), cancelSignal);
    } finally {
        setEnvironmentVariable('PATH', previous);
    }
}

const args = process.argv.slice(ARGUMENT_START);
let suite: string | undefined;
if (args[0] === 'cli') suite = 'cli';
if (args[0] === 'plugin') suite = 'plugin';
if (args[0] === 'test') suite = 'tools';
if (args[0] === 'package') suite = 'packages';
const options = suite === undefined ? args : args.slice(1);
const isSourceSuite = suite === 'cli' || suite === 'plugin';
const separator = options.indexOf('--');
const flags = separator === -1 ? options : options.slice(0, separator);
const paths = separator === -1 ? [] : options.slice(separator + 1);
const defaults = suite === 'cli' ? ['cli', 'plugin'] : [suite].filter((target) => target !== undefined);
const targets = paths.length === 0 ? defaults : paths;
const testCommand = [
    process.execPath,
    'test',
    ...flags,
    '--timeout',
    String(TEST_TIMEOUT_MS),
    ...targets.map((path) => resolve(workspaceRoot, 'tests', path)),
];

if (suite !== undefined && options.length === 1 && options[0] === '--help') {
    console.log(
        `Usage: bun scripts/plugin.ts ${String(args[0])} [Bun options] [-- paths ...]\n\nPaths are relative to tests/. Without paths, it runs ${targets.join(' and ')}. Bun validates its options.`,
    );
} else {
    const controller = new AbortController();
    let canceled: number | undefined;
    const stop = (signal: NodeJS.Signals): void => {
        canceled = signal === 'SIGINT' ? INTERRUPTED_EXIT : TERMINATED_EXIT;
        controller.abort();
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    try {
        await using work = await testdir();
        // Each run owns its cache because packed workspace bytes change without a version change.
        const bunCache = join(work.path, 'bun-cache');
        if (!isSourceSuite) setEnvironmentVariable('BUN_INSTALL_CACHE_DIR', bunCache);
        const execute: typeof run = async (command, commandOptions) => {
            controller.signal.throwIfAborted();
            const result = await run(command, { ...commandOptions, cancelSignal: controller.signal });
            controller.signal.throwIfAborted();
            return result;
        };
        const built = isSourceSuite
            ? undefined
            : await execute([process.execPath, 'packages/cli/scripts/build.ts'], {
                  cwd: workspaceRoot,
                  onStderr: (chunk) => {
                      process.stderr.write(chunk);
                  },
              });
        if (built !== undefined && built.code !== 0)
            throw new Error(`CLI build failed: ${built.stdout}${built.stderr}`);
        const archives = isSourceSuite
            ? undefined
            : await packRegistryPackages(
                  work.path,
                  [
                      { ...pluginManifest, source: join(workspaceRoot, 'packages/eslint-plugin') },
                      { ...packageManifest, source: join(workspaceRoot, 'packages/cli') },
                  ],
                  execute,
              );
        if (archives !== undefined) setEnvironmentVariable('GSPOT_PACKAGE_ARCHIVES', archives);
        const nativePath =
            suite === 'tools' || suite === 'packages'
                ? await installSuiteTools(work.path, execute, controller.signal)
                : undefined;
        await using registry =
            suite === 'tools' || isSourceSuite
                ? undefined
                : await createPackageRegistry(work.path, { declarations: [], execute });
        const npmrc = join(work.path, '.npmrc');
        if (registry !== undefined) writeFileSync(npmrc, `@gspothq:registry=${registry.url}/\n`, { mode: 0o600 });
        const env = {
            ...(archives === undefined ? {} : { BUN_INSTALL_CACHE_DIR: bunCache, GSPOT_PACKAGE_ARCHIVES: archives }),
            ...(nativePath === undefined ? {} : { PATH: nativePath }),
            ...(registry === undefined ? {} : { NPM_CONFIG_USERCONFIG: npmrc }),
            ...(suite === 'packages' && registry !== undefined
                ? {
                      GSPOT_PACKAGE_RELEASE: JSON.stringify({
                          registry: { url: registry.url, npmrc, work: work.path },
                          version: packageManifest.version,
                      }),
                  }
                : {}),
        };
        const command = suite === undefined ? [process.execPath, 'packages/cli/src/main.ts', ...args] : testCommand;
        const result = await execute(command, {
            cwd: workspaceRoot,
            env,
            onStdout: (chunk) => {
                process.stdout.write(chunk);
            },
            onStderr: (chunk) => {
                process.stderr.write(chunk);
            },
        });
        process.exitCode = canceled ?? result.code;
    } catch (error) {
        if (canceled === undefined || error !== controller.signal.reason) throw error;
        process.exitCode = canceled;
    } finally {
        process.removeListener('SIGINT', stop);
        process.removeListener('SIGTERM', stop);
    }
}
