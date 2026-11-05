import { symlink, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';

import { readConfigurations } from '#cli/manifests/read.ts';
import { getTool } from '#cli/tools/pins.ts';
import type { CommandFailureJson } from '#cli/types/system.ts';
import { CLEAN_BASH_SCRIPT } from '#tests/config/setup/languages.ts';
import { BASH_SYNTAX_CHECK } from '#tests/config/setup/sandboxes.ts';
import { parseCheckReport, runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { applyGeneratedFiles } from '#tests/setup/sandboxes/changes.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { isWindows } from '#tests/setup/system/platform.ts';

test('bash/shellcheck without ShellCheck on PATH exits 2 and names the pinned version', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['bash']),
        'scripts/a.sh': CLEAN_BASH_SCRIPT,
        '.gitignore': 'home/\n',
        home: {},
    });
    await using programs = await testdir();

    commitAll(sandbox.path);
    await applyGeneratedFiles(sandbox.path);
    const bin = programs.path;
    const gitPath = Bun.which('git');
    expect(gitPath).not.toBeNull();
    await symlink(process.execPath, join(bin, isWindows ? 'bun.exe' : 'bun'));
    if (!isWindows) await symlink(gitPath!, join(bin, 'git'));
    const path = isWindows ? `${bin}${delimiter}${dirname(gitPath!)}` : bin;
    const environment = {
        PATH: path,
        HOME: join(sandbox.path, 'home'),
        MISE_DATA_DIR: join(sandbox.path, 'home', 'mise'),
    };
    const check = parseCheckReport(
        await spawnGspot(sandbox.path, ['check', '--only', 'bash/shellcheck', '--json'], environment),
    );
    expect(check.code, check.stdout + check.stderr).toBe(2);
    const version = String(getTool(readConfigurations().values().toArray(), 'shellcheck').version);
    expect(check.report.checks[0]!.note).toContain(`shellcheck ${version}`);
    expect(check.report.checks).toMatchObject([
        {
            check: 'bash/shellcheck',
            status: 'missing',
            findings: [],
        },
    ]);
});

test('a pre-push check in a shallow clone refuses commits/commitlint-pushed and names git fetch --unshallow', async () => {
    await using sandbox = await testdir();
    const source = join(sandbox.path, 'source');
    await createFileTree(source, {
        'gspot.toml': buildSandboxSettings(['bash', 'commits'], { tables: BASH_SYNTAX_CHECK, level: 'all' }),
        'source.sh': 'echo base\n',
    });
    runGitStep(source, ['init', '-q']);
    await runGspotStep({ root: source, run: spawnGspot }, ['install']);
    runGitStep(source, ['add', '-A']);
    runGitStep(source, ['commit', '-qm', 'chore: initialize']);
    await writeFile(join(source, 'source.sh'), 'echo selected\n');
    runGitStep(source, ['commit', '-qam', 'feat: select source']);
    const selected = runGitStep(source, ['rev-parse', 'HEAD']);
    runGitStep(sandbox.path, ['clone', '--depth=1', pathToFileURL(source).href, 'checkout']);
    const checkout = join(sandbox.path, 'checkout');
    const command = ['check', '--hook', 'pre-push', '--json', '--only'];
    const remote = ['--', 'unseen', 'unused'];
    const input = { stdin: `refs/heads/main ${selected} refs/heads/main ${'0'.repeat(selected.length)}\n` };
    runGitStep(checkout, ['remote', 'add', 'unseen', pathToFileURL(source).href]);
    await runGspotStep({ root: checkout, run: spawnGspot }, ['install']);
    const refused = await spawnGspot(checkout, [...command, 'commits/commitlint-pushed', ...remote], {}, input);
    expect(refused.code, refused.stdout + refused.stderr).toBe(2);
    expect((JSON.parse(refused.stdout) as CommandFailureJson).message).toContain('commits/commitlint-pushed');
});
