import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { isWindows } from '#tests/setup/system.ts';
import { join, dirname, delimiter } from 'node:path';
import { symlink, writeFile } from 'node:fs/promises';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { type PushReport } from '#cli/types/commands/check.ts';
import { commitAll, readGitOutput } from '#tests/setup/git.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { readManifests } from '#cli/configurations/manifests.ts';
import { getToolDeclaration } from '#cli/configurations/tools.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/data/checks/bash/samples.ts';
import { spawnGspot, parseCheckReport } from '#tests/setup/run-gspot.ts';
import { BASH_SYNTAX_CHECK } from '#tests/data/checks/bash/tool-checks.ts';

test('a check whose tool is not installed fails with the pinned version and the install command', async () => {
    await using sandbox = await testdir({
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        '.gitignore': 'home/\nbin/\n',
        home: {},
        bin: {},
    });

    commitAll(sandbox.path);
    const bin = join(sandbox.path, 'bin');
    const gitPath = Bun.which('git');
    expect(gitPath).not.toBeNull();
    await symlink(process.execPath, join(bin, isWindows ? 'bun.exe' : 'bun'));
    // Git for Windows finds its installation from the folder git.exe sits in, which holds no lint tool.
    if (!isWindows) await symlink(gitPath!, join(bin, 'git'));
    const path = isWindows ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const initialized = await spawnGspot(sandbox.path, buildInitArguments(['bash']), {
        ...environment,
    });
    expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
    expect(initialized.stdout + initialized.stderr).toContain('Next: run gspot install');
    const check = await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck'], environment);
    expect(check.code).toBe(2);
    expect(check.stdout).toContain('missing');
    expect(check.stdout).toContain(
        `shellcheck ${String(getToolDeclaration([...readManifests().values()], 'shellcheck').version)} is not installed`,
    );
    const selected = await spawnGspot(sandbox.path, ['set', 'level', 'all']);
    expect(selected.code, selected.stdout + selected.stderr).toBe(0);
    const builtIn = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'bash/function-size', '--json'], environment),
    );
    expect(builtIn.code, builtIn.stdout + builtIn.stderr).toBe(0);
    expect(builtIn.report.checks).toMatchObject([{ check: 'bash/function-size', status: 'passed', findings: [] }]);
    const available = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json']),
    );
    expect(available.code, available.stdout + available.stderr).toBe(0);
    expect(available.report.checks).toMatchObject([{ check: 'bash/shellcheck', status: 'passed', findings: [] }]);
});

test('full-tree pre-push settings checks unchanged files in the pushed object', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK }),
        'changed.sh': 'echo base\n',
        'legacy.sh': 'if then\n',
    });

    commitAll(sandbox.path);
    const base = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    await writeFile(join(sandbox.path, 'changed.sh'), 'echo changed\n');
    await writeFile(
        join(sandbox.path, 'gspot.toml'),
        buildSandboxSettings(['bash'], { tables: BASH_SYNTAX_CHECK + '[hooks]\n' }),
    );
    readGitOutput(sandbox.path, ['add', 'gspot.toml', 'changed.sh']);
    readGitOutput(sandbox.path, ['commit', '-qm', 'full pushed tree']);
    const pushedCommit = readGitOutput(sandbox.path, ['rev-parse', 'HEAD']);
    const all = await spawnGspot(
        sandbox.path,
        ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json', '--', 'origin', 'unused'],
        {},
        {
            stdin: `refs/heads/main ${pushedCommit} refs/heads/main ${base}\n`,
        },
    );
    expect(all.code, all.stdout + all.stderr).toBe(1);
    expect(
        new Set(
            (JSON.parse(all.stdout) as PushReport).revisions[0]?.report.checks[0]?.findings.map(
                (finding) => finding.file,
            ),
        ),
    ).toStrictEqual(new Set(['legacy.sh']));
});
