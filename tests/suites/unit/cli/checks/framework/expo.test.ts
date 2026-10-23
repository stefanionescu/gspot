import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { GSPOT_PATHS } from '#cli/config/gspot-folder.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { getTool } from '#cli/configurations/declared-tools.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { readConfigurations } from '#cli/configurations/manifests.ts';
import { buildProcessResult } from '#tests/setup/system/processes.ts';

import {
    APP_FOLDERS,
    FAILED_DOCTOR_RUN,
    EXPO_PACKAGE_JSON,
    EXPO_DOCTOR_INSTALL,
    EXPO_SCOPE_SETTINGS,
    UNSTRUCTURED_DOCTOR_RUN,
    DOCTOR_FINDING_MESSAGES,
    INSTALLED_EXPO_PACKAGE_JSON,
} from '#tests/config/checks/framework/expo.ts';

test('Expo Doctor reports each failed check once in each app folder', async () => {
    await using apps = await prepareExpoApps(FAILED_DOCTOR_RUN);
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
    await using apps = await prepareExpoApps(UNSTRUCTURED_DOCTOR_RUN);
    for (const scope of APP_FOLDERS)
        expect(await captureRejection(runSandboxCheck(apps.path, 'expo/expo-doctor', { scope }))).toBe(
            'The expo-doctor command failed (exit 1): Unable to read Expo configuration',
        );
    expect(apps.folders).toStrictEqual(APP_FOLDERS.map((scope) => join(apps.path, scope)));
});

test('Expo Doctor reports an uninstalled Expo project instead of accepting its empty success', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['expo']),
        'package.json': EXPO_PACKAGE_JSON,
    });

    expect(await captureRejection(runSandboxCheck(sandbox.path, 'expo/expo-doctor'))).toBe(
        'Install the project dependencies of this scope; Expo Doctor reads an installed Expo project.',
    );
});

/**
 * Write two installed Expo apps, and fake Expo Doctor so that each run returns this result.
 *
 * @param result what each Expo Doctor run returns.
 * @returns the sandbox folder and the folders Expo Doctor ran in, which the disposal removes.
 */
async function prepareExpoApps(
    result: Partial<SpawnResult>,
): Promise<AsyncDisposable & { path: string; folders: string[] }> {
    await using resources = new AsyncDisposableStack();
    const sandbox = resources.use(
        await testdir({
            'gspot.toml': EXPO_SCOPE_SETTINGS,
            ...EXPO_DOCTOR_INSTALL,
            ...Object.fromEntries(
                APP_FOLDERS.flatMap((scope) => [
                    [`${scope}/package.json`, EXPO_PACKAGE_JSON],
                    [`${scope}/node_modules/expo/package.json`, INSTALLED_EXPO_PACKAGE_JSON],
                ]),
            ),
        }),
    );
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
