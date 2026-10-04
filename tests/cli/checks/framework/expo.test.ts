import { join } from 'node:path';
import { test, spyOn, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { expoDoctor } from '#cli/checks/framework/expo.ts';
import { rejection } from '#tests/harness/expectations.ts';
import { DOCTOR_RESULTS, DOCTOR_VERSION } from '#tests/config/cli/checks/expo.ts';

test.each(DOCTOR_RESULTS)('Expo Doctor preserves scoped orchestration for $name', async (entry) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml':
            'configurations = []\n[[scope]]\npath = "apps/first"\nconfigurations = ["expo"]\n[[scope]]\npath = "apps/second"\nconfigurations = ["expo"]\n[agent_rules]\nenabled = false\n',
        '.gspot/node_modules/.bin/expo-doctor': '// The process boundary supplies the Doctor report.\n',
        '.gspot/node_modules/.bin/expo-doctor.cmd': '@echo off\r\n',
        '.gspot/node_modules/expo-doctor/package.json': '{"name":"expo-doctor","version":"1.20.4"}\n',
        ...Object.fromEntries(
            ['apps/first', 'apps/second'].flatMap((scope) => [
                [`${scope}/package.json`, '{"private":true,"dependencies":{"expo":"54.0.0"}}\n'],
                [`${scope}/node_modules/expo/package.json`, '{"name":"expo","version":"54.0.0"}\n'],
            ]),
        ),
    });
    const inputs = await Promise.all(
        ['apps/first', 'apps/second'].map(async (scope) =>
            buildEngineInput(await openSession(sandbox.path), 'expo/doctor', { scope }),
        ),
    );
    const directories: string[] = [];
    const runBlocking = processes.runBlocking;
    const version = spyOn(processes, 'runBlocking').mockImplementation((command, options) =>
        command[0] === 'git' ? runBlocking(command, options) : DOCTOR_VERSION,
    );
    const run = spyOn(processes, 'run').mockImplementation((_command, options) => {
        directories.push(options.cwd);
        return Promise.resolve(entry.result);
    });
    try {
        for (const input of inputs) {
            if (typeof entry.expected === 'string') {
                expect(await rejection(expoDoctor(input))).toBe(entry.expected);
                continue;
            }
            const findings = await expoDoctor(input);
            expect(findings).toStrictEqual(
                entry.expected.map((diagnostic) => ({
                    check: 'expo/doctor',
                    file: `${input.scope}/package.json`,
                    line: 1,
                    rule: 'failed-check',
                    message: diagnostic,
                    fixable: false,
                })),
            );
        }
        expect(directories).toStrictEqual([join(sandbox.path, 'apps/first'), join(sandbox.path, 'apps/second')]);
    } finally {
        run.mockRestore();
        version.mockRestore();
    }
});

test('Expo Doctor reports an uninstalled Expo project instead of accepting its empty success', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["expo"]\n[agent_rules]\nenabled = false\n',
        'package.json': '{"private":true,"dependencies":{"expo":"54.0.0"}}\n',
    });
    const input = buildEngineInput(await openSession(sandbox.path), 'expo/doctor');
    expect(await rejection(expoDoctor(input))).toBe(
        'Expo is not installed in this scope; Expo Doctor reads an installed Expo project.',
    );
});
