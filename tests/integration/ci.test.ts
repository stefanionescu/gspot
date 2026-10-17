import { fakeTool } from '#tests/setup/fakes.ts';
import { isOnDisk } from '#tests/setup/files.ts';
import { test, expect, describe } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { readGitOutput } from '#tests/setup/git.ts';
import type { CiDocument } from '#tests/types/ci.ts';
import { join, dirname, delimiter } from 'node:path';
import { runCommand } from '#tests/setup/processes.ts';
import { readFile, writeFile } from 'node:fs/promises';
import type { ProcessOutput } from '#tests/types/processes.ts';
import { CLI_MAIN, spawnGspot } from '#tests/setup/run-gspot.ts';
import { overrideEnvironment } from '#tests/setup/environment.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { updateSandbox, registerSharedSandbox } from '#tests/setup/sandbox.ts';
import { CI_SETTINGS, GITHUB_PIPELINE, GITLAB_PIPELINE } from '#tests/data/ci.ts';

function commitChanges(root: string, text: string): string {
    readGitOutput(root, ['add', '-A']);
    readGitOutput(root, ['commit', '-qm', text]);
    return readGitOutput(root, ['rev-parse', 'HEAD']);
}

/** Creates the CI jobs of one provider and their check settings, before the shared tool install. */
async function prepareCiProject(root: string, provider: 'gitlab' | 'github') {
    readGitOutput(root, ['init', '-q']);
    const pipelinePath = provider === 'gitlab' ? '.gitlab-ci.yml' : '.github/workflows/application.yml';
    const pipeline = provider === 'gitlab' ? GITLAB_PIPELINE : GITHUB_PIPELINE;
    const settings = CI_SETTINGS.replace('%PROVIDER%', provider)
        .replace(
            '%SYNTAX_COMMAND%',
            JSON.stringify([
                process.execPath,
                '-e',
                'for (const path of process.argv.slice(1)) { const result = Bun.spawnSync(["bash", "-n", path]); if (result.exitCode !== 0) { console.log(path + ": syntax error"); process.exitCode = 1; } }',
                '{files}',
            ]),
        )
        .replace('%AUDIT_COMMAND%', JSON.stringify([process.execPath, '-e', 'process.exitCode = 0']));
    await createFileTree(root, {
        [pipelinePath]: pipeline,
        'changed.sh': 'echo valid\n',
        'legacy.sh': 'if then\n',
    });
    await writeFile(join(root, 'gspot.toml'), settings);
    const applied = await spawnGspot(root, ['apply']);
    expect(applied.code, applied.stdout + applied.stderr).toBe(0);
}

/** Commit the installed project, then a change with a shell syntax error. */
async function commitCiChanges(root: string, provider: 'gitlab' | 'github') {
    const base = commitChanges(root, 'base');
    await writeFile(join(root, 'changed.sh'), 'if then\n');
    commitChanges(root, 'invalid change');
    const workflowPath = provider === 'gitlab' ? '.gitlab/ci/gspot.yml' : '.github/workflows/gspot.yml';
    const generated = Bun.YAML.parse(await readFile(join(root, workflowPath), 'utf8')) as CiDocument;
    return { base, generated };
}

/** A fake mise that runs the source CLI and can refuse to install the npm package. */
async function createCiInstall(folder: string) {
    const nativeMise = Bun.which('mise')!;
    const failure = join(folder, 'mise-fails');
    await fakeTool(
        folder,
        'mise',
        `
import { existsSync } from 'node:fs';
const args = process.argv.slice(2);
if (args[0] === 'exec' && args.some((arg) => arg.startsWith('npm:@gspothq/cli@'))) {
    if (existsSync(${JSON.stringify(failure)})) {
        console.error('npm error 404 Not Found - GET https://registry.npmjs.org/@gspothq/cli');
        process.exit(1);
    }
    const separator = args.indexOf('--');
    const child = Bun.spawnSync([process.execPath, ${JSON.stringify(CLI_MAIN)}, ...args.slice(separator + 2)], { stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
    process.exit(child.exitCode);
}
const env = { ...process.env };
const path = Object.keys(env).find((name) => (process.platform === 'win32' ? name.toUpperCase() : name) === 'PATH');
env[path] = ${JSON.stringify(dirname(nativeMise) + delimiter)} + env[path];
const child = Bun.spawnSync([${JSON.stringify(nativeMise)}, ...args], { env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' });
process.exit(child.exitCode);
`,
    );
    return () => writeFile(failure, '');
}

