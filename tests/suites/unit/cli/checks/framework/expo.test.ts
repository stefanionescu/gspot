import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { getTool } from '#cli/configurations/tools.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { type SpawnResult } from '#cli/types/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

import {
    APP_FOLDERS,
    EXPO_PACKAGE_JSON,
    EXPO_DOCTOR_INSTALL,
    EXPO_SCOPE_SETTINGS,
    FAILED_DOCTOR_REPORT,
    INSTALLED_EXPO_PACKAGE_JSON,
} from '#tests/config/checks/framework/expo.ts';

test('Expo Doctor reports each failed check once in each app folder', async () => {
    const DOCTOR_FINDING_MESSAGES = [
        'Check that packages match versions required by installed Expo SDK The following packages should be updated for best compatibility with the installed expo version: react-native@0.81.4 - expected version: 0.81.5',
        'Check for app config fields that may not be synced in a non-CNG project This project contains native project folders but also has native configuration properties in app.json.',
    ] as const;

    await using apps = await prepareExpoApps({ code: 1, stdout: FAILED_DOCTOR_REPORT });
    for (const scope of APP_FOLDERS) {
        const findings = await runSandboxCheck(apps.path, 'expo/expo-doctor', { scope });
        expect(findings.map(({ file, line, rule, message }) => ({ file, line, rule, message }))).toStrictEqual(
            DOCTOR_FINDING_MESSAGES.map((message) => ({
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
    const UNSTRUCTURED_DOCTOR_RUN = { code: 1, stderr: 'Unable to read Expo configuration' } as const;

    await using apps = await prepareExpoApps(UNSTRUCTURED_DOCTOR_RUN);
    for (const scope of APP_FOLDERS) {
        const runSandboxCheckError = await captureRejection(runSandboxCheck(apps.path, 'expo/expo-doctor', { scope }));
        expect(runSandboxCheckError.message).toBe(
            'The expo-doctor command failed (exit 1): Unable to read Expo configuration',
        );
    }
    expect(apps.folders).toStrictEqual(APP_FOLDERS.map((scope) => join(apps.path, scope)));
});

test('Expo Doctor reports an uninstalled Expo project instead of accepting its empty success', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['expo']),
        'package.json': EXPO_PACKAGE_JSON,
    });

    const uninstalledError = await captureRejection(runSandboxCheck(sandbox.path, 'expo/expo-doctor'));
    expect(uninstalledError.message).toBe(
        'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.',
    );
});

async function prepareExpoApps(
    result: Partial<SpawnResult>,
): Promise<AsyncDisposable & { path: string; folders: string[] }> {
    await using resources = new AsyncDisposableStack();
    const observed = await testdir({
        'gspot.toml': EXPO_SCOPE_SETTINGS,
        ...EXPO_DOCTOR_INSTALL,
        ...Object.fromEntries(
            APP_FOLDERS.flatMap((scope) => [
                [`${scope}/package.json`, EXPO_PACKAGE_JSON],
                [`${scope}/node_modules/expo/package.json`, INSTALLED_EXPO_PACKAGE_JSON],
            ]),
        ),
    });
    const sandbox = resources.use(observed);
    const version = getTool(readConfigurations().values(), 'expo-doctor').version;
    await createFileTree(sandbox.path, {
        [`${GSPOT_PATHS.nodeModules}/expo-doctor/package.json`]: JSON.stringify({ name: 'expo-doctor', version }),
    });
    const folders: string[] = [];
    const runBlocking = processes.spawnProcessBlocking;
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
            command[0] === 'git' ? runBlocking(command, options) : buildProcessResult({ stdout: String(version) }),
        ),
    );
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((_command, options) => {
            folders.push(options.cwd);
            return Promise.resolve(buildProcessResult(result));
        }),
    );
    const owned = resources.move();
    return { path: sandbox.path, folders, [Symbol.asyncDispose]: () => owned.disposeAsync() };
}
