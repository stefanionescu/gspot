import { expect, test } from 'bun:test';
import { delimiter, join } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/execution/session.ts';
import { createFileTree, testdir } from 'testdirs';
import { hookStatus } from '#cli/lifecycle/hooks.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { installHookManager } from '#cli/lifecycle/hook-managers.ts';
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

test.each(['lefthook', 'simple-git-hooks', 'husky', 'pre-commit'])(
    'a fresh %s clone installs without tracked changes and enforces staged source through real commits',
    async (manager) => {
        await using repository = await testdir();
        await using clone = await testdir();
        const main = join(import.meta.dir, '../../../../packages/cli/src/main.ts');
        await createFileTree(repository.path, {
            '.gitignore': 'node_modules/\n.venv/\npre-commit-cache/\n.hook-observed\n',
            ...(manager === 'pre-commit'
                ? {
                      'pyproject.toml':
                          '[project]\nname = "hook-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\ndependencies = ["pre-commit==4.5.1"]\n',
                      '.pre-commit-config.yaml':
                          "repos:\n  - repo: local\n    hooks:\n      - id: authored\n        name: authored\n        entry: sh -c 'printf authored >> .hook-observed'\n        language: system\n        stages: [pre-commit]\n        pass_filenames: false\n        always_run: true\n",
                  }
                : {
                      'package.json':
                          JSON.stringify({
                              private: true,
                              devDependencies: {
                                  [manager]:
                                      manager === 'lefthook' ? '2.0.13' : manager === 'husky' ? '9.1.7' : '2.13.1',
                              },
                              ...(manager === 'simple-git-hooks'
                                  ? { 'simple-git-hooks': { 'pre-commit': 'printf authored >> .hook-observed' } }
                                  : {}),
                          }) + '\n',
                  }),
            'gspot.toml': `version = 1
configurations = []
[rules]
install = false
[hooks]
tool = "${manager}"
[[check]]
name = "fixture/source"
command = [${JSON.stringify(process.execPath)}, "check-source.mjs", "{files}"]
paths = ["source.txt"]
stage = "commit"
summary = "Rejects forbidden source text."
help = "Remove the forbidden token."
[check.output]
format = "lines"
`,
            'source.txt': 'allowed\n',
            'check-source.mjs':
                'for (const path of process.argv.slice(2)) { if ((await Bun.file(path).text()).includes("forbidden")) { console.log(`${path}:1:1: forbidden source token`); process.exitCode = 1; } }\n',
            ...(manager === 'lefthook'
                ? {
                      'lefthook.yml':
                          'pre-commit:\n  commands:\n    authored:\n      run: printf authored >> .hook-observed\n',
                  }
                : {}),
            ...(manager === 'husky' ? { '.husky/pre-commit': 'printf authored >> .hook-observed\nexit 0\n' } : {}),
            'bin/gspot': `#!${process.execPath}\nconst child = Bun.spawnSync([process.execPath, ${JSON.stringify(main)}, ...process.argv.slice(2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' }); process.exit(child.exitCode);\n`,
        });
        chmodSync(join(repository.path, 'bin/gspot'), 0o755);
        for (const command of [
            ['git', 'init', '--quiet'],
            ...(manager === 'pre-commit'
                ? [
                      ['uv', 'lock'],
                      ['uv', 'sync', '--frozen', '--no-install-project'],
                  ]
                : [['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund']]),
        ]) {
            const result = await run(command, { cwd: repository.path, timeoutMs: 60_000 });
            expect(result.code, result.stderr).toBe(0);
        }
        expect((await applyCommand({ cwd: repository.path, isDryRun: false })).exitCode).toBe(0);
        for (const command of [
            ['git', 'add', '--all'],
            ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
            ['git', 'clone', '--quiet', '--no-local', repository.path, clone.path],
        ]) {
            const result = await run(command, { cwd: repository.path });
            expect(result.code, result.stderr).toBe(0);
        }
        expect(existsSync(join(clone.path, '.gspot/state/ownership.json'))).toBe(false);
        expect(existsSync(join(clone.path, 'node_modules'))).toBe(false);
        expect(hookStatus(await openSession(clone.path)).ready).toBe(false);
        if (manager === 'simple-git-hooks') {
            const path = join(clone.path, '.gspot/integrations/simple-git-hooks/pre-commit');
            const original = readFileSync(path);
            writeFileSync(path, '#!/bin/sh\nexit 0\n');
            const refused = await run([process.execPath, main, 'install'], { cwd: clone.path, timeoutMs: 60_000 });
            expect(refused.code, refused.stdout + refused.stderr).toBe(2);
            expect(refused.stdout + refused.stderr).toContain('integration is missing or edited');
            expect(existsSync(join(clone.path, '.git/hooks/pre-commit'))).toBe(false);
            const refusedApply = await run([process.execPath, main, 'apply'], { cwd: clone.path, timeoutMs: 60_000 });
            expect(refusedApply.code, refusedApply.stdout + refusedApply.stderr).toBe(2);
            expect(readFileSync(path, 'utf8')).toBe('#!/bin/sh\nexit 0\n');
            const retained = await run(['git', 'status', '--porcelain'], { cwd: clone.path });
            expect(retained.stdout).toBe(' M .gspot/integrations/simple-git-hooks/pre-commit\n');
            writeFileSync(path, original);
        }
        const lockPath = join(clone.path, manager === 'pre-commit' ? 'uv.lock' : 'package-lock.json');
        const lock = readFileSync(lockPath);
        for (let attempt = 0; attempt < 2; attempt++) {
            const installed = await run(
                manager === 'pre-commit'
                    ? ['uv', 'sync', '--frozen', '--no-install-project']
                    : ['npm', 'ci', '--ignore-scripts', '--no-audit', '--no-fund'],
                {
                    cwd: clone.path,
                    timeoutMs: 60_000,
                },
            );
            expect(installed.code, installed.stderr).toBe(0);
            const hooks = await run([process.execPath, main, 'install'], { cwd: clone.path, timeoutMs: 60_000 });
            expect(hooks.code, hooks.stdout + hooks.stderr).toBe(0);
            expect(hookStatus(await openSession(clone.path)).ready).toBe(true);
            const applied = await run([process.execPath, main, 'apply'], { cwd: clone.path, timeoutMs: 60_000 });
            expect(applied.code, applied.stdout + applied.stderr).toBe(0);
            expect(hookStatus(await openSession(clone.path)).ready).toBe(true);
            const status = await run(['git', 'status', '--porcelain'], { cwd: clone.path });
            expect(status.code, status.stderr).toBe(0);
            expect(status.stdout).toBe('');
            expect(readFileSync(lockPath)).toStrictEqual(lock);
        }
        const options = {
            cwd: clone.path,
            timeoutMs: 30_000,
            env: {
                PATH: `${join(clone.path, 'bin')}${delimiter}${process.env['PATH'] ?? ''}`,
                XDG_CONFIG_HOME: join(clone.path, 'fixture-config'),
                PRE_COMMIT_HOME: join(clone.path, 'pre-commit-cache'),
            },
        };
        const commit = [
            'git',
            '-c',
            'user.name=Fixture',
            '-c',
            'user.email=fixture@example.test',
            'commit',
            '-qm',
            'test: staged source',
        ];
        writeFileSync(join(clone.path, 'source.txt'), 'forbidden\n');
        expect((await run(['git', 'add', 'source.txt'], options)).code).toBe(0);
        writeFileSync(join(clone.path, 'source.txt'), 'corrected in working tree\n');
        const failed = await run(commit, options);
        expect(failed.code, failed.stdout + failed.stderr).toBe(1);
        expect(failed.stdout + failed.stderr).toContain('forbidden source token');
        expect(readFileSync(join(clone.path, 'source.txt'), 'utf8')).toBe('corrected in working tree\n');
        expect(readFileSync(join(clone.path, '.hook-observed'), 'utf8')).toBe('authored');
        expect((await run(['git', 'add', 'source.txt'], options)).code).toBe(0);
        const corrected = await run(commit, options);
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(readFileSync(join(clone.path, '.hook-observed'), 'utf8')).toBe('authoredauthored');
        const status = await run(['git', 'status', '--porcelain'], options);
        expect(status.code, status.stderr).toBe(0);
        expect(status.stdout).toBe('');
        if (manager === 'simple-git-hooks') {
            await using launcher = await testdir();
            await createFileTree(launcher.path, {
                gspot: `#!${process.execPath}\nawait Bun.write('runner-observed', JSON.stringify(process.argv.slice(2)));\n`,
            });
            chmodSync(join(launcher.path, 'gspot'), 0o755);
            const policy = readFileSync(join(clone.path, 'gspot.toml'));
            const originalPath = join(clone.path, '.gspot/integrations/simple-git-hooks/pre-commit.gspot-original');
            const original = readFileSync(originalPath);
            writeFileSync(join(clone.path, 'gspot.toml'), policy.toString('utf8') + '\n[runner]\ntool = "bun"\n');
            writeFileSync(originalPath, '#!/bin/sh\nexit 0\n');
            const edited = await run([process.execPath, main, 'apply'], options);
            expect(edited.code, edited.stdout + edited.stderr).toBe(2);
            expect(readFileSync(originalPath, 'utf8')).toBe('#!/bin/sh\nexit 0\n');
            writeFileSync(originalPath, original);
            const changed = await run([process.execPath, main, 'apply'], options);
            expect(changed.code, changed.stdout + changed.stderr).toBe(0);
            expect(hookStatus(await openSession(clone.path)).ready).toBe(false);
            await installHookManager(await openSession(clone.path));
            expect(hookStatus(await openSession(clone.path)).ready).toBe(true);
            const dispatched = await run(['bash', '.gspot/integrations/simple-git-hooks/pre-commit'], {
                ...options,
                env: { PATH: `${launcher.path}${delimiter}${options.env.PATH}` },
            });
            expect(dispatched.code, dispatched.stdout + dispatched.stderr).toBe(0);
            expect(JSON.parse(readFileSync(join(clone.path, 'runner-observed'), 'utf8'))).toStrictEqual([
                'check',
                '--staged',
            ]);
            unlinkSync(join(clone.path, 'runner-observed'));
            expect(readFileSync(originalPath)).toStrictEqual(original);
            writeFileSync(join(clone.path, 'gspot.toml'), policy);
            const restoredRunner = await run([process.execPath, main, 'apply'], options);
            expect(restoredRunner.code, restoredRunner.stdout + restoredRunner.stderr).toBe(0);
            expect(hookStatus(await openSession(clone.path)).ready).toBe(false);
            await installHookManager(await openSession(clone.path));
            expect(hookStatus(await openSession(clone.path)).ready).toBe(true);
            const roundTrip = await run(['git', 'status', '--porcelain'], options);
            expect(roundTrip.code, roundTrip.stderr).toBe(0);
            expect(roundTrip.stdout, (await run(['git', 'diff', '--', 'package.json'], options)).stdout).toBe('');
        }
        const removed = await run([process.execPath, main, 'uninstall', '--yes'], options);
        expect(removed.code, removed.stdout + removed.stderr).toBe(0);
        expect(existsSync(join(clone.path, '.git/hooks/pre-commit'))).toBe(false);
        expect(existsSync(join(clone.path, '.git/hooks/pre-commit.gspot-manager'))).toBe(false);
        expect(existsSync(join(clone.path, '.gspot/state/ownership.json'))).toBe(true);
        const restored = await run(['git', 'status', '--porcelain'], options);
        expect(restored.code, restored.stderr).toBe(0);
        expect(restored.stdout).toBe('');
    },
    90_000,
);
