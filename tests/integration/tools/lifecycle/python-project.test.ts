import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import { run } from '#cli/platform/spawn.ts';
import { testdir, createFileTree } from 'testdirs';
import { everyManifest } from '#cli/kits/select.ts';
import { gitOutput } from '#tests/support/cli/git.ts';
import type { InstallJson } from '#cli/types/commands.ts';
import { rejection } from '#tests/support/expectations.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { runOwnedLifecycle } from '#cli/lifecycle/ownership/owner.ts';
import { toolEnvironment } from '#cli/generation/tools/environment.ts';
import { createPythonRegistry } from '#tests/support/registry/python.ts';
import { onPosix, venvExecutable } from '#tests/support/cli/platforms.ts';
import { PYTHON_PROJECTS } from '#tests/inputs/integration/tools/python.ts';
import { preparePythonInstallation } from '#tests/support/cli/python/project.ts';
import { cpSync, chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { pythonLockDrift, pythonInstallSteps, installPythonProject, preparePythonProject } from '#cli/tools/python.ts';

// A Windows virtual environment has launchers and no interpreter links; the windows-launcher tests cover it.

if (onPosix)
    test.each(PYTHON_PROJECTS)(
        'private Python CLI installation preserves authored and generated inputs with %s and %s',
        async (configuration, runner) => {
            await using repository = await testdir();
            await using artifacts = await testdir();
            await using registry = await createPythonRegistry(artifacts.path);
            await using prepared = await preparePythonInstallation(
                repository.path,
                configuration,
                runner,
                registry.url,
            );
            const { plans, rootProject, rootConfiguration } = prepared;
            const manifest = readFileSync(join(repository.path, '.gspot/pyproject.toml'));
            const lockPath = join(repository.path, '.gspot/uv.lock');
            const lock = readFileSync(lockPath);
            expect(plans[0]!.content).toContain(`ruff==${registry.pinned}`);
            expect(pythonInstallSteps(repository.path)).toStrictEqual([
                ['uv', 'sync', '--locked', '--project', '.gspot'],
            ]);
            expect(lock.toString('utf8')).not.toContain('synthetic-uv-password');
            await createFileTree(artifacts.path, { 'bin/uv': '#!/bin/sh\nexit 87\n' });
            chmodSync(join(artifacts.path, 'bin/uv'), 0o755);
            const command = await run(
                [
                    process.execPath,
                    fileURLToPath(new URL('../../../../packages/cli/src/main.ts', import.meta.url)),
                    'install',
                    '--json',
                ],
                {
                    cwd: repository.path,
                    env: {
                        ...(runner === 'mise'
                            ? { PATH: `${join(artifacts.path, 'bin')}:${environmentVariables()['PATH'] ?? ''}` }
                            : {}),
                        MISE_TRUSTED_CONFIG_PATHS: repository.path,
                        MISE_STATE_DIR: join(artifacts.path, 'mise-state'),
                        MISE_CACHE_DIR: join(artifacts.path, 'mise-cache'),
                        MISE_CONFIG_DIR: join(artifacts.path, 'mise-config'),
                    },
                },
            );
            expect(command.code, command.stdout + command.stderr).toBe(2);
            expect((JSON.parse(command.stdout) as InstallJson).error).toContain('Run: gspot apply, then gspot install');
            expect((JSON.parse(command.stdout) as InstallJson).error).toContain('installed locked Python tools');
            expect(readFileSync(join(repository.path, 'pyproject.toml'))).toStrictEqual(rootProject);
            expect(readFileSync(join(repository.path, '.venv/authored.txt'), 'utf8')).toBe(
                'keep the project environment',
            );
            expect(readFileSync(join(repository.path, '.gspot/pyproject.toml'))).toStrictEqual(manifest);
            expect(readFileSync(lockPath)).toStrictEqual(lock);
            expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
        },
        120_000,
    );

if (onPosix)
    test.each([
        ['uv.toml', 'none'],
        ['pyproject.toml', 'none'],
    ] as const)(
        'fresh Python clones install immutable inputs twice and run their tools from any location with %s and %s',
        async (configuration, runner) => {
            await using repository = await testdir();
            await using artifacts = await testdir();
            await using registry = await createPythonRegistry(artifacts.path);
            await using prepared = await preparePythonInstallation(
                repository.path,
                configuration,
                runner,
                registry.url,
            );
            const { rootConfiguration } = prepared;
            const manifest = readFileSync(join(repository.path, '.gspot/pyproject.toml'));
            const lockPath = join(repository.path, '.gspot/uv.lock');
            const lock = readFileSync(lockPath);
            const clone = join(artifacts.path, 'clone');
            for (const args of [
                ['init', '--quiet'],
                ['add', '--all'],
                ['-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'Fixture'],
                ['clone', '--quiet', '--no-local', repository.path, clone],
            ])
                gitOutput(repository.path, args);
            expect(existsSync(join(clone, '.gspot/.venv'))).toBe(false);
            expect(existsSync(join(clone, '.gspot/state/ownership.json'))).toBe(false);
            for (let attempt = 0; attempt < 2; attempt++) {
                expect(await installPythonProject(clone)).toContain('installed locked Python tools');
                const status = await run(['git', 'status', '--porcelain'], { cwd: clone });
                expect(status, status.stderr).toMatchObject({ code: 0, stdout: '' });
                expect({
                    manifest: readFileSync(join(clone, '.gspot/pyproject.toml')),
                    lock: readFileSync(join(clone, '.gspot/uv.lock')),
                    configuration: readFileSync(join(clone, configuration)),
                }).toStrictEqual({ manifest, lock, configuration: rootConfiguration });
            }
            const prefix = await run([venvExecutable(join(clone, '.gspot/.venv'), 'gspot-relocation-marker')], {
                cwd: clone,
            });
            expect(prefix.code, prefix.stderr).toBe(0);
            expect(realpathSync(prefix.stdout.trim())).toBe(realpathSync(join(clone, '.gspot/.venv')));
            // A copied environment runs its console scripts from the copy.
            const copied = join(artifacts.path, 'relocated environment');
            cpSync(join(clone, '.gspot/.venv'), copied, { recursive: true, verbatimSymlinks: true });
            const relocated = await run([venvExecutable(copied, 'gspot-relocation-marker')], { cwd: artifacts.path });
            expect(relocated.code, relocated.stderr).toBe(0);
            expect(realpathSync(relocated.stdout.trim())).toBe(realpathSync(copied));
        },
        120_000,
    );

if (onPosix)
    test.each([['uv.toml', 'none']] as const)(
        'conflicted Python locks refuse installation until generated repair with %s and %s',
        async (configuration, runner) => {
            await using repository = await testdir();
            await using artifacts = await testdir();
            await using registry = await createPythonRegistry(artifacts.path);
            await using prepared = await preparePythonInstallation(
                repository.path,
                configuration,
                runner,
                registry.url,
            );
            const { scopes, rootConfiguration } = prepared;
            const lockPath = join(repository.path, '.gspot/uv.lock');
            const lock = readFileSync(lockPath);
            await installPythonProject(repository.path);
            chmodSync(lockPath, 0o644);
            writeFileSync(lockPath, '<<<<<<< interrupted lock\n');
            expect(() => pythonInstallSteps(repository.path)).toThrow('Run: gspot apply, then gspot install');
            expect(await rejection(installPythonProject(repository.path))).toContain(
                'Run: gspot apply, then gspot install',
            );
            const repaired = toolEnvironment(everyManifest(scopes));
            await runOwnedLifecycle(repository.path, async (owner) => {
                await preparePythonProject(repository.path, repaired, owner);
                for (const file of repaired)
                    owner.replace(
                        file.path,
                        { bytes: Buffer.from(file.content), mode: 0o444 },
                        file.kind === 'lock' ? 'lock' : 'config',
                        file.kind === 'lock',
                        file.read,
                    );
            });
            expect(pythonLockDrift(repository.path, repaired)).toStrictEqual({ path: '.gspot/uv.lock' });
            await installPythonProject(repository.path);
            expect(readFileSync(lockPath)).toStrictEqual(lock);
            expect(readFileSync(join(repository.path, configuration))).toStrictEqual(rootConfiguration);
        },
        120_000,
    );
