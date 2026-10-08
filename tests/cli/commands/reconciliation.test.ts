import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import * as processes from '#cli/platform/spawn.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { collectPins } from '#cli/configurations/pins.ts';
import { readTree } from '#tests/harness/preservation.ts';
import type { ApplyPlanJson } from '#cli/types/commands/apply.ts';
import { rm, unlink, readFile, writeFile } from 'node:fs/promises';
import { applicableManifests } from '#cli/planning/requirements.ts';
import type { NpmLockfile } from '#tests/types/cli/commands/reconciliation.ts';
import { EXPO_DEPENDENCIES, NATIVE_DEPENDENCIES } from '#tests/config/samples/react.ts';
import { NPM_SUCCESS, NPM_VERSION, MOBILE_RECONCILIATION_POLICY } from '#tests/config/cli/commands/reconciliation.ts';

test('Expo choices survive dependency removal while native tool options and previewed writes agree', async () => {
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
        await writeFile(path, JSON.stringify({ private: true, dependencies }));
        const before = await readTree(sandbox.path);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        const policy = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
        expect(policy).toBe((preview.json as ApplyPlanJson).policy);
        const session = await openSession(sandbox.path);
        expect(session.policyFiles.policy.configurations).toContain('expo');
        const pins = new Set(collectPins(applicableManifests(session)).map((tool) => tool.name));
        expect(pins).toContain('eslint-plugin-expo');
        expect(pins).toContain('expo-doctor');
        expect(parse(policy)).toMatchObject({
            tools: { eslint: { rules: { 'react-native/no-raw-text': [{ skip: ['ProjectText'] }] } } },
        });
        const stable = await readTree(sandbox.path);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(await readTree(sandbox.path)).toStrictEqual(stable);
    }
    expect(registry.directories).toStrictEqual([]);
});

test('React DOM and React choices retain their tools after dependency evidence disappears', async () => {
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
    await writeFile(join(sandbox.path, 'package.json'), '{"private":true,"dependencies":{"react":"19.1.1"}}\n');
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const react = await openSession(sandbox.path);
    expect(react.policyFiles.policy.configurations).toContain('react-dom');
    expect(react.policyFiles.policy.configurations).toContain('react');
    expect(collectPins(applicableManifests(react)).map((tool) => tool.name)).toContain('eslint-plugin-jsx-a11y');
    expect(registry.directories).toStrictEqual([]);
});

/**
 * Supply npm version responses at the subprocess boundary.
 * Git reads remain real; unexpected npm operations fail the test.
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
        directories.push(options.cwd);
        throw new Error(`Unexpected npm operation: ${command.join(' ')}`);
    });
    return {
        directories,
        [Symbol.dispose]() {
            lockfile.mockRestore();
            version.mockRestore();
        },
    };
}

test('apply retains saved stack choices, settings and command checks when source evidence disappears', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: '[agent_rules]\nenabled = false\n[bash]\nsafety_owners = ["source.sh"]\n[reasons]\n"bash.safety_owners" = "The launcher owns process management."\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\nreason = "The launcher intentionally expands its argument list."\n[check."project/source"]\npaths = ["*.sh"]\nstage = "commit"\ncommand = ["bash", "-n", "{files}"]\n',
        }),
        'source.sh': 'echo source\n',
    });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    await unlink(join(sandbox.path, 'source.sh'));
    const before = await readTree(sandbox.path);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const planned = (preview.json as ApplyPlanJson).policy;
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readFile(path, 'utf8')).toBe(planned);
    const absent = parse(planned);
    expect(absent['configurations']).toContain('bash');
    expect(absent['bash']).toMatchObject({ safety_owners: ['source.sh'] });
    expect(absent['ignore']).toMatchObject([{ check: 'bash/shellcheck', rule: 'SC2086' }]);
    expect(absent['check']).toMatchObject({ 'project/source': { command: ['bash', '-n', '{files}'] } });
    expect(emitAll(await openSession(sandbox.path)).files.map((file) => file.path)).not.toContain(
        '.gspot/config/shellcheckrc',
    );
    await writeFile(join(sandbox.path, 'source.sh'), 'echo restored\n');
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const restored = await openSession(sandbox.path);
    expect(restored.policyFiles.policy.configurations).toContain('bash');
    expect(emitAll(restored).files.find((file) => file.path === '.gspot/config/shellcheckrc')?.content).toContain(
        'SC2086',
    );
    const stable = await readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
});

test('absent scopes retain authored settings without planning their checks or tool configurations', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], {
            tables: '[agent_rules]\nenabled = false\n[[ignore]]\ncheck = "bash/shellcheck"\nrule = "SC2086"\npaths = ["scripts/**"]\nreason = "The launcher intentionally expands its arguments."\n[scope."scripts"]\nconfigurations = ["bash"]\n[scope."scripts".bash]\nsafety_owners = ["source.sh"]\n[scope."scripts".reasons]\n"bash.safety_owners" = "The launcher owns process management."\n',
        }),
        'scripts/source.sh': 'echo source\n',
    });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    await rm(join(sandbox.path, 'scripts'), { recursive: true });
    const before = await readTree(sandbox.path);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe((preview.json as ApplyPlanJson).policy);
    const absent = await openSession(sandbox.path);
    expect(absent.policyFiles.policy.scope).toStrictEqual({
        scripts: { configurations: ['bash'], removed_configurations: [] },
    });
    expect(absent.scopes.map((scope) => scope.scope.path)).toStrictEqual(['']);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).toMatchObject({
        scope: { scripts: { bash: { safety_owners: ['source.sh'] } } },
        ignore: [{ paths: ['scripts/**'], reason: 'The launcher intentionally expands its arguments.' }],
    });
    await createFileTree(sandbox.path, { 'scripts/source.sh': 'echo restored\n' });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const restored = await openSession(sandbox.path);
    expect(
        restored.scopes.find((scope) => scope.scope.path === 'scripts')?.view.settings['bash.safety_owners'],
    ).toStrictEqual(['scripts/source.sh']);
    const stable = await readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
});
