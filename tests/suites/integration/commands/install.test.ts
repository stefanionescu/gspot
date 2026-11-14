import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { LINE_BREAK } from '#cli/config/system.ts';
import { stringify } from '@decimalturn/toml-patch';
import { join, dirname, delimiter } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import cliPackage from '#cli-package' with { type: 'json' };
import type { GithubWorkflow } from '#tests/types/setup.ts';
import { commitAll, runGitStep } from '#tests/setup/system/git.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { spawnGspot, runGspotStep } from '#tests/setup/cli/commands.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';
import { runCommand, runBlockingCommand } from '#tests/setup/system/processes.ts';

test.each([true, false])(
    'init, install, and check keep the staged index, the unstaged edits, and HEAD (has commits: %p)',
    async (hasCommits) => {
        await using sandbox = await createGitSandbox({ 'plans.txt': 'committed\n' });

        if (hasCommits) commitAll(sandbox.path);
        await writeFile(join(sandbox.path, 'plans.txt'), 'staged\n');
        runGitStep(sandbox.path, ['add', 'plans.txt']);
        await writeFile(join(sandbox.path, 'plans.txt'), 'unstaged\n');
        await writeFile(join(sandbox.path, 'notes.txt'), 'draft\n');
        const staged = runGitStep(sandbox.path, ['diff', '--cached', '--binary']);
        const head = runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        const initialized = await spawnGspot(sandbox.path, ['init', '--json', '--configurations', 'gspot']);
        expect(initialized.code, initialized.stdout + initialized.stderr).toBe(0);
        await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
        const checked = await spawnGspot(sandbox.path, ['check', '--json']);
        expect(checked.code, checked.stdout + checked.stderr).toBe(0);
        expect(await readFile(join(sandbox.path, 'plans.txt'), 'utf8')).toBe('unstaged\n');
        expect(await readFile(join(sandbox.path, 'notes.txt'), 'utf8')).toBe('draft\n');
        expect(runGitStep(sandbox.path, ['diff', '--cached', '--binary'])).toBe(staged);
        const after = runBlockingCommand(['git', 'rev-parse', '--verify', 'HEAD'], { cwd: sandbox.path, env: {} });
        expect({ code: after.code, stdout: after.stdout }).toStrictEqual({ code: head.code, stdout: head.stdout });
    },
);

test('the generated GitHub command installs gspot with empty mise state', async () => {
    await using sandbox = await testdir({
        'gspot.toml': stringify({
            configurations: [],
            rule_files: { enabled: false },
            ci: { enabled: true, provider: 'github' },
        }),
    });
    runGitStep(sandbox.path, ['init', '-q']);
    await runGspotStep({ root: sandbox.path, run: spawnGspot }, ['install']);
    const workflow = Bun.YAML.parse(
        await readFile(join(sandbox.path, '.github/workflows/gspot.yml'), 'utf8'),
    ) as GithubWorkflow;
    const command = workflow.jobs['lint']!.steps.find((step) => step.name === 'Install gspot')!.run!;
    const env = {
        GITHUB_PATH: join(sandbox.path, 'github-path'),
        MISE_CONFIG_DIR: join(sandbox.path, 'config'),
        MISE_DATA_DIR: join(sandbox.path, 'data'),
        MISE_STATE_DIR: join(sandbox.path, 'state'),
        MISE_CACHE_DIR: join(sandbox.path, 'cache'),
        MISE_CEILING_PATHS: dirname(sandbox.path),
    };

    const installed = await runCommand(['bash', '-e', '-c', command], { cwd: sandbox.path, env });
    expect(installed.code, installed.stdout + installed.stderr).toBe(0);
    const githubPath = await readFile(env.GITHUB_PATH, 'utf8');
    const added = githubPath.split(LINE_BREAK).filter((path) => path !== '');
    const result = await runCommand(['bash', '-e', '-c', 'gspot --version'], {
        cwd: sandbox.path,
        env: { ...env, PATH: [...added, readEnvironmentVariable('PATH') ?? ''].join(delimiter) },
    });
    expect(result.code, result.stdout + result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(cliPackage.version);
});
