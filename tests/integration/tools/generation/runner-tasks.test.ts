import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { chmodSync, readFileSync } from 'node:fs';
import { createFileTree, testdir } from 'testdirs';
import { MISE_MIN_VERSION } from '#cli/tools/mise.ts';
import { openSession } from '#cli/execution/session.ts';
import { applyAll } from '#cli/commands/apply/workflow.ts';
import { initCommand } from '#cli/commands/init/command.ts';
import { miseTasks } from '#cli/generation/runner-tasks.ts';
import { parseProfile } from '#cli/policy/profiles/read.ts';
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
        // The authored tasks survive beside the generated ones: the npm scripts, or the mise description.
        const scripts = (
            JSON.parse(runner === 'npm' ? installed : '{"scripts":{}}') as { scripts: Record<string, string> }
        ).scripts;
        const authoredKept =
            runner === 'npm'
                ? scripts['prepare'] === 'authored setup' && scripts['gspot:doctor'] === 'authored doctor'
                : installed.includes('Keep this description');
        expect(authoredKept).toBe(true);
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
        const linked =
            runner === 'mise'
                ? Bun.spawnSync(['mise', 'link', `github:stefanionescu/gspot@${GSPOT_VERSION}`, launcher.path], {
                      cwd: directory.path,
                      env,
                      stdout: 'pipe',
                      stderr: 'pipe',
                      timeout: 10_000,
                  })
                : undefined;
        expect(linked?.exitCode ?? 0, linked?.stderr.toString()).toBe(0);
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
