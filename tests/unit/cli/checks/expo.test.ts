import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/system/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildProcessResult } from '#tests/setup/builders.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { DOCTOR_RESULTS, EXPO_DOCTOR_INSTALL, EXPO_SCOPES_SETTINGS } from '#tests/data/checks/expo.ts';

test.each([...DOCTOR_RESULTS])('Expo Doctor runs once in each app folder: $name', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': EXPO_SCOPES_SETTINGS,
        ...EXPO_DOCTOR_INSTALL,
        ...Object.fromEntries(
            ['apps/first', 'apps/second'].flatMap((scope) => [
                [`${scope}/package.json`, '{"private":true,"dependencies":{"expo":"54.0.0"}}\n'],
                [`${scope}/node_modules/expo/package.json`, '{"name":"expo","version":"54.0.0"}\n'],
            ]),
        ),
    });
    const version = getToolDeclaration(readManifests(createReadCache(process.cwd())).values(), 'expo-doctor').version;
    await createFileTree(sandbox.path, {
        '.gspot/node_modules/expo-doctor/package.json': JSON.stringify({ name: 'expo-doctor', version }),
    });
    const folders: string[] = [];
    const runBlocking = processes.spawnProcessBlocking;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'spawnProcessBlocking').mockImplementation((command, options) =>
            command[0] === 'git' ? runBlocking(command, options) : buildProcessResult({ stdout: String(version) }),
        ),
    );
    resources.use(
        spyOn(processes, 'spawnProcess').mockImplementation((_command, options) => {
            folders.push(options.cwd);
            return Promise.resolve(entry.result);
        }),
    );

    for (const scope of ['apps/first', 'apps/second']) {
        if (typeof entry.expected === 'string') {
            expect(await captureRejection(checkFindings(sandbox.path, 'expo/expo-doctor', { scope }))).toBe(
                entry.expected,
            );
            continue;
        }
        const findings = await checkFindings(sandbox.path, 'expo/expo-doctor', { scope });
        expect(findings).toStrictEqual(
            entry.expected.map((message) => ({
                check: 'expo/expo-doctor',
                file: `${scope}/package.json`,
                line: 1,
                rule: 'failed-check',
                help: 'Follow the advice Expo Doctor prints, then run `npx expo install --check`.',
                message: message,
                fixable: false,
            })),
        );
    }
    expect(folders).toStrictEqual([join(sandbox.path, 'apps/first'), join(sandbox.path, 'apps/second')]);
});

test('Expo Doctor reports an uninstalled Expo project instead of accepting its empty success', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["expo"]\n[rules]\nenabled = false\n',
        'package.json': '{"private":true,"dependencies":{"expo":"54.0.0"}}\n',
    });

    expect(await captureRejection(checkFindings(sandbox.path, 'expo/expo-doctor'))).toBe(
        'Expo is not installed in this scope; Expo Doctor reads an installed Expo project.',
    );
});
