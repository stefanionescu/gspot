import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { rejection } from '#tests/setup/matchers.ts';
import * as processes from '#cli/system/processes.ts';
import { checkFindings } from '#tests/setup/check-input.ts';
import { DOCTOR_RESULTS, DOCTOR_VERSION, EXPO_DOCTOR_INSTALL, EXPO_SCOPES_SETTINGS } from '#tests/config/expo.ts';

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
    const directories: string[] = [];
    const runBlocking = processes.runBlocking;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'runBlocking').mockImplementation((command, options) =>
            command[0] === 'git' ? runBlocking(command, options) : DOCTOR_VERSION,
        ),
    );
    resources.use(
        spyOn(processes, 'run').mockImplementation((_command, options) => {
            directories.push(options.cwd);
            return Promise.resolve(entry.result);
        }),
    );

    for (const scope of ['apps/first', 'apps/second']) {
        if (typeof entry.expected === 'string') {
            expect(await rejection(checkFindings(sandbox.path, 'expo/doctor', { scope }))).toBe(entry.expected);
            continue;
        }
        const findings = await checkFindings(sandbox.path, 'expo/doctor', { scope });
        expect(findings).toStrictEqual(
            entry.expected.map((diagnostic) => ({
                check: 'expo/doctor',
                file: `${scope}/package.json`,
                line: 1,
                rule: 'failed-check',
                help: 'Read the issues and advice Expo Doctor prints for the failed check, then run npx expo install --check.',
                message: diagnostic,
                fixable: false,
            })),
        );
    }
    expect(directories).toStrictEqual([join(sandbox.path, 'apps/first'), join(sandbox.path, 'apps/second')]);
});

test('Expo Doctor reports an uninstalled Expo project instead of accepting its empty success', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["expo"]\n[rules]\nenabled = false\n',
        'package.json': '{"private":true,"dependencies":{"expo":"54.0.0"}}\n',
    });

    expect(await rejection(checkFindings(sandbox.path, 'expo/doctor'))).toBe(
        'Expo is not installed in this scope; Expo Doctor reads an installed Expo project.',
    );
});
