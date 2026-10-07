import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { readFileSync, writeFileSync } from 'node:fs';
import { openSession } from '#cli/commands/session.ts';
import { collectPins } from '#cli/configurations/pins.ts';
import { readTree } from '#tests/harness/preservation.ts';
import { parseToolProject } from '#cli/parsers/packages.ts';
import { applicableManifests } from '#cli/planning/requirements.ts';
import type { ApplyPreviewJson } from '#cli/types/commands/apply.ts';
import type { NpmLockfile } from '#tests/types/cli/commands/mobile-reconciliation.ts';
import { EXPO_DEPENDENCIES, NATIVE_DEPENDENCIES } from '#tests/config/samples/react.ts';

import {
    NPM_SUCCESS,
    NPM_VERSION,
    MOBILE_RECONCILIATION_POLICY,
} from '#tests/config/cli/commands/mobile-reconciliation.ts';

test('Expo appears and disappears with its dependency while native tool options survive and previews match writes', async () => {
    using registry = mockNpmLockfile();
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'package.json');
    await createFileTree(sandbox.path, {
        'gspot.toml': MOBILE_RECONCILIATION_POLICY,
        'package.json': JSON.stringify({ private: true, dependencies: NATIVE_DEPENDENCIES }),
        'src/source.js': 'export const enabled = __DEV__;\n',
    });
    commitAll(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    for (const dependencies of [EXPO_DEPENDENCIES, NATIVE_DEPENDENCIES, EXPO_DEPENDENCIES]) {
        writeFileSync(path, JSON.stringify({ private: true, dependencies }));
        const before = readTree(sandbox.path);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(readTree(sandbox.path)).toStrictEqual(before);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        const policy = readFileSync(join(sandbox.path, 'gspot.toml'), 'utf8');
        expect(policy).toBe((preview.json as ApplyPreviewJson).policy);
        const session = await openSession(sandbox.path);
        const expo = 'expo' in dependencies;
        expect(session.policyFiles.policy.configurations.includes('expo')).toBe(expo);
        const pins = new Set(collectPins(applicableManifests(session)).map((tool) => tool.name));
        expect(pins.has('eslint-plugin-expo')).toBe(expo);
        expect(pins.has('expo-doctor')).toBe(expo);
        expect(parse(policy)).toMatchObject({
            tools: { eslint: { rules: { 'react-native/no-raw-text': [{ skip: ['ProjectText'] }] } } },
        });
        const stable = readTree(sandbox.path);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(readTree(sandbox.path)).toStrictEqual(stable);
    }
    expect(registry.directories).toStrictEqual([]);
    expect(registry.directories).not.toContain(sandbox.path);
});

test('React DOM tools follow the web dependency and leave React available after its removal', async () => {
    using registry = mockNpmLockfile();
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'configurations = ["react"]\n[agent_rules]\nenabled = false\n',
        'package.json': '{"private":true,"dependencies":{"react":"19.1.1","react-dom":"19.1.1"}}\n',
        'src/source.jsx': 'export const App = () => <img src="picture.png" />;\n',
    });
    commitAll(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const web = await openSession(sandbox.path);
    expect(web.policyFiles.policy.configurations).toContain('react-dom');
    expect(collectPins(applicableManifests(web)).map((tool) => tool.name)).toContain('eslint-plugin-jsx-a11y');
    writeFileSync(join(sandbox.path, 'package.json'), '{"private":true,"dependencies":{"react":"19.1.1"}}\n');
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const react = await openSession(sandbox.path);
    expect(react.policyFiles.policy.configurations).not.toContain('react-dom');
    expect(react.policyFiles.policy.configurations).toContain('react');
    expect(collectPins(applicableManifests(react)).map((tool) => tool.name)).not.toContain('eslint-plugin-jsx-a11y');
    expect(registry.directories).toStrictEqual([]);
    expect(registry.directories).not.toContain(sandbox.path);
});

/**
 * Supply npm version and lockfile creation responses at the subprocess boundary.
 * Git reads remain real; unexpected external commands fail the test.
 * @returns a disposer that restores both subprocess boundaries
 */
function mockNpmLockfile(): NpmLockfile {
    const directories: string[] = [];
    const blocking = processes.runBlocking;
    const version = spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
        if (command[0] === 'git') return blocking(command, options);
        if (command[0] !== 'npm' || command[1] !== '--version')
            throw new Error(`Unexpected command: ${command.join(' ')}`);
        return { ...NPM_SUCCESS, stdout: NPM_VERSION };
    });
    const lockfile = spyOn(processes, 'run').mockImplementation((command, options) => {
        if (command[0] !== 'npm') throw new Error(`Unexpected command: ${command.join(' ')}`);
        if (command[1] === '--version') return Promise.resolve({ ...NPM_SUCCESS, stdout: NPM_VERSION });
        if (command[1] !== 'install' || !command.includes('--package-lock-only'))
            throw new Error(`Unexpected npm operation: ${command.join(' ')}`);
        directories.push(options.cwd);
        const project = parseToolProject(readFileSync(join(options.cwd, 'package.json'), 'utf8'));
        writeFileSync(
            join(options.cwd, 'package-lock.json'),
            JSON.stringify({
                lockfileVersion: 3,
                packages: { '': { devDependencies: project.dependencies } },
            }),
        );
        return Promise.resolve(NPM_SUCCESS);
    });
    return {
        directories,
        [Symbol.dispose]() {
            lockfile.mockRestore();
            version.mockRestore();
        },
    };
}
