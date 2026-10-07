// Run source commands and native suites with this run's packed workspace packages.
import { testdir } from 'testdirs';
import { stringify } from 'smol-toml';
import { writeFileSync } from 'node:fs';
import { join, delimiter } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { CLI_PINS } from '#cli/config/configurations.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { buildToolsPath } from '#tests/harness/install.ts';
import { ARGUMENT_START } from '#automation/config/paths.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import pluginManifest from '#plugin-package' with { type: 'json' };
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';
import { TERMINATED_EXIT, INTERRUPTED_EXIT } from '#automation/config/plugin.ts';
import { misePins, collectPins, toolProjectPackage } from '#cli/configurations/pins.ts';
import { packRegistryPackages, createPackageRegistry } from '#tests/harness/registry.ts';

/**
 * Install the manifest pins once and share their executable paths with either native suite.
 * @param work the suite's temporary directory
 * @param execute the cancellation-aware command runner
 * @returns the PATH containing every applicable native pin
 */
async function installSuiteTools(work: string, execute: typeof run): Promise<string> {
    const manifests = [...configurationManifests().values()];
    const pythonTools = collectPins(manifests).flatMap((tool) => {
        const pin = toolProjectPackage(tool);
        return pin?.kind === 'python'
            ? [[`pipx:${pin.name}`, { version: pin.version, depends: ['uv'], os: tool.platforms }] as const]
            : [];
    });
    const tools = {
        ...Object.fromEntries(
            misePins(manifests).map(
                (pin) =>
                    [
                        pin.name,
                        { version: pin.version, ...(pin.os === undefined ? {} : { os: pin.os }), ...pin.options },
                    ] as const,
            ),
        ),
        ...Object.fromEntries(pythonTools),
    };
    const config = join(work, 'mise.toml');
    writeFileSync(
        config,
        stringify({ min_version: CLI_PINS.mise, settings: { npm: { package_manager: 'npm' } }, tools }),
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
    return [...bins.stdout.trim().split(/\r?\n/u), buildToolsPath([])].join(delimiter);
}

const args = process.argv.slice(ARGUMENT_START);
let suite: string | undefined;
if (args[0] === 'test') suite = 'tools';
if (args[0] === 'package') suite = 'packages';
const options = suite === undefined ? args : args.slice(1);
const separator = options.indexOf('--');
const flags = separator === -1 ? options : options.slice(0, separator);
const paths = separator === -1 ? [] : options.slice(separator + 1);

if (suite !== undefined && options.length === 1 && options[0] === '--help') {
    console.log(
        `Usage: mise run test:${suite === 'packages' ? 'package' : suite} -- [Bun options] [-- paths ...]\n\nPaths are relative to tests/. Without paths, ${suite} is selected. Bun validates its options.`,
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
        const execute: typeof run = async (command, commandOptions) => {
            controller.signal.throwIfAborted();
            const result = await run(command, { ...commandOptions, cancelSignal: controller.signal });
            controller.signal.throwIfAborted();
            return result;
        };
        const built =
            suite === 'packages'
                ? await execute([process.execPath, 'packages/cli/scripts/build.ts'], {
                      cwd: workspaceRoot,
                      onStderr: (chunk) => {
                          process.stderr.write(chunk);
                      },
                  })
                : undefined;
        if (built !== undefined && built.code !== 0)
            throw new Error(`CLI build failed: ${built.stdout}${built.stderr}`);
        const archives = await packRegistryPackages(
            work.path,
            [
                { ...pluginManifest, source: join(workspaceRoot, 'packages/eslint-plugin') },
                { ...packageManifest, source: join(workspaceRoot, 'packages/cli') },
            ],
            execute,
        );
        setEnvironmentVariable('GSPOT_PACKAGE_ARCHIVES', archives);
        const nativePath = suite === undefined ? undefined : await installSuiteTools(work.path, execute);
        await using registry =
            suite === 'tools' ? undefined : await createPackageRegistry(work.path, { declarations: [], execute });
        const npmrc = join(work.path, '.npmrc');
        if (registry !== undefined) writeFileSync(npmrc, `@gspothq:registry=${registry.url}/\n`, { mode: 0o600 });
        const env = {
            GSPOT_PACKAGE_ARCHIVES: archives,
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
        const command =
            suite === undefined
                ? [process.execPath, 'packages/cli/src/main.ts', ...args]
                : [
                      process.execPath,
                      'test',
                      '--timeout',
                      String(NATIVE_TEST_TIMEOUT_MS),
                      ...flags,
                      ...(paths.length === 0 ? [`./${suite}`] : paths),
                  ];
        const result = await execute(command, {
            cwd: suite === undefined ? workspaceRoot : join(workspaceRoot, 'tests'),
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
