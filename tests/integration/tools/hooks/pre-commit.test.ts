import { expect, test } from 'bun:test';
import { join, relative } from 'node:path';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { openSession } from '#cli/execution/session.ts';
import { hookStatus } from '#cli/lifecycle/hooks/status.ts';
import { applyCommand } from '#cli/commands/apply/command.ts';
import { environmentVariables } from '#cli/platform/environment.ts';
import { installHookManager } from '#cli/lifecycle/hooks/managers.ts';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { chmodSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';

const POLICY = 'version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "pre-commit"\n';

test.each(['', "apps/worker's tools"])(
    'native pre-commit hooks run from policy directory %s and preserve Git inputs',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        await createFileTree(root, {
            'gspot.toml': POLICY,
            '.gitignore': '.venv/\nbin/\npre-commit-cache/\nobserved\nfailed\n',
            'source.txt': 'input',
            'bin/gspot': `#!${process.execPath}\nconst {appendFileSync} = await import('node:fs'); appendFileSync('observed', JSON.stringify({args: process.argv.slice(2), input: await Bun.stdin.text()}) + '\\n'); process.exitCode = (await Bun.file('setup-failed').exists()) ? 2 : (await Bun.file('failed').exists()) ? 1 : 0;\n`,
        });
        chmodSync(join(root, 'bin/gspot'), 0o755);
        for (const command of [
            ['git', 'init', '-q', sandbox.path],
            ['uv', 'venv', '.venv'],
            ['uv', 'pip', 'install', '--python', '.venv/bin/python', 'pre-commit==4.5.1'],
        ]) {
            const result = await run(command, { cwd: root, timeoutMs: 60_000 });
            expect(result.code, result.stderr).toBe(0);
        }
        const applied = await applyCommand({ cwd: root, isDryRun: false });
        expect(applied.exitCode).toBe(0);
        const ran = await run(['git', 'add', 'source.txt', 'gspot.toml', '.pre-commit-config.yaml', '.gitignore'], {
            cwd: root,
        });
        expect(ran.code).toBe(0);
        const committed = await run(
            ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
            { cwd: root },
        );
        expect(committed.code).toBe(0);
        const session = await openSession(root);
        await installHookManager({
            policy: session.policyFiles.policy,
            repository: session.repository,
            tools: session,
        });
        await installHookManager({
            policy: session.policyFiles.policy,
            repository: session.repository,
            tools: session,
        });
        expect(
            hookStatus(
                await openSession(root).then((session) => ({
                    policy: session.policyFiles.policy,
                    repository: session.repository,
                })),
            ).ready,
        ).toBe(true);
        const env = {
            PATH: `${join(root, 'bin')}:${environmentVariables()['PATH'] ?? ''}`,
            PRE_COMMIT_HOME: join(root, 'pre-commit-cache'),
        };
        const checked = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(JSON.parse(readFileSync(join(root, 'observed'), 'utf8'))).toStrictEqual({
            args: ['check', '--staged'],
            input: '',
        });
        writeFileSync(join(root, 'failed'), 'finding');
        const skippedGspot = await run(['git', 'hook', 'run', 'pre-commit'], {
            cwd: root,
            env: { ...env, SKIP: 'gspot' },
        });
        expect(skippedGspot.code).toBe(1);
        unlinkSync(join(root, 'failed'));
        writeFileSync(join(root, 'setup-failed'), 'missing dependency');
        const setup = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
        expect(setup.code, setup.stdout + setup.stderr).toBe(2);
        unlinkSync(join(root, 'setup-failed'));
        const configuration = readFileSync(join(root, '.pre-commit-config.yaml'));
        writeFileSync(join(root, '.pre-commit-config.yaml'), 'repos: [invalid yaml\n');
        const malformed = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        writeFileSync(join(root, '.pre-commit-config.yaml'), configuration);
        writeFileSync(join(root, '.pre-commit-config.yaml'), 'repos: []\n');
        const unstaged = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
        expect(unstaged.code, unstaged.stdout + unstaged.stderr).toBe(2);
        expect(unstaged.stderr).toContain('Stage the configuration');
        const staged = await run(['git', 'add', '.pre-commit-config.yaml'], { cwd: root });
        expect(staged.code).toBe(0);
        const skipped = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
        expect(skipped.code, skipped.stdout + skipped.stderr).toBe(2);
        expect(skipped.stderr).toContain('gspot apply');
        const authored = parseYaml(configuration.toString('utf8')) as {
            repos: Record<string, unknown>[];
            fail_fast?: boolean;
        };
        authored.repos.unshift({
            repo: 'local',
            hooks: [
                {
                    id: 'authored',
                    name: 'authored',
                    entry: 'sh -c "exit 7"',
                    language: 'system',
                    stages: ['pre-commit'],
                    pass_filenames: false,
                    always_run: true,
                },
            ],
        });
        for (const failFast of [false, true]) {
            authored.fail_fast = failFast;
            writeFileSync(join(root, '.pre-commit-config.yaml'), stringifyYaml(authored));
            const authoredStaged = await run(['git', 'add', '.pre-commit-config.yaml'], { cwd: root });
            expect(authoredStaged.code).toBe(0);
            const failedNative = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
            expect(failedNative.code, failedNative.stdout + failedNative.stderr).toBe(1);
        }
        writeFileSync(join(root, '.pre-commit-config.yaml'), configuration);
        const restaged = await run(['git', 'add', '.pre-commit-config.yaml'], { cwd: root });
        expect(restaged.code).toBe(0);
        const hashed = await run(['git', 'hash-object', 'source.txt'], { cwd: root });
        expect(hashed.code, hashed.stderr).toBe(0);
        const blob = hashed.stdout.trim();
        const conflictPath = relative(sandbox.path, join(root, 'source.txt'));
        const conflicted = await run(['git', 'update-index', '--index-info'], {
            cwd: sandbox.path,
            stdin: `0 ${'0'.repeat(blob.length)}\t${conflictPath}\n100644 ${blob} 1\t${conflictPath}\n100644 ${blob} 2\t${conflictPath}\n100644 ${blob} 3\t${conflictPath}\n`,
        });
        expect(conflicted.code, conflicted.stderr).toBe(0);
        const conflict = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
        expect(conflict.code, conflict.stdout + conflict.stderr).toBe(2);
        expect(conflict.stderr).toContain('Unmerged index entries');
        const reset = await run(['git', 'reset', '--', 'source.txt'], { cwd: root });
        expect(reset.code).toBe(0);
        const executable = join(root, '.venv/bin/pre-commit');
        renameSync(executable, `${executable}.retained`);
        try {
            const missing = await run(['git', 'hook', 'run', 'pre-commit'], { cwd: root, env });
            expect(missing.code, missing.stdout + missing.stderr).toBe(2);
            expect(missing.stderr).toContain('gspot install');
        } finally {
            renameSync(`${executable}.retained`, executable);
        }
        writeFileSync(join(root, 'blocked-cache'), 'not a directory');
        const cache = await run(['git', 'hook', 'run', 'pre-commit'], {
            cwd: root,
            env: { ...env, PRE_COMMIT_HOME: join(root, 'blocked-cache') },
        });
        expect(cache.code, cache.stdout + cache.stderr).toBe(2);

        writeFileSync(join(root, 'observed'), '');
        const revision = await run(['git', 'rev-parse', 'HEAD'], { cwd: root });
        const head = revision.stdout.trim();
        const zeros = '0'.repeat(head.length);
        const input = `refs/heads/first ${head} refs/heads/first ${zeros}\nrefs/heads/second ${head} refs/heads/second ${zeros}\n`;
        writeFileSync(join(root, 'push-input'), input);
        const pushed = await run(
            [
                'git',
                'hook',
                'run',
                '--to-stdin',
                join(root, 'push-input'),
                'pre-push',
                '--',
                'origin',
                'remote with spaces',
            ],
            { cwd: root, env },
        );
        expect(pushed.code, pushed.stdout + pushed.stderr).toBe(0);
        expect(JSON.parse(readFileSync(join(root, 'observed'), 'utf8'))).toStrictEqual({
            args: ['check', '--push', '--', 'origin', 'remote with spaces'],
            input,
        });
        writeFileSync(join(root, 'observed'), '');
        writeFileSync(join(root, 'message with spaces'), 'test: fixture\n');
        const message = await run(
            ['git', 'hook', 'run', 'commit-msg', '--', relative(sandbox.path, join(root, 'message with spaces'))],
            { cwd: root, env },
        );
        expect(message.code, message.stdout + message.stderr).toBe(0);
        expect(JSON.parse(readFileSync(join(root, 'observed'), 'utf8'))).toStrictEqual({
            args: ['check', '--stage', 'message', '--message-file', join(root, 'message with spaces')],
            input: '',
        });
    },
    90_000,
);
