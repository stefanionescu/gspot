import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { delimiter, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { parse as parseToml } from 'smol-toml';
import { openSession } from '#cli/run/session.ts';
import { applyAll } from '#cli/lifecycle/apply.ts';
import { createFileTree, testdir } from 'testdirs';
import { parseProfile } from '#cli/profile/read.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { exportedProfile } from '#cli/profile/export.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { environmentVariables } from '#cli/platform/environment.ts';
import { uninstallCommand } from '#cli/commands/uninstall/command.ts';
import { configurationManifests } from '#cli/configurations/read-manifests.ts';
import { MISE_MIN_VERSION, miseTasks, pinnedTwice } from '#cli/emit/runner-tasks.ts';

const CLI = fileURLToPath(new URL('../../../packages/cli/src/main.ts', import.meta.url));

test('task mappings validate before mutation, round-trip profiles, and explain the effective names', async () => {
    await using directory = await testdir();
    const policy = 'version = 1\nconfigurations = []\n[runner]\ntool = "npm"\n';
    await createFileTree(directory.path, { 'gspot.toml': policy, 'package.json': '{"private":true}\n' });
    for (const tasks of [{ check: 'prepare' }, { check: 'gspot:fix' }, { check: 'lint', fix: 'lint' }]) {
        const rejected = await run([process.execPath, CLI, 'set', 'runner.tasks', JSON.stringify(tasks), '--json'], {
            cwd: directory.path,
        });
        expect(rejected.code, rejected.stdout + rejected.stderr).toBe(2);
        expect(readFileSync(join(directory.path, 'gspot.toml'), 'utf8')).toBe(policy);
    }
    const tasks = { check: 'lint', fix: 'format' };
    const selected = await run([process.execPath, CLI, 'set', 'runner.tasks', JSON.stringify(tasks), '--json'], {
        cwd: directory.path,
    });
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const written = readFileSync(join(directory.path, 'gspot.toml'), 'utf8');
    expect(
        parseProfile(exportedProfile(written, 'team.profile.toml').text, 'team.profile.toml').tables.runner?.tasks,
    ).toStrictEqual(tasks);
    const explained = await run([process.execPath, CLI, 'explain', 'runner.tasks', '--json'], { cwd: directory.path });
    expect(explained.code, explained.stdout + explained.stderr).toBe(0);
    expect(explained.stdout).toContain('lint');
    await applyAll(await openSession(directory.path));
    expect(JSON.parse(readFileSync(join(directory.path, 'package.json'), 'utf8')).scripts).toStrictEqual({
        lint: 'gspot check',
        format: 'gspot check --fix',
        'gspot:apply': 'gspot apply',
        'gspot:doctor': 'gspot doctor',
    });
    const changed = await run([process.execPath, CLI, 'set', 'runner.tasks', '{"check":"verify"}', '--json'], {
        cwd: directory.path,
    });
    expect(changed.code, changed.stdout + changed.stderr).toBe(0);
    await applyAll(await openSession(directory.path));
    const scripts = JSON.parse(readFileSync(join(directory.path, 'package.json'), 'utf8')).scripts;
    expect(scripts.lint).toBeUndefined();
    expect(scripts.format).toBeUndefined();
    expect(scripts.verify).toBe('gspot check');
});

test.each([undefined, 'yarn'])(
    'Yarn initialization with runner %s writes executable tasks and round-trips the profile',
    async (runner) => {
        await using directory = await testdir();
        await using launcher = await testdir();
        const original =
            '{"name":"fixture","private":true,"packageManager":"yarn@1.22.22","scripts":{"prepare":"authored setup"}}\n';
        await createFileTree(directory.path, { 'package.json': original, 'yarn.lock': '# yarn lockfile v1\n' });
        await createFileTree(launcher.path, {
            'bin/gspot': `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`,
        });
        chmodSync(join(launcher.path, 'bin/gspot'), 0o755);
        const initialized = await initCommand({
            cwd: directory.path,
            yes: true,
            isDryRun: false,
            json: true,
            configurations: ['none'],
            hooks: 'none',
            ci: 'none',
            rules: 'no',
            install: false,
            allowDirty: false,
            ...(runner === undefined ? {} : { runner }),
        });
        expect(initialized.exitCode).toBe(0);
        const policy = readFileSync(join(directory.path, 'gspot.toml'), 'utf8');
        expect(
            parseProfile(exportedProfile(policy, 'team.profile.toml').text, 'team.profile.toml').tables.runner?.tool,
        ).toBe('yarn');
        const executed = Bun.spawnSync(['yarn', '--silent', 'run', 'gspot:check', '--json', 'a b', 'café%'], {
            cwd: directory.path,
            env: {
                ...environmentVariables(),
                PATH: `${join(launcher.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            },
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 10_000,
        });
        expect(executed.exitCode, executed.stdout.toString() + executed.stderr.toString()).toBe(0);
        expect(JSON.parse(executed.stdout.toString())).toStrictEqual(['check', '--json', 'a b', 'café%']);
        expect(JSON.parse(readFileSync(join(directory.path, 'package.json'), 'utf8')).scripts.prepare).toBe(
            'authored setup',
        );
        expect((await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false })).exitCode).toBe(0);
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(original);
    },
);

test.each(['mise', 'npm'] as const)(
    'init adopts existing %s task names, executes their replacements, and restores originals',
    async (runner) => {
        await using directory = await testdir();
        await using launcher = await testdir();
        const original =
            runner === 'mise'
                ? '# Authored tasks\n[tasks]\nlint = "authored lint"\n[tasks.format]\ndescription = "Keep this description"\nrun = ["authored format", "authored verify"]\n'
                : '{"private":true,"scripts":{"lint":"authored lint","format":"authored format","prepare":"authored setup","gspot:doctor":"authored doctor"}}\n';
        const path = runner === 'mise' ? 'mise.toml' : 'package.json';
        await createFileTree(directory.path, { [path]: original });
        await createFileTree(launcher.path, {
            'bin/gspot': `#!${process.execPath}\nconsole.log(JSON.stringify(process.argv.slice(2)));\n`,
        });
        chmodSync(join(launcher.path, 'bin/gspot'), 0o755);
        const initialized = await initCommand({
            cwd: directory.path,
            yes: true,
            isDryRun: false,
            json: true,
            configurations: ['none'],
            hooks: 'none',
            runner,
            ci: 'none',
            rules: 'no',
            install: false,
            allowDirty: false,
        });
        expect(initialized.exitCode).toBe(0);
        expect(parseToml(readFileSync(join(directory.path, 'gspot.toml'), 'utf8'))['runner']).toMatchObject({
            tool: runner,
            tasks: { check: 'lint', fix: 'format' },
        });
        const installed = readFileSync(join(directory.path, path), 'utf8');
        await applyAll(await openSession(directory.path));
        expect(readFileSync(join(directory.path, path), 'utf8')).toBe(installed);
        if (runner === 'npm') {
            expect(JSON.parse(installed).scripts.prepare).toBe('authored setup');
            expect(JSON.parse(installed).scripts['gspot:doctor']).toBe('authored doctor');
        } else expect(installed).toContain('Keep this description');
        const argv =
            runner === 'mise'
                ? ['mise', 'run', '--skip-tools', 'lint', '--', '--json', 'a b']
                : ['npm', 'run', '--silent', 'lint', '--', '--json', 'a b'];
        const env = {
            ...environmentVariables(),
            PATH: `${join(launcher.path, 'bin')}${delimiter}${environmentVariables()['PATH'] ?? ''}`,
            MISE_TRUSTED_CONFIG_PATHS: directory.path,
            MISE_CONFIG_DIR: join(launcher.path, 'config'),
            MISE_DATA_DIR: join(launcher.path, 'data'),
            MISE_STATE_DIR: join(launcher.path, 'state'),
            MISE_CACHE_DIR: join(launcher.path, 'cache'),
            MISE_OFFLINE: '1',
        };
        if (runner === 'mise') {
            const linked = Bun.spawnSync(
                ['mise', 'link', `github:stefanionescu/gspot@${GSPOT_VERSION}`, launcher.path],
                { cwd: directory.path, env, stdout: 'pipe', stderr: 'pipe', timeout: 10_000 },
            );
            expect(linked.exitCode, linked.stderr.toString()).toBe(0);
        }
        const executed = Bun.spawnSync(argv, {
            cwd: directory.path,
            env,
            stdout: 'pipe',
            stderr: 'pipe',
            timeout: 10_000,
        });
        expect(executed.exitCode, executed.stdout.toString() + executed.stderr.toString()).toBe(0);
        expect(JSON.parse(executed.stdout.toString())).toStrictEqual(['check', '--json', 'a b']);
        expect((await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false })).exitCode).toBe(0);
        expect(readFileSync(join(directory.path, path), 'utf8')).toBe(original);
    },
    25_000,
);

