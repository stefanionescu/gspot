// Run source commands and native suites with this run's packed workspace packages.
import { join } from 'node:path';
import { testdir } from 'testdirs';
import { writeFileSync } from 'node:fs';
import { run } from '#cli/platform/spawn.ts';
import { workspaceRoot } from '#automation/workspace.ts';
import { ARGUMENT_START } from '#automation/config/paths.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import pluginManifest from '#plugin-package' with { type: 'json' };
import { NATIVE_TEST_TIMEOUT_MS } from '#tests/config/timeouts.ts';
import { setEnvironmentVariable } from '#tests/harness/environment.ts';
import { TERMINATED_EXIT, INTERRUPTED_EXIT } from '#automation/config/plugin.ts';
import { packRegistryPackages, createPackageRegistry } from '#tests/harness/registry.ts';

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
        await using registry =
            suite === 'tools' ? undefined : await createPackageRegistry(work.path, { declarations: [], execute });
        const npmrc = join(work.path, '.npmrc');
        if (registry !== undefined) writeFileSync(npmrc, `@gspothq:registry=${registry.url}/\n`, { mode: 0o600 });
        const env = {
            GSPOT_PACKAGE_ARCHIVES: archives,
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