/** Runs the generated CI script with the comparison and artifact variables that the provider documents. */
async function runCiJob(
    root: string,
    generated: CiDocument,
    folder: string,
    comparison: string,
): Promise<ProcessOutput> {
    const script =
        'gspot' in generated
            ? generated.gspot.script
            : generated.jobs['check-linux']!.steps.flatMap((step) => (step.run === undefined ? [] : [step.run]));
    // An absolute program prepends its folder to the executable search path. Use bare bash to keep the test curl first.
    return await runCommand(['bash', '-e', '-c', script.join('\n')], {
        cwd: root,
        env: {
            PATH: `${folder}${delimiter}${readEnvironmentVariable('PATH') ?? ''}`,
            CI_COMMIT_BEFORE_SHA: comparison,
            CI_MERGE_REQUEST_DIFF_BASE_SHA: '',
            GSPOT_CI_BASE: comparison,
            RUNNER_TEMP: folder,
            GITHUB_PATH: join(folder, 'github-path'),
            NO_COLOR: '1',
        },
    });
}

describe.each(['gitlab', 'github'] as const)('%s CI', (provider) => {
    const installedSandbox = registerSharedSandbox({
        configurations: [],
        files: {},
        prepare: (root) => prepareCiProject(root, provider),
    });
    test('generated jobs check changed files and pass after the fix', async () => {
        const repository = { path: installedSandbox().root };
        await using _change = await updateSandbox(installedSandbox(), { check: '', files: {} });
        await using executables = await testdir();
        const { base, generated } = await commitCiChanges(repository.path, provider);
        using _tools = overrideEnvironment(installedSandbox().environment);
        await createCiInstall(executables.path);
        const invalid = await runCiJob(repository.path, generated, executables.path, base);
        expect(invalid.code, invalid.stdout + invalid.stderr).toBe(1);
        expect(invalid.stdout).toContain('project/syntax');
        expect(invalid.stdout).toContain('changed.sh');
        expect(invalid.stdout).not.toContain('legacy.sh');
        await writeFile(join(repository.path, 'changed.sh'), 'echo corrected\n');
        commitChanges(repository.path, 'correct syntax');
        const valid = await runCiJob(repository.path, generated, executables.path, base);
        expect(valid.code, valid.stdout + valid.stderr).toBe(0);
        const firstPush = await runCiJob(repository.path, generated, executables.path, '0'.repeat(base.length));
        expect(firstPush.code, firstPush.stdout + firstPush.stderr).toBe(1);
        expect(firstPush.stdout).toContain('legacy.sh');
    });

    test('invalid comparisons and failed installs fail the job', async () => {
        const repository = { path: installedSandbox().root };
        await using _change = await updateSandbox(installedSandbox(), { check: '', files: {} });
        await using executables = await testdir();
        const { base, generated } = await commitCiChanges(repository.path, provider);
        using _tools = overrideEnvironment(installedSandbox().environment);
        const refuse = await createCiInstall(executables.path);
        const malformed = await runCiJob(repository.path, generated, executables.path, '$(touch injected)');
        expect(malformed.code, malformed.stdout + malformed.stderr).toBe(2);
        expect(malformed.stderr).toContain('Git merge-base failed for $(touch injected):');
        expect(await isOnDisk(join(repository.path, 'injected'))).toBe(false);
        const missing = await runCiJob(repository.path, generated, executables.path, 'f'.repeat(base.length));
        expect(missing.code).toBe(2);
        expect(missing.stderr).toBe(
            `Git merge-base failed for ${'f'.repeat(base.length)}: fatal: Not a valid commit name ${'f'.repeat(base.length)}.\n`,
        );
        await refuse();
        const refused = await runCiJob(repository.path, generated, executables.path, base);
        expect(refused.code).toBe(1);
        expect(refused.stderr).toContain('404 Not Found');
    });
});