test('duplicate pins include only parsed tool keys', async () => {
    await using directory = await testdir();
    const manifests = [...configurationManifests().values()];
    await createFileTree(directory.path, {
        'mise.toml': `[tools]\n'shellcheck' = { version = "0.11.0" }\n"ty\\u0070os" = "1.43.5"\n[env]\nruff = "not a pin"\n[tasks]\nactionlint = "echo not a pin"\n[tasks.check]\nrun = "echo vale = something"\n`,
    });
    expect(
        pinnedTwice(directory.path, manifests)
            .map(({ tool }) => tool)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['shellcheck', 'typos']);
    writeFileSync(
        join(directory.path, 'mise.toml'),
        '[env]\ntypos = "example"\n[tasks]\nshellcheck = "echo example"\n',
    );
    expect(pinnedTwice(directory.path, manifests)).toStrictEqual([]);
    writeFileSync(join(directory.path, 'mise.toml'), '[tools\n');
    expect(() => pinnedTwice(directory.path, manifests)).toThrow();
});

test('mise gives the root task precedence and forwards arguments unchanged', async () => {
    await using directory = await testdir();
    const generated = miseTasks([], '0.1.0', false);
    expect(generated.content).toContain('"github:stefanionescu/gspot" = "0.1.0"');
    await createFileTree(directory.path, {
        [generated.path]: generated.content,
        'mise.toml': `min_version = "${MISE_MIN_VERSION}"\n[tasks."gspot:check"]\nrun = '${process.execPath} capture.ts'\n`,
        'capture.ts': 'console.log(JSON.stringify(process.argv.slice(2)));\n',
    });
    const discovered = Bun.spawnSync(['mise', 'tasks', '--json'], {
        cwd: directory.path,
        env: { ...environmentVariables(), MISE_TRUSTED_CONFIG_PATHS: directory.path, MISE_OFFLINE: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
    });
    expect(discovered.exitCode, discovered.stderr.toString()).toBe(0);
    const tasks = JSON.parse(discovered.stdout.toString()) as { name: string; source: string }[];
    expect(tasks.find((task) => task.name === 'gspot:fix')?.source).toBe(join(directory.path, generated.path));
    const result = Bun.spawnSync(['mise', 'run', '--skip-tools', 'gspot:check', '--', '--json', 'a b', 'café%'], {
        cwd: directory.path,
        env: { ...environmentVariables(), MISE_TRUSTED_CONFIG_PATHS: directory.path, MISE_OFFLINE: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 10_000,
    });
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    expect(JSON.parse(result.stdout.toString())).toStrictEqual(['--json', 'a b', 'café%']);
}, 25_000);
