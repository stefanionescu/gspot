import { applyCommand } from '#cli/commands/apply.ts';
import { installHookManager } from '#cli/lifecycle/hook-managers.ts';
import { hookLocation } from '#cli/lifecycle/hooks.ts';
import { run } from '#cli/platform/spawn.ts';
import { openSession } from '#cli/run/session.ts';
import { expect, test } from 'bun:test';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { createFileTree, testdir } from 'testdirs';

const VERSIONS = { lefthook: '2.0.13', husky: '9.1.7', 'simple-git-hooks': '2.13.1', 'pre-commit': '4.5.1' };

test.each(['lefthook', 'husky', 'simple-git-hooks', 'pre-commit'] as const)(
    'first adoption preserves an edited %s launcher and accepts native regeneration',
    async (manager) => {
        await using repository = await testdir();
        const root = repository.path;
        await createFileTree(root, {
            'gspot.toml': `version = 1\nconfigurations = []\n[rules]\ninstall = false\n[hooks]\ntool = "${manager}"\n`,
            'package.json': JSON.stringify({
                private: true,
                devDependencies: manager === 'pre-commit' ? {} : { [manager]: VERSIONS[manager] },
            }),
            'source.txt': 'fixture\n',
            'bin/gspot': `#!${process.execPath}\n(await import('node:fs')).appendFileSync('observed', 'x');\n`,
            'native-init.sh': 'true\n',
        });
        chmodSync(join(root, 'bin/gspot'), 0o755);
        const options = {
            cwd: root,
            timeoutMs: 60_000,
            env: {
                PATH: `${join(root, 'bin')}${delimiter}${process.env['PATH'] ?? ''}`,
                XDG_CONFIG_HOME: join(root, 'fixture-config'),
                PRE_COMMIT_HOME: join(root, 'pre-commit-cache'),
            },
        };
        for (const command of [
            ['git', 'init', '-q'],
            ['git', 'add', 'source.txt'],
            ['git', '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-qm', 'fixture'],
            ...(manager === 'pre-commit'
                ? [
                      ['uv', 'venv', '.venv'],
                      ['uv', 'pip', 'install', '--python', '.venv/bin/python', `pre-commit==${VERSIONS[manager]}`],
                  ]
                : [['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund']]),
        ]) {
            const result = await run(command, options);
            expect(result.code, result.stdout + result.stderr).toBe(0);
        }
        expect((await applyCommand({ cwd: root, isDryRun: false })).exitCode).toBe(0);
        const prepare =
            manager === 'pre-commit'
                ? [
                      join(root, '.venv/bin/pre-commit'),
                      'install',
                      '--hook-type',
                      'pre-commit',
                      '--hook-type',
                      'pre-push',
                      '--hook-type',
                      'commit-msg',
                  ]
                : [join(root, 'node_modules/.bin', manager), ...(manager === 'lefthook' ? ['install'] : [])];
        const prepared = await run(prepare, options);
        expect(prepared.code, prepared.stdout + prepared.stderr).toBe(0);
        const location = hookLocation(root);
        const names = ['pre-commit', 'pre-push', 'commit-msg'];
        const original = names.map((name) => readFileSync(join(location.absolute, name)));
        const edited = readFileSync(join(location.absolute, 'commit-msg'), 'utf8') + '\n# Authored launcher edit\n';
        writeFileSync(join(location.absolute, 'commit-msg'), edited);
        const gitConfig = readFileSync(join(root, '.git/config'));
        await expect(installHookManager(await openSession(root))).rejects.toThrow('Retained differing native hook');
        expect(readFileSync(join(location.absolute, 'commit-msg'), 'utf8')).toBe(edited);
        for (const [index, name] of names.entries()) {
            if (name !== 'commit-msg') expect(original[index]).toEqual(readFileSync(join(location.absolute, name)));
            expect(existsSync(join(location.absolute, `${name}.gspot-manager`))).toBe(false);
            expect(existsSync(join(location.absolute, `${name}.gspot-original`))).toBe(false);
        }
        if (manager === 'lefthook') {
            const message = original[2];
            if (message === undefined) throw new Error('Missing native commit-msg fixture');
            writeFileSync(join(location.absolute, 'commit-msg'), message);
            const config = join(root, 'lefthook.yml');
            writeFileSync(config, readFileSync(config, 'utf8') + '\nrc: ./native-init.sh\n');
            await expect(installHookManager(await openSession(root))).rejects.toThrow('Retained differing native hook');
            expect(readFileSync(join(location.absolute, 'commit-msg'))).toEqual(message);
        }
        const regenerated = await run(prepare, options);
        expect(regenerated.code, regenerated.stdout + regenerated.stderr).toBe(0);
        if (manager === 'lefthook') {
            const helper = join(location.absolute, 'prepare-commit-msg');
            const native = readFileSync(helper);
            const editedHelper = native.toString('utf8') + '\n# Authored helper edit\n';
            writeFileSync(helper, editedHelper);
            await expect(installHookManager(await openSession(root))).rejects.toThrow('Retained differing native hook');
            expect(readFileSync(helper, 'utf8')).toBe(editedHelper);
            for (const name of names) expect(existsSync(join(location.absolute, `${name}.gspot-manager`))).toBe(false);
            writeFileSync(helper, native);
        }
        await installHookManager(await openSession(root));
        const checked = await run(['git', 'hook', 'run', 'pre-commit'], options);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(readFileSync(join(root, 'observed'), 'utf8')).toBe('x');
        expect(readFileSync(join(root, '.git/config'))).toEqual(gitConfig);
    },
    90_000,
);
