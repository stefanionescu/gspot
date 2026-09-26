// The hook gspot installs runs the staged checks on commit, in the repository and in a fresh clone.
import { chmodSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { git } from '#tests/support/cli/git.ts';
import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
import { script } from '#tests/support/cli/planted.ts';
import { toolsPath } from '#tests/support/cli/tools.ts';
import { gspot, PLANTED_TIMEOUT_MS, run } from '#tests/support/cli/command.ts';

describe('the gspot hook', () => {
    test(
        'installed and freshly cloned repositories enforce staged defects through real commits',
        async () => {
            await using sandbox = await testdir();
            await using cloneRoot = await testdir();
            await createFileTree(sandbox.path, { 'scripts/a.sh': script });
            git(sandbox.path, ['init', '-q']);
            git(sandbox.path, ['add', '-A']);
            git(sandbox.path, ['commit', '-qm', 'init']);
            await run(sandbox.path, [
                'init',
                '--yes',
                '--configurations',
                'bash',
                '--without',
                'formatting',
                '--no-runner',
                '--no-ci',
                '--no-rules',
                '--no-install',
            ]);
            const installed = await run(sandbox.path, ['install']);
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
            await Bun.write(join(sandbox.path, 'scripts', 'b.sh'), '#!/usr/bin/env bash\necho $1\n');
            git(sandbox.path, ['add', '-A']);
            const environment = {
                PATH: `${join(import.meta.dir, '../../../../../.mise/gspot')}${delimiter}${toolsPath([])}`,
                NO_COLOR: '1',
            };
            const commit = git(sandbox.path, ['commit', '-qm', 'bad'], environment);
            expect(commit.code).not.toBe(0);
            expect(`${commit.stdout}${commit.stderr}`).toContain('SC2086');
            expect(commit.stdout + commit.stderr).toContain('reproduce: gspot check --only bash/shellcheck --staged');
            expect(commit.stdout + commit.stderr).toContain('Bypass this hook once: git commit --no-verify');
            await Bun.write(join(sandbox.path, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "$1"\n');
            expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
            const corrected = git(sandbox.path, ['commit', '-qm', 'Correct shell input'], environment);
            expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
            const clone = join(cloneRoot.path, 'clone');
            const cloned = git(sandbox.path, ['clone', '--quiet', '--no-local', sandbox.path, clone]);
            expect(cloned.code, cloned.stdout + cloned.stderr).toBe(0);
            const uninstalled = await run(clone, ['check', '--only', 'bash/shellcheck', '--no-cache']);
            expect(uninstalled.code, uninstalled.stdout + uninstalled.stderr).toBe(0);
            expect((uninstalled.stdout + uninstalled.stderr).match(/gspot install/gu)).toHaveLength(1);
            for (let attempt = 0; attempt < 2; attempt++) {
                const installation = await run(clone, ['install']);
                expect(installation.code, installation.stdout + installation.stderr).toBe(0);
                const status = git(clone, ['status', '--porcelain']);
                expect(status.code, status.stderr).toBe(0);
                expect(status.stdout).toBe('');
            }
            const ready = await run(clone, ['check', '--only', 'bash/shellcheck', '--no-cache']);
            expect(ready.code, ready.stdout + ready.stderr).toBe(0);
            expect(ready.stdout + ready.stderr).not.toContain('Configured hooks are not ready');
            await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho $1\n');
            expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
            const rejected = git(clone, ['commit', '-qm', 'Unquoted shell input'], environment);
            expect(rejected.code).not.toBe(0);
            expect(rejected.stdout + rejected.stderr).toContain('SC2086');
            await Bun.write(join(clone, 'scripts/b.sh'), '#!/usr/bin/env bash\necho "${1:-ready}"\n');
            expect(git(clone, ['add', 'scripts/b.sh']).code).toBe(0);
            const accepted = git(clone, ['commit', '-qm', 'Quote shell input'], environment);
            expect(accepted.code, accepted.stdout + accepted.stderr).toBe(0);
        },
        PLANTED_TIMEOUT_MS,
    );
});

test('a hook selects configuration below the Git root and checks its exact index', async () => {
    await using sandbox = await testdir();
    await using launcher = await testdir();
    const project = join(sandbox.path, 'nested config');
    await createFileTree(launcher.path, {
        gspot: `#!${process.execPath}\nconst child = Bun.spawn([process.execPath, ${JSON.stringify(gspot)}, ...process.argv.slice(2)], {stdin:'inherit',stdout:'inherit',stderr:'inherit'});process.exit(await child.exited);\n`,
    });
    chmodSync(join(launcher.path, 'gspot'), 0o755);
    await createFileTree(sandbox.path, {
        'nested config/gspot.toml': `version = 1
configurations = []
[rules]
install = false
[hooks]
tool = "gspot"
[[check]]
name = "project/content"
stage = "commit"
paths = ["source.txt"]
command = ${JSON.stringify([process.execPath, '-e', 'if ((await Bun.file("source.txt").text()).trim() === "invalid") { console.log("Indexed defect"); process.exitCode = 1; }'])}
`,
        'nested config/source.txt': 'invalid\n',
    });
    expect(git(sandbox.path, ['init', '-q']).code).toBe(0);
    expect(git(sandbox.path, ['add', '-A']).code).toBe(0);
    const installed = await run(project, ['install']);
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    await Bun.write(join(project, 'source.txt'), 'corrected working tree\n');
    const environment = { PATH: `${launcher.path}${delimiter}${toolsPath([])}` };
    const rejected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(rejected.code, rejected.stdout + rejected.stderr).toBe(1);
    expect(rejected.stdout + rejected.stderr).toContain('Indexed defect');
    expect(await Bun.file(join(project, 'source.txt')).text()).toBe('corrected working tree\n');
    expect(git(sandbox.path, ['add', 'nested config/source.txt']).code).toBe(0);
    const corrected = git(sandbox.path, ['hook', 'run', 'pre-commit'], environment);
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
});
