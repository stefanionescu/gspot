import { readFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';

import { stringify } from '@decimalturn/toml-patch';
import { expect, test } from 'bun:test';
import { testdir } from 'testdirs';

import cliPackage from '#cli-package' with { type: 'json' };
import { LINE_BREAK } from '#cli/config/system.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { runGspotStep, spawnGspot } from '#tests/setup/cli/commands.ts';
import { runGitStep } from '#tests/setup/system/git.ts';
import { runCommand } from '#tests/setup/system/processes.ts';
import type { GithubWorkflow } from '#tests/types/setup.ts';

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
