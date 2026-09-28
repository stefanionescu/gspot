import { test, expect } from 'bun:test';
import { join, delimiter } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { chmodSync, readFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { miseTasks } from '#cli/generation/runner/tasks.ts';
import { parseProfile } from '#cli/policy/profiles/read.ts';
import { MISE_MIN_VERSION } from '#cli/config/tools/tools.ts';
import { uninstallCommand } from '#cli/commands/uninstall.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { exportedProfile } from '#cli/policy/profiles/export.ts';
import { environmentVariables } from '#cli/platform/environment.ts';

const { version: GSPOT_VERSION } = packageManifest;

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
        expect(
            (
                JSON.parse(readFileSync(join(directory.path, 'package.json'), 'utf8')) as {
                    scripts: Record<string, string>;
                }
            ).scripts['prepare'],
        ).toBe('authored setup');
        const uninstalled = await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(directory.path, 'package.json'), 'utf8')).toBe(original);
    },
);

test.each([
    {
        runner: 'mise' as const,
        original:
            '# Authored tasks\n[tasks]\nlint = "authored lint"\n[tasks.format]\ndescription = "Keep this description"\nrun = ["authored format", "authored verify"]\n',
        path: 'mise.toml',
        parse: parseToml,
        retained: { tasks: { format: { description: 'Keep this description' } } },
        argv: ['mise', 'run', '--skip-tools', 'lint', '--', '--json', 'a b'],
        links: [['mise', 'link', `github:stefanionescu/gspot@${GSPOT_VERSION}`]],
    },
    {
        runner: 'npm' as const,
        original:
            '{"private":true,"scripts":{"lint":"authored lint","format":"authored format","prepare":"authored setup","gspot:doctor":"authored doctor"}}\n',
        path: 'package.json',
        parse: JSON.parse,
        retained: { scripts: { prepare: 'authored setup', 'gspot:doctor': 'authored doctor' } },
        argv: ['npm', 'run', '--silent', 'lint', '--', '--json', 'a b'],
        links: [],
    },
])(
    'init adopts existing $runner task names, executes their replacements, and restores originals',
    async ({ runner, original, path, parse, retained, argv, links }) => {
        await using directory = await testdir();
        await using launcher = await testdir();
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
        expect(parse(installed)).toMatchObject(retained);
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
        const options = { cwd: directory.path, env, stdout: 'pipe' as const, stderr: 'pipe' as const, timeout: 10_000 };
        for (const link of links) {
            const linked = Bun.spawnSync([...link, launcher.path], options);
            expect(linked.exitCode, linked.stderr.toString()).toBe(0);
        }
        const executed = Bun.spawnSync([...argv], options);
        expect(executed.exitCode, executed.stdout.toString() + executed.stderr.toString()).toBe(0);
        expect(JSON.parse(executed.stdout.toString())).toStrictEqual(['check', '--json', 'a b']);
        const uninstalled = await uninstallCommand({ cwd: directory.path, yes: true, isDryRun: false });
        expect(uninstalled.exitCode).toBe(0);
        expect(readFileSync(join(directory.path, path), 'utf8')).toBe(original);
    },
    25_000,
);

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
