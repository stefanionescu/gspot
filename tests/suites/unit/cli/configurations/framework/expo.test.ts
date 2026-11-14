import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { createFileTree } from 'testdirs';
import { getTool } from '#cli/manifests/tools.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import type { SpawnResult } from '#cli/types/system.ts';
import { readConfigurations } from '#cli/manifests/read.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { fakeCommands } from '#tests/setup/system/fakes.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { FAILED_DOCTOR_OUTPUT } from '#tests/config/configurations/framework.ts';

const APP_FOLDERS = ['apps/first', 'apps/second'] as const;

const EXPO_PACKAGE_JSON = '{"private":true,"dependencies":{"expo":"54.0.0"}}\n';

async function prepareExpoApps(
    result: Partial<SpawnResult>,
): Promise<AsyncDisposable & { path: string; folders: string[] }> {
    await using resources = new AsyncDisposableStack();
    const outside = await createGitSandbox({
        'gspot.toml': buildSandboxSettings([], {
            scopes: APP_FOLDERS.map((path) => ({ path, configurations: ['expo'] })),
        }),
        [`${GSPOT_PATHS.nodeModules}/.bin/expo-doctor`]: '// The process boundary supplies the Doctor report.\n',
        [`${GSPOT_PATHS.nodeModules}/.bin/expo-doctor.cmd`]: '@echo off\r\n',
        ...Object.fromEntries(
            APP_FOLDERS.flatMap((scope) => [
                [`${scope}/package.json`, EXPO_PACKAGE_JSON],
                [`${scope}/node_modules/expo/package.json`, '{"name":"expo","version":"54.0.0"}\n'],
            ]),
        ),
    });
    const sandbox = resources.use(outside);
    const version = getTool(readConfigurations().values(), 'expo-doctor').version;
    await createFileTree(sandbox.path, {
        [`${GSPOT_PATHS.nodeModules}/expo-doctor/package.json`]: JSON.stringify({ name: 'expo-doctor', version }),
    });
    const folders: string[] = [];
    resources.use(
        fakeCommands().mockImplementation((_command, options) => {
            folders.push(options.cwd);
            return Promise.resolve(buildProcessResult(result));
        }),
    );
    const owned = resources.move();
    return { path: sandbox.path, folders, [Symbol.asyncDispose]: () => owned.disposeAsync() };
}

test('Expo Doctor reports each failed check once in each app folder', async () => {
    await using apps = await prepareExpoApps({ code: 1, stdout: FAILED_DOCTOR_OUTPUT });
    for (const scope of APP_FOLDERS) {
        const findings = await runSandboxCheck(apps.path, 'expo/expo-doctor', { scope });
        expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual(
            [
                'Check that packages match versions required by installed Expo SDK The following packages should be updated for best compatibility with the installed expo version: react-native@0.81.4 - expected version: 0.81.5',
                'Check for app config fields that may not be synced in a non-CNG project This project contains native project folders but also has native configuration properties in app.json.',
            ].map((message) => ({
                file: `${scope}/package.json`,
                line: 1,
                rule: 'failed-check',
                message,
            })),
        );
    }
    expect(apps.folders).toStrictEqual(APP_FOLDERS.map((scope) => join(apps.path, scope)));
});

test('Expo Doctor output without a failed check is a check error that keeps its error text', async () => {
    await using apps = await prepareExpoApps({ code: 1, stderr: 'Unable to read Expo configuration' } as const);
    const error = await captureRejection(runSandboxCheck(apps.path, 'expo/expo-doctor', { scope: APP_FOLDERS[0] }));
    expect(error).toMatchObject({ name: 'CheckStop', status: 'error' });
    expect(error.message).toContain('Unable to read Expo configuration');
});

test('Expo Doctor reports an uninstalled Expo project instead of accepting its empty success', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['expo']),
        'package.json': EXPO_PACKAGE_JSON,
    });

    const uninstalledError = await captureRejection(runSandboxCheck(sandbox.path, 'expo/expo-doctor'));
    expect(uninstalledError).toMatchObject({ name: 'CheckStop', status: 'missing' });
});
