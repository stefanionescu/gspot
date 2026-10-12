import { join } from 'node:path';
import { parse } from 'smol-toml';
import { test, spyOn, expect } from 'bun:test';
import { commitAll } from '#tests/setup/git.ts';
import { readTree } from '#tests/setup/files.ts';
import { emitAll } from '#cli/generation/files.ts';
import { testdir, createFileTree } from 'testdirs';
import { applyCommand } from '#cli/commands/apply.ts';
import * as processes from '#cli/system/processes.ts';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { collectPins } from '#cli/configurations/tool-pins.ts';
import { NPM_SUCCESS, NPM_VERSION } from '#tests/config/npm.ts';
import { rm, unlink, readFile, writeFile } from 'node:fs/promises';
import type { DryRunJson } from '#cli/types/commands/save-settings.ts';
import { REACT_NATIVE_SETTINGS } from '#tests/config/configurations.ts';
import { EXPO_DEPENDENCIES, REACT_NATIVE_DEPENDENCIES } from '#tests/config/react.ts';

test('Expo stays selected and keeps its tool options while its dependency goes and comes back', async () => {
    const directories: string[] = [];
    const blocking = processes.runBlocking;
    const run = processes.run;
    using resources = new DisposableStack();
    resources.use(
        spyOn(processes, 'runBlocking').mockImplementation((command, options) => {
            if (command[0] !== 'npm') return blocking(command, options);
            if (command[1] !== '--version') throw new Error(`Unexpected command: ${command.join(' ')}`);
            return { ...NPM_SUCCESS, stdout: NPM_VERSION };
        }),
    );
    resources.use(
        spyOn(processes, 'run').mockImplementation((command, options, output) => {
            if (command[0] !== 'npm') return run(command, options, output);
            if (command[1] === '--version') return Promise.resolve({ ...NPM_SUCCESS, stdout: NPM_VERSION });
            directories.push(options.cwd);
            throw new Error(`Unexpected npm operation: ${command.join(' ')}`);
        }),
    );
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'package.json');
    await createFileTree(sandbox.path, {
        'gspot.toml': REACT_NATIVE_SETTINGS,
        'package.json': JSON.stringify({ private: true, dependencies: REACT_NATIVE_DEPENDENCIES }),
        'src/source.js': 'export const enabled = __DEV__;\n',
    });
    commitAll(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    for (const dependencies of [EXPO_DEPENDENCIES, REACT_NATIVE_DEPENDENCIES, EXPO_DEPENDENCIES]) {
        await writeFile(path, JSON.stringify({ private: true, dependencies }));
        const before = await readTree(sandbox.path);
        const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
        expect(await readTree(sandbox.path)).toStrictEqual(before);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        const settings = await readFile(join(sandbox.path, 'gspot.toml'), 'utf8');
        expect(settings).toBe((preview.json as DryRunJson).settings);
        const session = await openSession(sandbox.path);
        expect(session.settingsFile.settings.configurations).toContain('expo');
        const pins = new Set(collectPins(session.neededToolManifests).map((tool) => tool.name));
        expect(pins).toContain('eslint-plugin-expo');
        expect(pins).toContain('expo-doctor');
        expect(parse(settings)).toMatchObject({
            tools: { eslint: { rules: { 'react-native/no-raw-text': [{ skip: ['ProjectText'] }] } } },
        });
        const stable = await readTree(sandbox.path);
        await applyCommand({ cwd: sandbox.path, isDryRun: false });
        expect(await readTree(sandbox.path)).toStrictEqual(stable);
    }
    expect(directories).toStrictEqual([]);
});

test('apply keeps saved configurations, settings, ignores and command checks when their files go', async () => {
    await using sandbox = await testdir();
    const path = join(sandbox.path, 'gspot.toml');
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            tables: `[architecture.roles]
environment_readers = ["source.sh"]
[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
reason = "The launcher intentionally expands its argument list."
[[command_check]]
name = "project/source"
paths = ["*.sh"]
stage = "commit"
command = ["bash", "-n", "{files}"]
`,
        }),
        'source.sh': 'echo source\n',
    });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    await unlink(join(sandbox.path, 'source.sh'));
    const before = await readTree(sandbox.path);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    const planned = (preview.json as DryRunJson).settings;
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readFile(path, 'utf8')).toBe(planned);
    const absent = parse(planned);
    expect(absent['configurations']).toContain('bash');
    expect(absent['architecture']).toMatchObject({ roles: { environment_readers: ['source.sh'] } });
    expect(absent['ignore']).toMatchObject([{ check: 'bash/shellcheck', rule: 'SC2086' }]);
    expect(absent['command_check']).toMatchObject([{ name: 'project/source', command: ['bash', '-n', '{files}'] }]);
    expect(emitAll(await openSession(sandbox.path)).files.map((file) => file.path)).not.toContain(
        '.gspot/config/shellcheckrc',
    );
    await writeFile(join(sandbox.path, 'source.sh'), 'echo restored\n');
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const restored = await openSession(sandbox.path);
    expect(restored.settingsFile.settings.configurations).toContain('bash');
    expect(emitAll(restored).files.find((file) => file.path === '.gspot/config/shellcheckrc')?.content).toContain(
        'SC2086',
    );
    const stable = await readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
});

test('a scope whose folder is gone keeps its settings, and its checks and tool files are not planned', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': settingsText([], {
            tables: `[[ignore]]
check = "bash/shellcheck"
rule = "SC2086"
paths = ["scripts/**"]
reason = "The launcher intentionally expands its arguments."
[[scope]]
path = "scripts"
configurations = ["bash"]
[scope.architecture.roles]
environment_readers = ["scripts/source.sh"]
`,
        }),
        'scripts/source.sh': 'echo source\n',
    });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    await rm(join(sandbox.path, 'scripts'), { recursive: true });
    const before = await readTree(sandbox.path);
    const preview = await applyCommand({ cwd: sandbox.path, isDryRun: true });
    expect(await readTree(sandbox.path)).toStrictEqual(before);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe((preview.json as DryRunJson).settings);
    const absent = await openSession(sandbox.path);
    expect(absent.settingsFile.settings.scope).toMatchObject({
        scripts: { configurations: ['bash'], removed_configurations: [] },
    });
    expect(absent.scopes.map((scope) => scope.scope.path)).toStrictEqual(['']);
    expect(parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8'))).toMatchObject({
        scope: [{ path: 'scripts', architecture: { roles: { environment_readers: ['scripts/source.sh'] } } }],
        ignore: [{ paths: ['scripts/**'], reason: 'The launcher intentionally expands its arguments.' }],
    });
    await createFileTree(sandbox.path, { 'scripts/source.sh': 'echo restored\n' });
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    const restored = await openSession(sandbox.path);
    expect(
        restored.scopes.find((scope) => scope.scope.path === 'scripts')?.view.roles.environment_readers,
    ).toStrictEqual(['scripts/source.sh']);
    const stable = await readTree(sandbox.path);
    await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(await readTree(sandbox.path)).toStrictEqual(stable);
});
